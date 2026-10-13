# Wyniki w Supabase i wznawianie przerwanej gry — projekt

Data: 2026-10-13

## Cel

1. Każda zakończona gra zapisuje wynik w bazie Supabase; w grze widać publiczną tabelę top 10.
2. Przerwaną grę (pauza albo zamknięcie/ukrycie karty) można wznowić później w tej samej przeglądarce.

Gra ma działać dalej bez sieci i bez Supabase — chmura jest dodatkiem, nie warunkiem rozgrywki.

## Decyzje

| Temat | Decyzja |
|---|---|
| Tożsamość gracza | Supabase anonymous sign-in — gracz rozpoznawany po przeglądarce, bez logowania |
| Wyniki | Publiczna tabela top 10 wszystkich graczy |
| Przerwanie gry | Spacja / Esc = pauza + zapis; ukrycie/zamknięcie karty = automatyczna pauza + zapis |
| Nick | Pytanie o nick, gdy wynik wchodzi do top 10; nick zapamiętany w `localStorage` |
| Integracja | `supabase-js` z CDN (wersja przypięta), bezpieczeństwo przez Row Level Security |
| Projekt Supabase | Istniejący projekt użytkownika („kacper08070605's Project”) |

Odrzucone: zwykły `fetch` bez biblioteki (ręczna obsługa sesji anonimowej), Edge Function walidująca
wyniki (osobny backend — za dużo jak na projekt szkoleniowy).

**Ograniczenie świadomie przyjęte:** klucz publiczny jest widoczny w przeglądarce, więc da się wysłać
zmyślony wynik. Baza ogranicza to do wyniku 0–397 (maks. możliwy na planszy 20×20) i zapisu tylko jako
własny użytkownik. Pełnej ochrony przed oszustwem nie ma.

## Baza danych

```sql
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
  with check (user_id = auth.uid());

-- saved_games: wyłącznie własny wiersz
create policy "saved_games_own" on public.saved_games for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Wynik zapisuje się zawsze (z ostatnio użytym nickiem albo „Anonim”); pytanie o nick pojawia się tylko,
gdy wynik wchodzi do top 10, i nadpisuje nick tego wiersza przed wysłaniem. Żeby to było możliwe bez
polityki `update`, wysyłka wyniku następuje dopiero po decyzji o nicku (patrz Przepływ).

Wymagana konfiguracja w panelu: **Authentication → Sign In / Providers → Allow anonymous sign-ins = ON**.

## Moduły

### `src/game.js` (czysta logika, testowana)

- Nowy status `'paused'` (obok `'start' | 'playing' | 'over'`).
- `pauseGame(state)` — `playing → paused`, w innych stanach bez zmian. Czyści `pendingDirections`.
- `resumeGame(state)` — `paused → playing`.
- `step` w stanie `paused` nic nie robi (jak dziś poza `playing`).
- `serializeGame(state)` — zwraca zwykły obiekt do JSON: `width, height, snake, direction, food, score`
  (bez funkcji `random`, bez bufora kierunków, bez `status`; prędkość wynika z wyniku).
- `restoreGame(data, { width, height, random })` — sprawdza dane (ten sam rozmiar planszy, segmenty
  w granicach planszy i bez powtórzeń, liczby całkowite, kierunek z listy, owoc poza wężem,
  wynik = długość węża − 3) i zwraca stan w statusie `'paused'` z `speedMs = speedForScore(score)`;
  przy błędnych danych zwraca `null`.

### `src/leaderboard.js` (czyste reguły tabeli, testowane)

- `qualifiesForTop(score, topScores, limit = 10)` — czy wynik > 0 zmieści się w top N (remis z ostatnim
  miejscem nie wystarcza, bo starszy wynik wygrywa).
- `cleanNickname(raw)` — przycina spacje i długość do 16 znaków (liczonych jak w Postgresie), pusty → „Anonim”.

### `src/config.js`

`SUPABASE_URL` i `SUPABASE_KEY` (klucz publiczny anon / publishable). Wartości są jawne z definicji,
plik trafia do repozytorium.

### `src/cloud.js` (jedyny moduł znający Supabase)

Ładuje `@supabase/supabase-js` z jsDelivr (przypięta wersja) **dynamicznie** (`await import(...)`
wewnątrz `initCloud`) — statyczny import z CDN zablokowałby całą grę, gdy CDN jest niedostępny.
Zapisy i usunięcia zapisanej gry idą po kolei (kolejka), żeby szybkie „pauza → nowa gra” nie
zostawiło w bazie starego zapisu.

- `initCloud()` — tworzy klienta; jeśli brak sesji, `signInAnonymously()`. Zwraca `true/false`.
- `loadSavedGame()` → `data | null`
- `saveGame(data)` — upsert wiersza w `saved_games`.
- `deleteSavedGame()`
- `submitScore(nickname, score)`
- `fetchTopScores(limit = 10)` → `[{ nickname, score }]`

Każda funkcja łapie błędy, loguje je do konsoli i zwraca wartość „pustą” (`false`, `null`, `[]`),
żeby `main.js` nie musiał obsługiwać wyjątków.

### `src/storage.js`

Bez zmian w rekordzie; dochodzą `loadNickname()` / `saveNickname(nick)` w `localStorage`.

### `src/input.js`

Dochodzi `onPause` dla Spacji i Esc (z `preventDefault`).

### `src/render.js`

- Nakładka pauzy: „Pauza”, „Spacja — wznów”.
- Odtworzona zapisana gra pokazuje tę samą nakładkę pauzy („Spacja — wznów”, „Enter — nowa gra”).
- Wznowienie usuwa zapis w chmurze (zapis istnieje tylko na czas przerwy).

### `index.html` / `style.css`

- Tabela „Najlepsi” (top 10) obok planszy, pod nią mały komunikat stanu („Brak połączenia z bazą”).
- Ukryty formularz nicku pod planszą (pole tekstowe 1–16 znaków + „Zapisz”), pokazywany po końcu gry.
  Podczas pisania w polu klawisze gry są ignorowane.

## Przepływ (`src/main.js`)

1. **Start strony:** rysuj grę od razu, równolegle `initCloud()` → `fetchTopScores()` i `loadSavedGame()`.
   Jeśli jest poprawny zapis (`restoreGame` ≠ `null`) i gracz jeszcze nie zaczął grać, gra przechodzi
   od razu do odtworzonego stanu w pauzie.
2. **Pauza (także po odtworzeniu zapisu):** Spacja/Esc → `resumeGame`; Enter → nowa gra (usuwa zapis
   w chmurze). Strzałki w pauzie są ignorowane.
3. **Gra:** Spacja/Esc → `pauseGame` + `saveGame(serializeGame(state))`.
4. **Ukrycie karty** (`visibilitychange` → `hidden`) w trakcie gry → pauza + zapis. To obejmuje też zamknięcie
   karty; wysyłka może się nie zdążyć przy natychmiastowym zamknięciu przeglądarki — akceptujemy to.
5. **Koniec gry:** `deleteSavedGame()`; rekord lokalny jak dziś. Wynik 0 nie jest wysyłany. Pobierz top 10:
   jeśli wynik wchodzi do top 10, pokaż formularz nicku (podpowiedź: zapamiętany nick), po „Zapisz” →
   `submitScore` → odśwież tabelę. W przeciwnym razie od razu `submitScore` z zapamiętanym nickiem lub „Anonim”.
   Enter w formularzu = zapis, Enter poza formularzem = nowa gra (jak dziś); jeśli formularz był otwarty,
   wynik i tak zostaje wysłany z zapamiętanym nickiem lub „Anonim”.

## Błędy i tryb offline

- Brak `config.js`, brak sieci, wyłączone anonimowe logowanie, błąd zapytania → gra działa jak dziś,
  komunikat „Brak połączenia z bazą”, tabela pusta, brak opcji wznowienia.
- Nieprawidłowy zapis w bazie (`restoreGame` zwraca `null`) → traktowany jak brak zapisu.

## Testy

- `tests/game.test.js`: pauza/wznowienie (w tym `step` w pauzie), bufor kierunków czyszczony przy pauzie,
  `serializeGame` → `restoreGame` daje równoważny stan, `restoreGame` odrzuca uszkodzone dane
  (wąż poza planszą, zły kierunek, owoc na wężu, brak pól).
- `cloud.js` i przepływ w `main.js`: test ręczny na żywej bazie (pauza → odświeżenie → wznowienie;
  koniec gry → wynik w tabeli; tryb offline).

## Zmiany w wymaganiach

`wymagania.md`: pauza przechodzi do zakresu; dochodzi Supabase (biblioteka z CDN — wyjątek od zasady
„bez zależności”, która dalej obowiązuje dla testów `node --test`), publiczna tabela top 10 i wznawianie gry.
