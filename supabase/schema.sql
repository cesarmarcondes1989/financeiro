-- Schema do sistema financeiro
-- Execute este arquivo no SQL Editor do Supabase (https://supabase.com/dashboard -> SQL Editor)

create extension if not exists "pgcrypto";

-- Transações de cartão de crédito (importadas de Excel, PDF de fatura ou manuais)
create table if not exists transacoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  descricao text not null,
  valor numeric(12,2) not null,
  categoria text not null default 'Outros',
  origem text not null default 'manual', -- excel | pdf | nfce | manual
  cartao text,
  parcela text,
  criado_em timestamptz not null default now(),
  unique (data, descricao, valor)
);

-- Notas fiscais (NFC-e) registradas via QR Code
create table if not exists notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  chave_acesso text unique not null,
  url_consulta text,
  emitente_cnpj text,
  emitente_nome text,
  municipio text,
  numero text,
  serie text,
  uf text,
  data_emissao timestamptz,
  valor_total numeric(12,2),
  criado_em timestamptz not null default now()
);

-- Itens de cada nota fiscal
create table if not exists itens_nota (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references notas_fiscais(id) on delete cascade,
  descricao text not null,
  quantidade numeric(12,3) not null default 1,
  valor_unitario numeric(12,2),
  valor_total numeric(12,2) not null,
  categoria text not null default 'Outros'
);

-- Eventos de gamificação (pontos ganhos por ações)
create table if not exists eventos_gamificacao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  pontos int not null,
  descricao text,
  criado_em timestamptz not null default now()
);

-- Metas de gasto mensal por categoria
create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  categoria text unique not null,
  limite_mensal numeric(12,2) not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_transacoes_data on transacoes (data);
create index if not exists idx_transacoes_categoria on transacoes (categoria);
create index if not exists idx_itens_nota_nota on itens_nota (nota_id);

-- O app acessa o banco apenas pelo servidor com a service_role key,
-- portanto habilitamos RLS e não criamos policies públicas:
alter table transacoes enable row level security;
alter table notas_fiscais enable row level security;
alter table itens_nota enable row level security;
alter table eventos_gamificacao enable row level security;
alter table metas enable row level security;
