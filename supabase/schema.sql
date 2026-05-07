-- Enum de perfis
create type perfil_tipo as enum ('usuario', 'admin');

-- Enum de tipos de movimentação
create type movimentacao_tipo as enum (
  'entrada_estoque',
  'saida_estoque',
  'entrada_lojinha',
  'saida_lojinha'
);

-- Tabela de usuários
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  perfil perfil_tipo not null default 'usuario',
  senha_hash text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Tabela de produtos
create table produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco numeric(10,2) not null,
  categoria text not null,
  imagem_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Tabela de compras
create table compras (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id),
  produto_id uuid not null references produtos(id),
  quantidade integer not null,
  preco_unit numeric(10,2) not null,
  comprado_em timestamptz not null default now()
);

-- Tabela de movimentações de estoque
create table estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id),
  tipo movimentacao_tipo not null,
  quantidade integer not null,
  custo_unit numeric(10,2),
  observacao text,
  registrado_em timestamptz not null default now()
);

-- RLS: habilitar para todas as tabelas
alter table usuarios enable row level security;
alter table produtos enable row level security;
alter table compras enable row level security;
alter table estoque_movimentacoes enable row level security;

-- Políticas permissivas para uso com anon key (app interno, sem auth)
-- Em produção considere políticas mais restritivas
create policy "allow_all_usuarios" on usuarios for all using (true) with check (true);
create policy "allow_all_produtos" on produtos for all using (true) with check (true);
create policy "allow_all_compras" on compras for all using (true) with check (true);
create policy "allow_all_movimentacoes" on estoque_movimentacoes for all using (true) with check (true);

-- Seed dos produtos iniciais
insert into produtos (nome, preco, categoria) values
  ('Red Bull 250ml', 10.00, 'bebida'),
  ('Red Bull 473ml', 15.00, 'bebida'),
  ('Água c/ Gás', 2.00, 'bebida'),
  ('Refri 200ml', 2.50, 'bebida'),
  ('Água de coco 250ml', 6.00, 'bebida'),
  ('Suco laranja 250ml', 5.00, 'bebida'),
  ('Suco uva 250ml', 5.00, 'bebida'),
  ('Barrinha Pinati', 8.00, 'snack'),
  ('Barrinha NUTS', 8.00, 'snack'),
  ('Bold 40g', 12.00, 'snack'),
  ('Bold 60g', 15.50, 'snack'),
  ('Ovinho', 5.00, 'snack'),
  ('EQLIBRI', 5.00, 'snack'),
  ('Trento', 3.00, 'doce'),
  ('Baton', 2.00, 'doce'),
  ('Bubbaloo', 0.75, 'doce'),
  ('Talento 25g', 3.50, 'doce'),
  ('Geladinho americano', 1.00, 'doce'),
  ('Lacta ao leite 20g', 3.00, 'doce'),
  ('Prestígio', 3.00, 'doce'),
  ('Paçoquita', 1.00, 'doce'),
  ('Trident X', 15.00, 'chiclete'),
  ('Mentos Pure', 20.00, 'chiclete');

-- Admin seed (senha: admin123)
-- Hash bcrypt de "admin123": $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
insert into usuarios (nome, perfil, senha_hash) values
  ('Admin', 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- Bucket de storage para imagens de produtos
-- Execute no dashboard do Supabase → Storage → New bucket: "produtos" (public)

-- Adicionar valor ao enum de movimentações
alter type movimentacao_tipo add value 'ajuste_inventario';

-- Tabela de contagens de inventário
create table inventario_contagens (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(id),
  quantidade_sistema integer not null,
  quantidade_contada integer not null,
  divergencia integer not null,
  ajuste_confirmado boolean not null default false,
  contado_em timestamptz not null default now(),
  admin_id uuid references usuarios(id)
);

alter table inventario_contagens enable row level security;
create policy "allow_all_inventario" on inventario_contagens for all using (true) with check (true);
