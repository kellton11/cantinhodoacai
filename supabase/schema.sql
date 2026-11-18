-- =====================================================================
--  Cantinho do Açaí – banco de dados (Supabase / PostgreSQL)
--  Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
--  Pode ser executado mais de uma vez (e também serve para atualizar
--  um banco criado com a versão anterior do sistema).
-- =====================================================================

-- Configurações (sempre uma única linha, id = 1)
create table if not exists public.settings (
  id           int primary key default 1 check (id = 1),
  price_per_kg numeric(10,2) not null default 49.90,
  baud         int           not null default 9600,
  unit         text          not null default 'kg' check (unit in ('kg','g')),
  acai_stock_id uuid,
  pass_hash    text          not null default '',
  locked_tabs  text[]        not null default '{relatorios,produtos,despesas}'
);

create table if not exists public.stock_items (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  qty        numeric(12,3) not null default 0,
  unit       text not null default 'un',
  min_qty    numeric(12,3) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.settings
  drop constraint if exists settings_acai_stock_fk,
  add  constraint settings_acai_stock_fk
  foreign key (acai_stock_id) references public.stock_items(id) on delete set null;

create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  price      numeric(10,2) not null default 0,
  stock_id   uuid references public.stock_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  need       text not null default '',
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

-- Caixa do dia (aberto enquanto closed_at for nulo)
create table if not exists public.cash_sessions (
  id        uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  opening   numeric(10,2) not null default 0,
  moves     jsonb not null default '[]'::jsonb,
  closed_at timestamptz,
  counted   numeric(10,2)
);

create table if not exists public.sales (
  id       uuid primary key default gen_random_uuid(),
  cash_id  uuid references public.cash_sessions(id) on delete set null,
  sold_at  timestamptz not null default now(),
  items    jsonb not null,
  total    numeric(10,2) not null,
  pay      text not null check (pay in ('Dinheiro','Pix','Cartão')),
  received numeric(10,2) not null default 0
);

create index if not exists sales_sold_at_idx on public.sales (sold_at);
create index if not exists sales_cash_id_idx on public.sales (cash_id);

-- Despesas (aluguel, luz, fornecedores...)
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  spent_on    date not null default current_date,
  category    text not null default 'Outros',
  description text not null default '',
  amount      numeric(10,2) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on);

-- ---------------------------------------------------------------------
--  Campos da versão 2: custo, lucro, desconto, cancelamento, backup
-- ---------------------------------------------------------------------
alter table public.settings add column if not exists acai_cost_per_kg numeric(10,2) not null default 0;
alter table public.settings add column if not exists auto_backup      boolean       not null default true;
alter table public.settings add column if not exists last_backup_at   timestamptz;

alter table public.products add column if not exists cost numeric(10,2) not null default 0;

alter table public.sales add column if not exists subtotal    numeric(10,2);
alter table public.sales add column if not exists discount    numeric(10,2) not null default 0;
alter table public.sales add column if not exists cost        numeric(10,2) not null default 0;
alter table public.sales add column if not exists voided_at   timestamptz;
alter table public.sales add column if not exists void_reason text not null default '';

-- Vendas antigas: subtotal = total
update public.sales set subtotal = total where subtotal is null;

-- Garante a linha de configurações
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Quem já protegia Relatórios passa a proteger Despesas também
update public.settings
   set locked_tabs = array_append(locked_tabs, 'despesas')
 where 'relatorios' = any(locked_tabs) and not ('despesas' = any(locked_tabs));

-- ---------------------------------------------------------------------
--  Segurança (RLS): só quem fez login pode ler e gravar.
--  Crie seu usuário em Authentication > Users e DESLIGUE o cadastro
--  aberto em Authentication > Sign In / Providers (Allow new users to sign up).
-- ---------------------------------------------------------------------
alter table public.settings       enable row level security;
alter table public.stock_items    enable row level security;
alter table public.products       enable row level security;
alter table public.shopping_items enable row level security;
alter table public.cash_sessions  enable row level security;
alter table public.sales          enable row level security;
alter table public.expenses       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','stock_items','products','shopping_items','cash_sessions','sales','expenses'] loop
    execute format('drop policy if exists "acesso logado" on public.%I', t);
    execute format(
      'create policy "acesso logado" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
