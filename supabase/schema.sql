-- =====================================================================
--  Spartöpfe – Datenbank-Schema für Supabase
--  Einmalig im Supabase-Dashboard unter "SQL Editor" ausführen.
--  Das Skript kann gefahrlos erneut ausgeführt werden.
-- =====================================================================

-- ---------- Tabellen ----------
create table if not exists public.pots (
  id          int primary key,
  name        text not null,
  bank        text not null,
  color       text not null,                 -- Akzentfarbe des Topfes
  text_color  text not null,                 -- dunklere Textfarbe
  ring_color  text not null default '#829B72', -- Farbe des Fortschrittsrings
  goal        numeric(12,2) check (goal is null or goal > 0),  -- Sparziel (optional)
  sort        int not null default 0
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  pot_id      int not null references public.pots(id) on delete restrict,
  type        text not null check (type in ('in','out')),   -- in = Einzahlung, out = Auszahlung
  amount      numeric(12,2) not null check (amount > 0),
  date        date not null default current_date,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null
);

create index if not exists transactions_pot_idx  on public.transactions(pot_id);
create index if not exists transactions_date_idx on public.transactions(date);

-- ---------- Zugriffsschutz (Row Level Security) ----------
-- Nur angemeldete Nutzer (ihr beide) dürfen lesen und schreiben.
-- Ohne Anmeldung ist nichts sichtbar.
alter table public.pots         enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "pots_select" on public.pots;
drop policy if exists "pots_update" on public.pots;
drop policy if exists "tx_select"   on public.transactions;
drop policy if exists "tx_insert"   on public.transactions;
drop policy if exists "tx_delete"   on public.transactions;

create policy "pots_select" on public.pots         for select to authenticated using (true);
create policy "pots_update" on public.pots         for update to authenticated using (true) with check (true);
create policy "tx_select"   on public.transactions for select to authenticated using (true);
create policy "tx_insert"   on public.transactions for insert to authenticated with check (true);
create policy "tx_delete"   on public.transactions for delete to authenticated using (true);

-- ---------- Die 11 Spartöpfe ----------
insert into public.pots (id, name, bank, color, text_color, ring_color, sort) values
  ( 1, 'Notgroschen',             'Trade Republic',     '#829B72', '#405B43', '#405B43',  1),
  ( 2, 'Urlaub',                  'Trade Republic',     '#86A9B8', '#3E6475', '#5E8A5E',  2),
  ( 3, 'Ausflüge',                'Haspa',              '#C7AA69', '#7A6230', '#829B72',  3),
  ( 4, 'Kleidung',                'Haspa',              '#D49A72', '#8A5134', '#6E9E86',  4),
  ( 5, 'Taschengeld',             'Blaue Geldkassette', '#A88DB0', '#5E4C6E', '#94AE6E',  5),
  ( 6, 'Autoversicherung',        'Trade Republic',     '#95A39B', '#4E5B54', '#7FA38A',  6),
  ( 7, 'TÜV + Service',           'Trade Republic',     '#7FA89A', '#3F6457', '#5E8A5E',  7),
  ( 8, 'Weihnachten',             'ING',                '#C98F94', '#7E4148', '#A8B99A',  8),
  ( 9, 'Krötenwanderung',         'ING',                '#A3B56E', '#56662C', '#829B72',  9),
  (10, 'Rauchen',                 'ING',                '#B09A84', '#64503E', '#6E9E86', 10),
  (11, 'Essen (Mastercard-Bons)', 'ING',                '#8E9CC7', '#48557F', '#405B43', 11)
on conflict (id) do nothing;

-- ---------- Live-Abgleich zwischen Handy und Tablet ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.transactions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.pots;
  exception when duplicate_object then null;
  end;
end $$;
