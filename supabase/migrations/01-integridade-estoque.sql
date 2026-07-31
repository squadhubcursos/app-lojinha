-- Integridade de estoque: liga compras, contagens e transferencias as movimentacoes
-- via chaves reais, e deixa o banco manter os pares sincronizados.
--
-- Antes desta migracao o app gravava compra e baixa de estoque em dois inserts
-- separados no cliente, e as exclusoes procuravam a movimentacao par por uma
-- janela de +-60s. Isso dessincronizou 18 dos 28 produtos.

-- =====================================================================
-- 1. Colunas de vinculo
-- =====================================================================

alter table estoque_movimentacoes
  add column if not exists compra_id uuid references compras(id) on delete cascade,
  add column if not exists contagem_id uuid references inventario_contagens(id) on delete cascade,
  add column if not exists grupo_id uuid,
  add column if not exists contexto text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'estoque_movimentacoes_contexto_check'
  ) then
    alter table estoque_movimentacoes
      add constraint estoque_movimentacoes_contexto_check
      check (contexto is null or contexto in ('estoque', 'lojinha'));
  end if;
end $$;

create index if not exists idx_mov_compra_id on estoque_movimentacoes(compra_id);
create index if not exists idx_mov_contagem_id on estoque_movimentacoes(contagem_id);
create index if not exists idx_mov_grupo_id on estoque_movimentacoes(grupo_id);

-- Uma compra tem no maximo uma baixa vinculada
create unique index if not exists idx_mov_compra_id_unico
  on estoque_movimentacoes(compra_id) where compra_id is not null;

-- Backfill: ate aqui o contexto do ajuste vivia dentro do texto da observacao
update estoque_movimentacoes
set contexto = case when observacao like '%[lojinha]%' then 'lojinha' else 'estoque' end
where tipo = 'ajuste_inventario' and contexto is null;

-- =====================================================================
-- 2. compras -> saida_lojinha
-- =====================================================================

create or replace function public.sync_mov_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obs text;
begin
  select case when p.categoria = 'marmita' then 'Venda marmita' else 'Venda lojinha' end
    into v_obs
  from produtos p where p.id = new.produto_id;

  v_obs := coalesce(v_obs, 'Venda lojinha');

  if tg_op = 'INSERT' then
    insert into estoque_movimentacoes
      (produto_id, tipo, quantidade, custo_unit, observacao, registrado_em, usuario_id, compra_id)
    values
      (new.produto_id, 'saida_lojinha', new.quantidade, null, v_obs,
       new.comprado_em, new.usuario_id, new.id);
  else
    update estoque_movimentacoes
      set produto_id    = new.produto_id,
          quantidade    = new.quantidade,
          usuario_id    = new.usuario_id,
          registrado_em = new.comprado_em,
          observacao    = v_obs
    where compra_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_mov_venda on compras;
create trigger trg_sync_mov_venda
after insert or update on compras
for each row execute function public.sync_mov_venda();

-- Guarda de transicao: versoes antigas do app inserem a saida_lojinha por conta
-- propria depois de gravar a compra. Como a trigger acima ja criou a linha com o
-- mesmo produto, quantidade e timestamp, o insert redundante vira no-op em vez de
-- duplicar a baixa.
create or replace function public.ignora_saida_lojinha_duplicada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'saida_lojinha' and new.compra_id is null then
    if exists (
      select 1 from estoque_movimentacoes m
      where m.tipo = 'saida_lojinha'
        and m.compra_id is not null
        and m.produto_id = new.produto_id
        and m.quantidade = new.quantidade
        and m.registrado_em = new.registrado_em
        and m.usuario_id is not distinct from new.usuario_id
    ) then
      return null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ignora_saida_duplicada on estoque_movimentacoes;
create trigger trg_ignora_saida_duplicada
before insert on estoque_movimentacoes
for each row execute function public.ignora_saida_lojinha_duplicada();

-- =====================================================================
-- 3. Par saida_estoque <-> entrada_lojinha
-- =====================================================================

create or replace function public.sync_par_transferencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- a propagacao abaixo dispara esta mesma trigger; so agimos na chamada original
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.grupo_id is not null then
      delete from estoque_movimentacoes
      where grupo_id = old.grupo_id and id <> old.id;
    end if;
    return old;
  end if;

  if new.grupo_id is not null then
    update estoque_movimentacoes
      set produto_id    = new.produto_id,
          quantidade    = new.quantidade,
          registrado_em = new.registrado_em,
          observacao    = new.observacao
    where grupo_id = new.grupo_id and id <> new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_par_transferencia on estoque_movimentacoes;
create trigger trg_sync_par_transferencia
after update or delete on estoque_movimentacoes
for each row execute function public.sync_par_transferencia();

create or replace function public.mover_para_lojinha(
  p_produto_id uuid,
  p_quantidade integer,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo uuid := gen_random_uuid();
  v_obs   text := coalesce(nullif(trim(p_observacao), ''), 'Transferencia estoque - lojinha');
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero';
  end if;

  insert into estoque_movimentacoes
    (produto_id, tipo, quantidade, custo_unit, observacao, grupo_id)
  values
    (p_produto_id, 'saida_estoque',   p_quantidade, null, v_obs, v_grupo),
    (p_produto_id, 'entrada_lojinha', p_quantidade, null, v_obs, v_grupo);

  return v_grupo;
end;
$$;

grant execute on function public.mover_para_lojinha(uuid, integer, text) to anon, authenticated;

-- =====================================================================
-- 4. Contagens de inventario
-- =====================================================================

-- A divergencia deixa de ser um numero enviado pelo cliente
create or replace function public.calc_divergencia_contagem()
returns trigger
language plpgsql
as $$
begin
  new.divergencia := new.quantidade_contada - new.quantidade_sistema;
  return new;
end;
$$;

drop trigger if exists trg_calc_divergencia on inventario_contagens;
create trigger trg_calc_divergencia
before insert or update on inventario_contagens
for each row execute function public.calc_divergencia_contagem();

-- Editar a contagem no historico corrige o ajuste que ela gerou.
-- Excluir a contagem remove o ajuste pela cascata de contagem_id.
create or replace function public.sync_ajuste_contagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update estoque_movimentacoes
    set produto_id = new.produto_id,
        quantidade = new.divergencia,
        contexto   = new.contexto
  where contagem_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_ajuste_contagem on inventario_contagens;
create trigger trg_sync_ajuste_contagem
after update on inventario_contagens
for each row execute function public.sync_ajuste_contagem();
