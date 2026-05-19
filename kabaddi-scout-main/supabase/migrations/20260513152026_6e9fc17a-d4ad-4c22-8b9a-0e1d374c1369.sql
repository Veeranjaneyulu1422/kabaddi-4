
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  team_name text,
  position text,
  district text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Matches
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_a text not null,
  team_b text not null,
  tournament text,
  match_date date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.matches enable row level security;
create policy "matches_owner_all" on public.matches for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Players
create table public.players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  name text not null,
  team text not null check (team in ('A','B')),
  created_at timestamptz not null default now()
);
alter table public.players enable row level security;
create policy "players_owner_all" on public.players for all
  using (exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid()));

-- Match events
create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  event_type text not null,
  event_time timestamptz not null default now(),
  x_coord numeric,
  y_coord numeric,
  points integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.match_events enable row level security;
create policy "events_owner_all" on public.match_events for all
  using (exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid()));

create index match_events_match_id_idx on public.match_events(match_id);
create index match_events_player_id_idx on public.match_events(player_id);
create index players_match_id_idx on public.players(match_id);
create index matches_user_id_idx on public.matches(user_id);
