create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  client_id text not null,
  name text not null,
  home_score integer not null check (home_score >= 0 and home_score <= 20),
  away_score integer not null check (away_score >= 0 and away_score <= 20),
  created_at timestamptz not null default now(),
  unique (match_id, client_id)
);

alter table public.predictions enable row level security;

drop policy if exists "Anyone can read predictions" on public.predictions;
create policy "Anyone can read predictions"
on public.predictions
for select
using (true);

drop policy if exists "Anyone can insert predictions" on public.predictions;
create policy "Anyone can insert predictions"
on public.predictions
for insert
with check (true);

drop policy if exists "Anyone can update predictions" on public.predictions;
create policy "Anyone can update predictions"
on public.predictions
for update
using (true)
with check (true);

drop policy if exists "Anyone can delete predictions" on public.predictions;
create policy "Anyone can delete predictions"
on public.predictions
for delete
using (true);
