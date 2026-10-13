-- Schemat bazy Supabase dla gry „Wąż bez Granic”.
-- Wyniki (publiczna tabela top 10) i zapisane gry do wznowienia.
-- Gracze logują się anonimowo (Authentication → Allow anonymous sign-ins = ON).

create table public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 16),
  score      integer not null check (score between 0 and 397),
  created_at timestamptz not null default now()
);
create index scores_score_idx on public.scores (score desc, created_at asc);

create table public.saved_games (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.scores enable row level security;
alter table public.saved_games enable row level security;

-- scores: czytają wszyscy, dodaje się tylko jako siebie, bez edycji i usuwania
create policy "scores_select_all" on public.scores for select using (true);
create policy "scores_insert_own" on public.scores for insert to authenticated
  with check (user_id = (select auth.uid()));

-- saved_games: wyłącznie własny wiersz
create policy "saved_games_own" on public.saved_games for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Konta graczy: profil z loginem, podpis wyniku loginem, statystyki.

create table public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- profiles: loginy widzą wszyscy; profil zakłada się tylko sobie, tylko z konta (nie jako gość)
-- i tylko z loginem zgodnym z technicznym e-mailem konta. Bez zmiany i usuwania.
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
    and (select auth.jwt()) ->> 'email' = username || '@gracze.waz-bez-granic.app'
  );

-- Wynik zalogowanego zawsze podpisany jego loginem (nie da się podpisać cudzym loginem z konta).
create function public.scores_use_username() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  account_name text;
begin
  select username into account_name from public.profiles where user_id = new.user_id;
  if account_name is not null then
    new.nickname := account_name;
  end if;
  return new;
end $$;
create trigger scores_use_username before insert on public.scores
  for each row execute function public.scores_use_username();

-- Statystyki zalogowanego gracza: najlepszy wynik i liczba rozegranych gier.
create function public.my_stats() returns table (best_score integer, games_played bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(max(score), 0), count(*) from public.scores where user_id = (select auth.uid())
$$;
