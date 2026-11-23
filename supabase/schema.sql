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
drop policy if exists "tx_update"   on public.transactions;

create policy "pots_select" on public.pots         for select to authenticated using (true);
create policy "pots_update" on public.pots         for update to authenticated using (true) with check (true);
create policy "tx_select"   on public.transactions for select to authenticated using (true);
create policy "tx_insert"   on public.transactions for insert to authenticated with check (true);
create policy "tx_delete"   on public.transactions for delete to authenticated using (true);
create policy "tx_update"   on public.transactions for update to authenticated using (true) with check (true);

-- ---------- Die Spartöpfe ----------
-- (Icons ordnet die App anhand des Namens zu, siehe ICON_RULES in website/app.js)
insert into public.pots (id, name, bank, color, text_color, ring_color, sort) values
  ( 1, 'Notgroschen',             'Trade Republic',     '#7FA06A', '#4E6B3A', '#7FA06A',  1),
  ( 2, 'Urlaub',                  'Trade Republic',     '#9BAEB0', '#4F6466', '#9BAEB0',  2),
  ( 3, 'Ausflüge',                'Haspa',              '#C9A54E', '#7A5E1E', '#C9A54E',  3),
  ( 4, 'Kleidung',                'Haspa',              '#E39A6B', '#A4552C', '#E39A6B',  4),
  ( 5, 'Taschengeld Sandra',      'Blaue Geldkassette', '#C4A7C9', '#6E4B73', '#C4A7C9',  5),
  (15, 'Taschengeld Dennis',      'Blaue Geldkassette', '#A9B6C2', '#55626E', '#A9B6C2',  6),
  ( 6, 'Autoversicherung',        'Trade Republic',     '#B3AA86', '#6A6244', '#B3AA86',  7),
  ( 7, 'TÜV + Service',           'Trade Republic',     '#A6A35A', '#646130', '#A6A35A',  8),
  (12, 'Fabio KFO',               'Trade Republic',     '#8FB8C9', '#3F6A7C', '#8FB8C9',  9),
  ( 8, 'Weihnachten',             'ING',                '#D08C86', '#8E4A45', '#D08C86', 10),
  ( 9, 'Krötenwanderung',         'ING',                '#C3C46E', '#6C6D2C', '#C3C46E', 11),
  (10, 'Rauchen',                 'ING',                '#E2B48C', '#9A6438', '#E2B48C', 12),
  (11, 'Essen (Mastercard-Bons)', 'ING',                '#C79AB5', '#7E4E6A', '#C79AB5', 13),
  (14, 'Fun Pocket Sandra',       'ING',                '#E0A3B8', '#8C4A62', '#E0A3B8', 14),
  (13, 'Fun Pocket Dennis',       'ING',                '#8FA8D6', '#44598A', '#8FA8D6', 15)
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
