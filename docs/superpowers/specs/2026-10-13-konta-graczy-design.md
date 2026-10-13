# Konta graczy (login + hasło + profil) — projekt

Data: 2026-10-13
Poprzedni etap: `2026-10-13-supabase-wyniki-wznowienie-design.md` (anonimowi gracze, zapis gry, top 10).

## Cel

Gracz może założyć konto (login + hasło) i logować się nim w dowolnej przeglądarce. Konto ma profil
z nazwą i statystykami; zapisana gra i wyniki są przypięte do konta. Gra bez logowania działa jak dotąd.

## Decyzje

| Temat | Decyzja |
|---|---|
| Logowanie | Nazwa użytkownika + hasło; pod spodem techniczny e-mail `<login>@gracze.waz-bez-granic.app`, bez wysyłania maili |
| Potwierdzanie maila | Wyłączone w Supabase (Authentication → Email → Confirm email = OFF) |
| Gość | Dozwolony (jak dziś, anonimowy użytkownik Supabase) |
| Rejestracja | Zamienia bieżącego gościa w konto (`updateUser`) — to samo ID, zachowane zapis i wyniki |
| Profil | Login, najlepszy wynik, liczba rozegranych gier |
| Tabela top 10 | Zalogowany zawsze pod loginem (bez pytania o nick); gość wpisuje nick jak dotąd |
| Reset hasła | Brak (świadome ograniczenie — nie ma prawdziwego maila) |

## Zasady loginu i hasła

- Login: `^[a-z0-9_]{3,16}$` (wpisany tekst jest przycinany ze spacji i zamieniany na małe litery).
- Hasło: co najmniej 6 znaków (minimum Supabase).
- E-mail techniczny: `${login}@gracze.waz-bez-granic.app`.

## Baza (dopisane do `supabase/schema.sql`)

```sql
create table public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,16}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
-- Profil tylko z konta (nie jako gość) i tylko z loginem zgodnym z e-mailem konta —
-- inaczej gość mógłby zająć cudzy login (poprawka po recenzji).
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

-- Statystyki zalogowanego gracza.
create function public.my_stats() returns table (best_score integer, games_played bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(max(score), 0), count(*) from public.scores where user_id = (select auth.uid())
$$;
```

Zmiana zachowania wyników: wysyłany jest **każdy** wynik, także 0 (liczba gier = liczba wierszy w `scores`).
Tabela top 10 pobiera tylko `score > 0`.

## Moduły

### `src/account.js` (czyste reguły, testowane)

- `normalizeUsername(raw) → string` — trim + małe litery.
- `validateUsername(username) → string | null` — komunikat błędu albo `null`.
- `validatePassword(password) → string | null`.
- `usernameToEmail(username) → string`.
- `describeAuthError(error) → string` — zamienia błędy Supabase na polskie komunikaty
  (zły login/hasło, login zajęty, za dużo prób, brak połączenia; inne → ogólny komunikat).

### `src/cloud.js`

- `register(username, password) → { ok, error }` — `updateUser({ email, password })` bieżącego gościa,
  potem `insert` do `profiles`. Zajęty login: Supabase zwraca błąd „email już użyty” przy `updateUser`.
- `logIn(username, password) → { ok, error }` — `signInWithPassword`; ustawia nowe `userId`.
- `logOut() → boolean` — `signOut`, potem `signInAnonymously` (nowy gość).
- `fetchProfile() → { username } | null` — profil bieżącego użytkownika (gość → `null`).
- `fetchMyStats() → { bestScore, gamesPlayed } | null` — `rpc('my_stats')`.
- `fetchTopScores` filtruje `score > 0`.

### `src/account-panel.js` (DOM panelu)

`setupAccountPanel({ onLogIn, onRegister, onLogOut })` zwraca `{ showGuest(), showAccount(profile, stats), showError(text), setBusy(flag) }`.
Formularz: login, hasło, przyciski „Zaloguj” i „Załóż konto”; po zalogowaniu: nazwa, statystyki, „Wyloguj”.

### `src/main.js`

- Po `initCloud`: `refreshAccount()` (profil + statystyki → panel).
- Rejestracja: bez przerywania gry; po sukcesie `refreshAccount()`.
- Logowanie / wylogowanie: zatrzymaj grę, stan → nowa gra (`start`), formularz nicku ukryty
  i porzucony wynik wysłany jak dziś; potem wczytaj zapis nowego użytkownika (jak przy starcie strony),
  `refreshAccount()`, `refreshLeaderboard()`.
- Koniec gry: zalogowany → wynik wysyłany od razu (bez formularza); gość → jak dotąd. Wynik 0 też jest wysyłany.
  Po wysłaniu `refreshAccount()` (statystyki).

### `index.html` / `style.css`

Panel „Konto” nad tabelą „Najlepsi”, w tym samym stylu (ciemny panel). Klawisze gry są ignorowane
podczas pisania w formularzu (obecna reguła `closest('form')`).

## Błędy

- Brak połączenia z bazą → panel konta ukryty za komunikatem „Konta niedostępne bez połączenia z bazą”.
- Błędy logowania/rejestracji → komunikat w panelu, gra działa dalej.

## Ograniczenia (świadome)

- Brak resetu hasła.
- Gość może wpisać nick równy czyjemuś loginowi.
- Zapis gry gościa przepada po zalogowaniu na **inne, istniejące** konto (zostaje przy porzuconym gościu).

## Testy

- `tests/account.test.js`: reguły loginu/hasła, e-mail techniczny, tłumaczenie błędów.
- Skrypt w przeglądarce na żywej bazie: rejestracja gościa z zapisaną grą (zapis zostaje), statystyki,
  wynik pod loginem, zajęty login, złe hasło, wylogowanie → nowy gość, logowanie w drugim profilu przeglądarki
  → odtworzenie zapisu konta, próba podpisania wyniku cudzym loginem z konta → podpis = własny login.
