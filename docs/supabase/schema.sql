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

alter table public.orcamentos add column if not exists status text not null default 'novo' check (status in ('novo','em_producao','finalizado','cancelado'));

-- Equipe interna (um perfil por usuário do Supabase Auth).
create table if not exists public.perfis (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text not null unique,
  nome      text not null,
  role      text not null check (role in ('admin_global','operacao')),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.promocoes (
  id             bigint generated always as identity primary key,
  titulo         text not null,
  subtitulo      text,
  badge          text,
  desconto_texto text,
  modalidade     text,
  cta_texto      text default 'Aproveitar',
  cta_link       text default 'orcamento.html',
  ativa          boolean not null default true,
  ordem          integer not null default 0,
  valida_ate     date,
  criado_em      timestamptz not null default now()
);

-- security definer: consultam perfis sem recursão nas políticas RLS.
create or replace function public.is_admin_global()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo and role = 'admin_global'
  );
$$;

create or replace function public.is_operacao()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and ativo and role in ('operacao','admin_global')
  );
$$;

revoke execute on function public.is_admin_global() from public, anon;
revoke execute on function public.is_operacao() from public, anon;
grant execute on function public.is_admin_global() to authenticated;
grant execute on function public.is_operacao() to authenticated;

-- Privilégios de tabela; quais linhas cada um acessa é decidido pelo RLS abaixo.
grant insert on public.orcamentos to anon, authenticated;
grant select, update on public.orcamentos to authenticated;
grant select, insert, update, delete on public.perfis to authenticated;
grant select on public.promocoes to anon;
grant select, insert, update, delete on public.promocoes to authenticated;

-- RLS · orcamentos: o site só insere; a equipe lê e atualiza.
alter table public.orcamentos enable row level security;

drop policy if exists "site insere orcamentos" on public.orcamentos;
create policy "site insere orcamentos" on public.orcamentos
  for insert to anon, authenticated with check (true);

drop policy if exists "operacao le orcamentos" on public.orcamentos;
create policy "operacao le orcamentos" on public.orcamentos
  for select to authenticated using (public.is_operacao());

drop policy if exists "operacao atualiza orcamentos" on public.orcamentos;
create policy "operacao atualiza orcamentos" on public.orcamentos
  for update to authenticated
  using (public.is_operacao()) with check (public.is_operacao());

-- RLS · perfis: cada um lê o próprio; o admin global gerencia todos.
alter table public.perfis enable row level security;

drop policy if exists "usuario le proprio perfil" on public.perfis;
create policy "usuario le proprio perfil" on public.perfis
  for select to authenticated using (auth.uid() = id);

drop policy if exists "admin gerencia perfis" on public.perfis;
create policy "admin gerencia perfis" on public.perfis
  for all to authenticated
  using (public.is_admin_global()) with check (public.is_admin_global());

-- RLS · promocoes: o público vê as ativas; a equipe gerencia todas.
alter table public.promocoes enable row level security;

drop policy if exists "publico le promocoes ativas" on public.promocoes;
create policy "publico le promocoes ativas" on public.promocoes
  for select to anon, authenticated using (ativa = true);

drop policy if exists "operacao gerencia promocoes" on public.promocoes;
create policy "operacao gerencia promocoes" on public.promocoes
  for all to authenticated
  using (public.is_operacao()) with check (public.is_operacao());

-- Primeiro admin: crie o usuário em Authentication › Users e rode (ajuste o e-mail):
-- insert into public.perfis (id, email, nome, role)
-- select id, email, 'Administrador Global', 'admin_global'
-- from auth.users where email = 'SEU_EMAIL';
