-- JP Sport · tabelas do Supabase
-- Rode no Supabase › SQL Editor.

create table if not exists public.orcamentos (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  time        text not null,
  cidade      text,
  responsavel text not null,
  modalidade  text not null check (modalidade in ('futebol','basquete','volei')),
  kit_completo boolean not null default false,
  grade       jsonb not null,          -- {"P":0,"M":5,...}
  total_pecas integer not null,
  estimativa  numeric(10,2),
  prazo       date,
  observacoes text,
  projeto_3d  jsonb                     -- gola, cores, estampa vindos do simulador
);

alter table public.orcamentos enable row level security;

-- O site (chave publishable / papel anon) só pode INSERIR; ninguém lê pelo navegador.
drop policy if exists "site insere orcamentos" on public.orcamentos;
create policy "site insere orcamentos" on public.orcamentos
  for insert to anon with check (true);
