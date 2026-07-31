-- Saldo passa a ser somado no banco.
--
-- As telas baixavam a tabela inteira de movimentacoes para somar no navegador.
-- O PostgREST corta a resposta em 1000 linhas, entao quando estoque_movimentacoes
-- passou de 1000 registros as movimentacoes mais recentes sumiram da conta: uma
-- transferencia de 30 unidades de Baton nao aparecia, e o saldo exibido era 2 em
-- vez de 12.
--
-- A view devolve uma linha por produto, entao nao ha o que truncar. E de quebra o
-- app deixa de baixar ~1200 linhas a cada carregamento de tela.

create or replace view public.saldos_produtos
with (security_invoker = on) as
select
  p.id as produto_id,
  coalesce(sum(case
    when m.tipo = 'entrada_estoque' then  m.quantidade
    when m.tipo = 'saida_estoque'   then -m.quantidade
    when m.tipo = 'ajuste_inventario'
     and coalesce(m.contexto,
           case when m.observacao like '%[lojinha]%' then 'lojinha' else 'estoque' end) = 'estoque'
    then m.quantidade
    else 0
  end), 0)::int as saldo_estoque,
  coalesce(sum(case
    when m.tipo = 'entrada_lojinha' then  m.quantidade
    when m.tipo = 'saida_lojinha'   then -m.quantidade
    when m.tipo = 'ajuste_inventario'
     and coalesce(m.contexto,
           case when m.observacao like '%[lojinha]%' then 'lojinha' else 'estoque' end) = 'lojinha'
    then m.quantidade
    else 0
  end), 0)::int as saldo_lojinha
from public.produtos p
left join public.estoque_movimentacoes m on m.produto_id = p.id
group by p.id;

grant select on public.saldos_produtos to anon, authenticated;

create index if not exists idx_mov_produto_id on public.estoque_movimentacoes(produto_id);
