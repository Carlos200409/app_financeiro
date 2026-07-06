-- Multi-tenant: finance_data por usuário + phone_links + RLS por auth.uid().
-- Modelo mínimo (ponytail): o JSON continua igual, só passa a ser 1 linha por
-- usuário em vez da linha única id=1. RLS garante isolamento no browser; o
-- caminho service-role (WhatsApp/cron) impõe o escopo no código.
--
-- ⚠️ ANTES DE RODAR: backup do dado atual (Supabase → Table Editor →
--    finance_data → export, ou o script scripts/backup-data.ts).
-- ⚠️ SUBSTITUA os 2 placeholders <SEU_AUTH_UID> e <SEU_TELEFONE_NORMALIZADO>.
--    Seu auth uid: Supabase → Authentication → Users → seu usuário → User UID.
--    Telefone normalizado: sem 55 e sem o 9 (ex: 47 98436-7844 → 4784367844).

-- 1. Coluna de dono na tabela existente.
alter table public.finance_data
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists finance_data_user_id_key on public.finance_data(user_id);

-- 2. Adota o dado que já existe (a linha id=1) pra SUA conta.
update public.finance_data
  set user_id = '<SEU_AUTH_UID>'
  where id = 1 and user_id is null;

-- 3. RLS por dono — substitui a policy antiga so_logado (que liberava a tabela
--    inteira pra qualquer logado).
alter table public.finance_data enable row level security;
drop policy if exists so_logado on public.finance_data;
drop policy if exists finance_owner on public.finance_data;
create policy finance_owner on public.finance_data
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. Mapa telefone → usuário (o bot descobre de quem é a mensagem que chega).
create table if not exists public.phone_links (
  phone text primary key,      -- forma canônica (sem 55, sem 9): lib/phone.ts normBR
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.phone_links enable row level security;
drop policy if exists phone_owner on public.phone_links;
create policy phone_owner on public.phone_links
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Códigos de vínculo — onboarding do WhatsApp: o app gera um código, o
--    usuário manda pro bot do próprio número (prova posse), o bot cria o link.
create table if not exists public.link_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.link_codes enable row level security;
drop policy if exists linkcode_owner on public.link_codes;
create policy linkcode_owner on public.link_codes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 6. Vincula o SEU telefone agora (ou use o fluxo por código no app depois).
insert into public.phone_links(phone, user_id)
  values ('<SEU_TELEFONE_NORMALIZADO>', '<SEU_AUTH_UID>')
  on conflict (phone) do nothing;
