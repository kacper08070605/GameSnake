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
