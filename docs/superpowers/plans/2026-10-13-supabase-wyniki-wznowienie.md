# Wyniki w Supabase i wznawianie gry — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pauza z zapisem gry w Supabase (wznawianie po powrocie) oraz publiczna tabela top 10 wyników.

**Architecture:** Czysta logika (`game.js`, nowy `leaderboard.js`) dostaje pauzę, serializację stanu i reguły
tabeli — wszystko testowane `node --test`. Jedynym modułem znającym Supabase jest nowy `cloud.js`
(dynamiczny import `supabase-js` z CDN, anonimowe logowanie, funkcje zwracające wartości „puste” przy błędzie).
`main.js` spina przepływ: pauza/autozapis, odtworzenie zapisu przy starcie, wysyłka wyniku i formularz nicku.

**Tech Stack:** JavaScript (moduły ES), Canvas 2D, `@supabase/supabase-js@2.45.4` z jsDelivr (`+esm`),
Supabase (Postgres + RLS + anonymous auth), testy `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-13-supabase-wyniki-wznowienie-design.md`

## Global Constraints

- Plansza 20×20; maksymalny wynik 397; nick 1–16 znaków; domyślny nick `Anonim`; tabela top 10.
- Projekt Supabase: URL `https://dhluvtmrtxavdzkxvlfl.supabase.co`, klucz `sb_publishable_BHiK8bjjpzuprVMbvEcaZA_PPe2zwR-`.
- Schemat bazy już założony (`supabase/schema.sql`), anonimowe logowanie włączone — plan nie zmienia bazy.
- `node --test` bez instalowania zależności; testowane moduły nie mogą importować CDN ani używać `window`.
- Gra musi działać bez sieci / bez Supabase (komunikat „Brak połączenia z bazą…”).
- Bez npm, bundlera; GitHub Pages z gałęzi `master`, katalog główny.
- Komendy git (commit/push) tylko za wyraźną zgodą użytkownika — kroki „Commit” wykonuje się zbiorczo na końcu, po zgodzie.
- Nazwy w kodzie po angielsku, komentarze po polsku, styl jak w istniejącym kodzie.

## Review Focus

1. **CDN niedostępny / zablokowany** → gra ładuje się i działa; tylko chmura jest wyłączona. Pokrywa to dynamiczny import w `cloud.js` (Task 3) i test ręczny offline (Task 5).
2. **Nick z HTML-em (`<img onerror=…>`)** → wyświetla się jako zwykły tekst, nic się nie wykonuje. `refreshLeaderboard` używa `textContent` (Task 4) + test ręczny (Task 5).
3. **Enter (nowa gra) zanim wróci odpowiedź top 10** → formularz nicku nie pojawia się w nowej grze, wynik idzie z domyślnym nickiem. Pokrywa to sprawdzenie `state.status` po `await` w `handleFinalScore` (Task 4).
4. **Zmanipulowany zapis w bazie** (wąż poza planszą, zły kierunek, wynik niezgodny z długością) → traktowany jak brak zapisu. Testy w Task 1.
5. **Szybkie „pauza → Enter”** → w bazie nie zostaje stary zapis. Pokrywa to kolejka zapisów w `cloud.js` (Task 3) + test ręczny (Task 5).

---

## Struktura plików

| Plik | Zmiana | Odpowiedzialność |
|---|---|---|
| `src/game.js` | modyfikacja | + `pauseGame`, `resumeGame`, `serializeGame`, `restoreGame` |
| `src/leaderboard.js` | nowy | `qualifiesForTop`, `cleanNickname` (czyste reguły) |
| `src/config.js` | nowy | URL i klucz publiczny Supabase |
| `src/cloud.js` | nowy | jedyny moduł znający Supabase |
| `src/storage.js` | modyfikacja | + `loadNickname`, `saveNickname` |
| `src/input.js` | modyfikacja | + `onPause` (Spacja/Esc), ignorowanie klawiszy w formularzu |
| `src/render.js` | modyfikacja | nakładka pauzy, podpowiedź o pauzie na starcie |
| `src/main.js` | modyfikacja | przepływ pauzy, zapisu, wyników, formularza |
| `index.html`, `style.css` | modyfikacja | tabela „Najlepsi”, status chmury, formularz nicku |
| `tests/game.test.js` | modyfikacja | testy pauzy i zapisu |
| `tests/leaderboard.test.js` | nowy | testy reguł tabeli |
| `wymagania.md`, `README.md` | modyfikacja | dokumentacja nowych funkcji |

---

### Task 1: Pauza i zapis stanu w `game.js`

**Files:**
- Modify: `src/game.js` (komentarz statusu w `createGame`, nowe funkcje po `startGame`, pomocnicze na końcu pliku)
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: istniejące `DIRECTIONS`, `speedForScore`, `isSamePosition`.
- Produces:
  - `pauseGame(state) → state` (`playing → paused`, czyści `pendingDirections`)
  - `resumeGame(state) → state` (`paused → playing`)
  - `serializeGame(state) → { width, height, snake, direction, food, score }`
  - `restoreGame(data, { width = 20, height = 20, random }) → state | null` (status `'paused'`)

- [ ] **Step 1: Dopisz testy na końcu `tests/game.test.js`**

Zmień import na górze pliku:

```js
import {
  createGame,
  startGame,
  changeDirection,
  step,
  pauseGame,
  resumeGame,
  serializeGame,
  restoreGame,
} from '../src/game.js';
```

Dopisz na końcu pliku:

```js
const BOARD = { width: 20, height: 20, random: alwaysFirst };

test('11. pauza zatrzymuje grę, a wznowienie ją przywraca', () => {
  const paused = pauseGame(playingGame());

  assert.equal(paused.status, 'paused');
  assert.equal(step(paused), paused);
  assert.equal(resumeGame(paused).status, 'playing');
});

test('11b. pauza czyści bufor kierunków', () => {
  const game = changeDirection(playingGame(), 'up');

  assert.deepEqual(pauseGame(game).pendingDirections, []);
});

test('11c. pauza i wznowienie nic nie robią w niewłaściwych stanach', () => {
  const start = createGame(BOARD);
  const playing = playingGame();

  assert.equal(pauseGame(start), start);
  assert.equal(resumeGame(start), start);
  assert.equal(resumeGame(playing), playing);
});

test('12. zapis i odtworzenie gry daje ten sam stan w pauzie', () => {
  const game = playingGame({
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ],
    direction: 'down',
    food: { x: 10, y: 3 },
    score: 1,
  });

  // Przez JSON, tak jak w bazie (kolumna jsonb).
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  const restored = restoreGame(data, BOARD);

  assert.equal(restored.status, 'paused');
  assert.deepEqual(restored.snake, game.snake);
  assert.equal(restored.direction, 'down');
  assert.deepEqual(restored.food, { x: 10, y: 3 });
  assert.equal(restored.score, 1);
  assert.equal(restored.speedMs, 150);
  assert.deepEqual(restored.pendingDirections, []);
  assert.equal(restored.won, false);
});

test('12b. odtworzona gra ma prędkość wynikającą z wyniku', () => {
  // 13 segmentów = wynik 10 = dwa przyspieszenia.
  const snake = Array.from({ length: 13 }, (_, i) => ({ x: 15 - i, y: 5 }));
  const game = playingGame({ snake, food: { x: 0, y: 0 }, score: 10 });

  const restored = restoreGame(serializeGame(game), BOARD);

  assert.equal(restored.speedMs, 130);
});

test('13. restoreGame odrzuca uszkodzone dane', () => {
  const valid = serializeGame(playingGame());
  assert.notEqual(restoreGame(valid, BOARD), null);

  const broken = [
    ['brak danych', null],
    ['inny rozmiar planszy', { ...valid, width: 30 }],
    ['nieznany kierunek', { ...valid, direction: 'toString' }],
    ['wąż poza planszą', { ...valid, snake: [{ x: 20, y: 0 }, ...valid.snake.slice(1)] }],
    ['współrzędne niecałkowite', { ...valid, snake: [{ x: 1.5, y: 0 }, ...valid.snake.slice(1)] }],
    ['powtórzony segment', { ...valid, snake: [valid.snake[0], valid.snake[0], valid.snake[2]] }],
    ['owoc na wężu', { ...valid, food: valid.snake[1] }],
    ['brak owocu', { ...valid, food: null }],
    ['wynik niezgodny z długością', { ...valid, score: 50 }],
    ['za krótki wąż', { ...valid, snake: valid.snake.slice(0, 2), score: -1 }],
  ];

  for (const [name, data] of broken) {
    assert.equal(restoreGame(data, BOARD), null, name);
  }
});
```

- [ ] **Step 2: Uruchom testy — nowe mają nie przejść**

Run: `node --test`
Expected: FAIL — `pauseGame` / `serializeGame` nie są eksportowane (SyntaxError przy imporcie).

- [ ] **Step 3: Implementacja w `src/game.js`**

W `createGame` zmień komentarz statusu:

```js
    status: 'start', // 'start' | 'playing' | 'paused' | 'over'
```

Po funkcji `startGame` dodaj:

```js
/** Wstrzymuje grę. Bufor kierunków jest czyszczony, żeby wąż nie skręcił sam po wznowieniu. */
export function pauseGame(state) {
  if (state.status !== 'playing') return state;
  return { ...state, status: 'paused', pendingDirections: [] };
}

/** Wznawia wstrzymaną grę. */
export function resumeGame(state) {
  if (state.status !== 'paused') return state;
  return { ...state, status: 'playing' };
}

/**
 * Zwraca dane gry do zapisu jako JSON — bez funkcji random, bufora kierunków i statusu.
 * Prędkości nie zapisujemy, bo wynika z wyniku.
 */
export function serializeGame(state) {
  return {
    width: state.width,
    height: state.height,
    snake: state.snake.map(({ x, y }) => ({ x, y })),
    direction: state.direction,
    food: state.food ? { x: state.food.x, y: state.food.y } : null,
    score: state.score,
  };
}

/**
 * Odtwarza zapisaną grę w stanie 'paused'.
 * Zwraca null, gdy dane są niepoprawne albo pochodzą z planszy o innym rozmiarze.
 */
export function restoreGame(data, { width = 20, height = 20, random }) {
  if (!isValidSave(data, width, height)) return null;

  return {
    width,
    height,
    random,
    snake: data.snake.map(({ x, y }) => ({ x, y })),
    direction: data.direction,
    pendingDirections: [],
    food: { x: data.food.x, y: data.food.y },
    score: data.score,
    status: 'paused',
    won: false,
    speedMs: speedForScore(data.score),
  };
}
```

Przed funkcją `isSamePosition` (koniec pliku) dodaj:

```js
// Dane z bazy mogą być uszkodzone albo zmienione ręcznie — sprawdzamy wszystko, czego używa gra.
function isValidSave(data, width, height) {
  if (data === null || typeof data !== 'object') return false;
  if (data.width !== width || data.height !== height) return false;
  if (typeof data.direction !== 'string' || !Object.hasOwn(DIRECTIONS, data.direction)) return false;

  const { snake, food, score } = data;
  if (!Array.isArray(snake) || snake.length < 3) return false;
  if (!snake.every((cell) => isCellOnBoard(cell, width, height))) return false;
  const uniqueCells = new Set(snake.map(({ x, y }) => `${x},${y}`));
  if (uniqueCells.size !== snake.length) return false;

  if (!isCellOnBoard(food, width, height)) return false;
  if (snake.some((segment) => isSamePosition(segment, food))) return false;

  // Wąż rośnie o jedno pole za każdy owoc, więc wynik musi zgadzać się z długością.
  return score === snake.length - 3;
}

function isCellOnBoard(cell, width, height) {
  return (
    cell !== null &&
    typeof cell === 'object' &&
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.x < width &&
    cell.y >= 0 &&
    cell.y < height
  );
}
```

- [ ] **Step 4: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie testy (stare 18 + nowe).

- [ ] **Step 5: Commit (po zgodzie użytkownika, zbiorczo na końcu)**

```bash
git add src/game.js tests/game.test.js
git commit -m "pauza oraz zapis i odtwarzanie stanu gry"
```

---

### Task 2: Reguły tabeli wyników (`leaderboard.js`)

**Files:**
- Create: `src/leaderboard.js`
- Test: `tests/leaderboard.test.js`

**Interfaces:**
- Produces:
  - `TOP_LIMIT = 10`, `MAX_NICKNAME_LENGTH = 16`, `DEFAULT_NICKNAME = 'Anonim'`
  - `qualifiesForTop(score: number, topScores: {score: number}[], limit = TOP_LIMIT) → boolean`
  - `cleanNickname(raw: unknown) → string` (1–16 znaków)

- [ ] **Step 1: Napisz testy `tests/leaderboard.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { qualifiesForTop, cleanNickname } from '../src/leaderboard.js';

const scores = (...values) => values.map((score) => ({ nickname: 'x', score }));

test('wynik 0 nigdy nie wchodzi do tabeli', () => {
  assert.equal(qualifiesForTop(0, []), false);
});

test('przy niepełnej tabeli wchodzi każdy dodatni wynik', () => {
  assert.equal(qualifiesForTop(1, scores(50, 40, 30)), true);
});

test('przy pełnej tabeli trzeba pobić ostatnie miejsce', () => {
  const full = scores(100, 90, 80, 70, 60, 50, 40, 30, 20, 10);

  assert.equal(qualifiesForTop(11, full), true);
  assert.equal(qualifiesForTop(10, full), false, 'remis z ostatnim nie wystarcza');
  assert.equal(qualifiesForTop(5, full), false);
});

test('cleanNickname przycina spacje i długość, pusty nick zamienia na „Anonim”', () => {
  assert.equal(cleanNickname('  Kacper  '), 'Kacper');
  assert.equal(cleanNickname('a'.repeat(30)), 'a'.repeat(16));
  assert.equal(cleanNickname('   '), 'Anonim');
  assert.equal(cleanNickname(''), 'Anonim');
  assert.equal(cleanNickname(null), 'Anonim');
});

test('cleanNickname liczy emoji jako jeden znak i nie rozcina ich', () => {
  const nickname = cleanNickname('🐍'.repeat(20));

  assert.equal(Array.from(nickname).length, 16);
  assert.equal(nickname, '🐍'.repeat(16));
});
```

- [ ] **Step 2: Uruchom testy — mają nie przejść**

Run: `node --test`
Expected: FAIL — `Cannot find module '../src/leaderboard.js'`.

- [ ] **Step 3: Utwórz `src/leaderboard.js`**

```js
// Reguły tabeli najlepszych wyników: kto wchodzi do top 10 i jak wygląda poprawny nick.
// Moduł nie zna Supabase ani DOM, dzięki czemu da się go testować w Node.

export const TOP_LIMIT = 10;
export const MAX_NICKNAME_LENGTH = 16;
export const DEFAULT_NICKNAME = 'Anonim';

/**
 * Czy wynik zmieści się w tabeli najlepszych (topScores posortowane malejąco).
 * Remis z ostatnim miejscem nie wystarcza — przy równych wynikach wygrywa starszy.
 */
export function qualifiesForTop(score, topScores, limit = TOP_LIMIT) {
  if (score <= 0) return false;
  if (topScores.length < limit) return true;
  return score > topScores[limit - 1].score;
}

/**
 * Zwraca nick gotowy do zapisu: bez skrajnych spacji, najwyżej 16 znaków
 * (liczonych jak w Postgresie — emoji to jeden znak), pusty → „Anonim”.
 */
export function cleanNickname(raw) {
  const characters = Array.from(String(raw ?? '').trim());
  const nickname = characters.slice(0, MAX_NICKNAME_LENGTH).join('').trim();
  return nickname || DEFAULT_NICKNAME;
}
```

- [ ] **Step 4: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie testy w obu plikach.

- [ ] **Step 5: Commit (po zgodzie, zbiorczo)**

```bash
git add src/leaderboard.js tests/leaderboard.test.js
git commit -m "reguły tabeli najlepszych wyników"
```

---

### Task 3: Moduł chmury (`config.js`, `cloud.js`) i nick w `storage.js`

**Files:**
- Create: `src/config.js`, `src/cloud.js`
- Modify: `src/storage.js` (dopisanie na końcu)

**Interfaces:**
- Consumes: `TOP_LIMIT` z `src/leaderboard.js`.
- Produces (`cloud.js`, wszystkie async, nigdy nie rzucają wyjątków):
  - `initCloud() → Promise<boolean>`
  - `loadSavedGame() → Promise<object | null>`
  - `saveGame(data: object) → Promise<boolean>`
  - `deleteSavedGame() → Promise<boolean>`
  - `submitScore(nickname: string, score: number) → Promise<boolean>`
  - `fetchTopScores(limit = TOP_LIMIT) → Promise<{nickname: string, score: number}[]>`
- Produces (`storage.js`): `loadNickname() → string` (pusty, gdy brak), `saveNickname(nickname: string) → void`

`cloud.js` korzysta z CDN i `window`, więc nie ma testów w `node --test` — weryfikacja w Task 5.

- [ ] **Step 1: Utwórz `src/config.js`**

```js
// Dane projektu Supabase. Klucz „publishable” jest z definicji jawny — widzi go każda przeglądarka.
// Dostęp do danych chronią reguły Row Level Security w bazie (supabase/schema.sql).

export const SUPABASE_URL = 'https://dhluvtmrtxavdzkxvlfl.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_BHiK8bjjpzuprVMbvEcaZA_PPe2zwR-';
```

- [ ] **Step 2: Utwórz `src/cloud.js`**

```js
// Komunikacja z Supabase: anonimowe logowanie, zapisana gra i tabela wyników.
// Każda funkcja łapie błędy i zwraca wartość „pustą” (false / null / []),
// żeby gra działała normalnie także bez sieci.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { TOP_LIMIT } from './leaderboard.js';

// Ładowana dynamicznie w initCloud: statyczny import z CDN zablokowałby całą grę,
// gdyby CDN był niedostępny.
const SUPABASE_LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let client = null;
let userId = null;

// Zapisy i usunięcia zapisanej gry wykonujemy po kolei, żeby szybkie „pauza → nowa gra”
// nie zostawiło w bazie starego zapisu.
let savedGameQueue = Promise.resolve();

/** Łączy się z Supabase i loguje anonimowo (sesja zostaje w przeglądarce). */
export async function initCloud() {
  try {
    const { createClient } = await import(SUPABASE_LIBRARY_URL);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }

    client = supabase;
    userId = session.user.id;
    return true;
  } catch (error) {
    console.warn('Supabase niedostępny:', error);
    return false;
  }
}

export async function loadSavedGame() {
  const { data } = await runQuery('odczyt zapisanej gry', (db) =>
    db.from('saved_games').select('state').maybeSingle(),
  );
  return data?.state ?? null;
}

export function saveGame(data) {
  return enqueueSavedGameChange('zapis gry', (db) =>
    db.from('saved_games').upsert({
      user_id: userId,
      state: data,
      updated_at: new Date().toISOString(),
    }),
  );
}

export function deleteSavedGame() {
  return enqueueSavedGameChange('usunięcie zapisanej gry', (db) =>
    db.from('saved_games').delete().eq('user_id', userId),
  );
}

export async function submitScore(nickname, score) {
  const { ok } = await runQuery('zapis wyniku', (db) =>
    db.from('scores').insert({ nickname, score }),
  );
  return ok;
}

export async function fetchTopScores(limit = TOP_LIMIT) {
  const { data } = await runQuery('tabela wyników', (db) =>
    db
      .from('scores')
      .select('nickname, score')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit),
  );
  return data ?? [];
}

function enqueueSavedGameChange(label, buildQuery) {
  const result = savedGameQueue.then(() => runQuery(label, buildQuery)).then(({ ok }) => ok);
  savedGameQueue = result;
  return result;
}

// Wykonuje zapytanie; przy braku połączenia albo błędzie zwraca { ok: false, data: null }.
async function runQuery(label, buildQuery) {
  if (!client) return { ok: false, data: null };
  try {
    const { data, error } = await buildQuery(client);
    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    console.warn(`Supabase — ${label}:`, error);
    return { ok: false, data: null };
  }
}
```

- [ ] **Step 3: Dopisz nick na końcu `src/storage.js`**

```js

// Nick do tabeli wyników — zapamiętany, żeby nie wpisywać go przy każdym rekordzie.
const NICKNAME_KEY = 'snake.nickname';

export function loadNickname() {
  try {
    return window.localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveNickname(nickname) {
  try {
    window.localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    // localStorage niedostępny — nick nie zostanie zapamiętany.
  }
}
```

- [ ] **Step 4: Sprawdź, że testy dalej przechodzą i że CDN zwraca bibliotekę**

Run: `node --test`
Expected: PASS (testy nie importują `cloud.js`).

Run: `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm`
Expected: `200 application/javascript; charset=utf-8`

- [ ] **Step 5: Commit (po zgodzie, zbiorczo)**

```bash
git add src/config.js src/cloud.js src/storage.js
git commit -m "moduł komunikacji z Supabase i zapamiętywanie nicku"
```

---

### Task 4: Interfejs i przepływ (`input.js`, `render.js`, `index.html`, `style.css`, `main.js`)

**Files:**
- Modify: `src/input.js`, `src/render.js`, `index.html`, `style.css`, `src/main.js` (całość)

**Interfaces:**
- Consumes: wszystko z Task 1–3.
- Produces: `setupInput({ onDirection, onEnter, onPause })`.

- [ ] **Step 1: `src/input.js` — pauza i ignorowanie klawiszy w formularzu**

Zastąp funkcję `setupInput`:

```js
/**
 * Nasłuchuje klawiatury i wywołuje odpowiednie funkcje.
 * @param {{ onDirection: (dir: string) => void, onEnter: () => void, onPause: () => void }} handlers
 */
export function setupInput({ onDirection, onEnter, onPause }) {
  window.addEventListener('keydown', (event) => {
    // Pisanie nicku w formularzu nie steruje grą.
    if (event.target instanceof Element && event.target.closest('form')) return;

    const direction = KEY_TO_DIRECTION[event.key];
    if (direction) {
      event.preventDefault(); // strzałki nie mogą przewijać strony
      onDirection(direction);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onEnter();
    } else if (event.key === ' ' || event.key === 'Escape') {
      event.preventDefault(); // spacja nie może przewijać strony
      onPause();
    }
  });
}
```

- [ ] **Step 2: `src/render.js` — nakładka pauzy**

W `render` zastąp blok `if (state.status === 'start') { ... }` (do końca `else if (state.status === 'over')`) tym:

```js
  if (state.status === 'start') {
    drawOverlay(ctx, [
      { text: 'Naciśnij strzałkę, aby zacząć', size: 20 },
      { text: `Rekord: ${highScore}`, size: 16 },
      { text: 'Spacja — pauza w trakcie gry', size: 14 },
    ]);
  } else if (state.status === 'paused') {
    drawOverlay(ctx, [
      { text: 'Pauza', size: 32 },
      { text: `Wynik: ${state.score}`, size: 18 },
      { text: 'Spacja — wznów', size: 16 },
      { text: 'Enter — nowa gra', size: 16 },
    ]);
  } else if (state.status === 'over') {
```

(reszta bloku `over` bez zmian).

- [ ] **Step 3: `index.html` — tabela, status, formularz**

Zastąp zawartość `<main class="game">…</main>`:

```html
  <main class="game">
    <h1>Wąż bez Granic</h1>
    <div class="layout">
      <div class="board-column">
        <div class="score-bar">
          <span>Wynik: <strong id="score">0</strong></span>
          <span>Rekord: <strong id="high-score">0</strong></span>
        </div>
        <canvas id="board" width="400" height="400"></canvas>
        <form id="nickname-form" class="nickname-form" hidden>
          <label for="nickname">Jesteś w top 10! Twój nick:</label>
          <input id="nickname" name="nickname" maxlength="16" autocomplete="off" required>
          <button type="submit">Zapisz</button>
        </form>
      </div>
      <aside class="leaderboard">
        <h2>Najlepsi</h2>
        <ol id="top-scores"></ol>
        <p id="cloud-status" class="cloud-status"></p>
      </aside>
    </div>
  </main>
```

- [ ] **Step 4: `style.css` — dopisz na końcu**

```css
.layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.board-column {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nickname-form {
  width: 400px;
  margin-top: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.nickname-form[hidden] {
  display: none;
}

.nickname-form label {
  width: 100%;
  color: #ffd54f;
}

.nickname-form input {
  flex: 1;
  padding: 6px 8px;
  font: inherit;
  color: #e8eaed;
  background: #111418;
  border: 1px solid #2e9d3a;
  border-radius: 4px;
}

.nickname-form button {
  padding: 6px 14px;
  font: inherit;
  color: #0b0d10;
  background: #6ee06e;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}

.leaderboard {
  width: 200px;
  margin-top: 34px;
}

.leaderboard h2 {
  margin: 0 0 8px;
  font-size: 1.2rem;
  color: #6ee06e;
}

.leaderboard ol {
  margin: 0;
  padding-left: 1.6em;
  line-height: 1.6;
}

.leaderboard li {
  overflow-wrap: anywhere;
}

.cloud-status {
  margin: 8px 0 0;
  font-size: 0.85rem;
  color: #9aa0a6;
}

@media (max-width: 700px) {
  .layout {
    flex-direction: column;
    align-items: center;
  }

  .leaderboard {
    width: 400px;
    margin-top: 0;
  }
}
```

- [ ] **Step 5: `src/main.js` — zastąp całość**

```js
// Spina całość: stan gry, pętla (timer), klawiatura, rysowanie, rekord oraz chmura (Supabase).

import {
  createGame,
  startGame,
  changeDirection,
  step,
  pauseGame,
  resumeGame,
  serializeGame,
  restoreGame,
} from './game.js';
import { render } from './render.js';
import { setupInput } from './input.js';
import { loadHighScore, saveHighScore, loadNickname, saveNickname } from './storage.js';
import { qualifiesForTop, cleanNickname } from './leaderboard.js';
import {
  initCloud,
  loadSavedGame,
  saveGame,
  deleteSavedGame,
  submitScore,
  fetchTopScores,
} from './cloud.js';

const BOARD_SIZE = 20;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const topScoresElement = document.getElementById('top-scores');
const cloudStatusElement = document.getElementById('cloud-status');
const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname');

let state = newGameState();
let highScore = loadHighScore();
let isNewRecord = false;
let timerId = null;
let cloudReady = false;
let pendingScore = null; // wynik czekający na wpisanie nicku

function newGameState() {
  return createGame({ width: BOARD_SIZE, height: BOARD_SIZE, random: Math.random });
}

function draw() {
  scoreElement.textContent = state.score;
  highScoreElement.textContent = highScore;
  render(ctx, state, { highScore, isNewRecord });
}

function scheduleTick() {
  timerId = setTimeout(tick, state.speedMs);
}

function stopTimer() {
  clearTimeout(timerId);
  timerId = null;
}

function tick() {
  state = step(state);
  if (state.status === 'over') {
    finishGame();
  } else {
    scheduleTick();
  }
  draw();
}

function finishGame() {
  timerId = null;
  if (state.score > highScore) {
    highScore = state.score;
    isNewRecord = true;
    saveHighScore(highScore);
  }

  if (cloudReady) {
    deleteSavedGame();
    if (state.score > 0) handleFinalScore(state.score);
  }
}

// Wynik z top 10 czeka na nick; pozostałe wysyłamy od razu z zapamiętanym nickiem.
async function handleFinalScore(score) {
  const topScores = await fetchTopScores();

  // Gracz mógł już zacząć nową grę, zanim przyszła odpowiedź — wtedy nie pytamy o nick.
  if (state.status === 'over' && qualifiesForTop(score, topScores)) {
    pendingScore = score;
    nicknameInput.value = loadNickname();
    nicknameForm.hidden = false;
    nicknameInput.focus();
    nicknameInput.select();
    return;
  }

  await submitScore(cleanNickname(loadNickname()), score);
  await refreshLeaderboard();
}

async function submitPendingScore(nickname) {
  if (pendingScore === null) return;

  const score = pendingScore;
  pendingScore = null;
  nicknameForm.hidden = true;
  await submitScore(nickname, score);
  await refreshLeaderboard();
}

async function refreshLeaderboard() {
  const topScores = await fetchTopScores();
  // textContent, a nie innerHTML — nick wpisuje gracz, więc nie może być traktowany jak HTML.
  const items = topScores.map(({ nickname, score }) => {
    const item = document.createElement('li');
    item.textContent = `${nickname} — ${score}`;
    return item;
  });
  topScoresElement.replaceChildren(...items);
}

function pause() {
  stopTimer();
  state = pauseGame(state);
  if (cloudReady) saveGame(serializeGame(state));
  draw();
}

function resume() {
  state = resumeGame(state);
  scheduleTick();
  draw();
}

function handleDirection(dir) {
  if (state.status === 'over' || state.status === 'paused') return;

  state = changeDirection(state, dir);
  if (state.status === 'start') {
    state = startGame(state);
    scheduleTick();
    draw();
  }
}

function handlePause() {
  if (state.status === 'playing') {
    pause();
  } else if (state.status === 'paused') {
    resume();
  }
}

function handleEnter() {
  if (state.status !== 'over' && state.status !== 'paused') return;

  stopTimer();
  // Formularz nicku został porzucony — wynik i tak trafia do tabeli.
  if (pendingScore !== null) submitPendingScore(cleanNickname(loadNickname()));
  if (state.status === 'paused' && cloudReady) deleteSavedGame();

  isNewRecord = false;
  state = startGame(newGameState());
  scheduleTick();
  draw();
}

nicknameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const nickname = cleanNickname(nicknameInput.value);
  saveNickname(nickname);
  nicknameInput.blur();
  submitPendingScore(nickname);
});

// Ukrycie lub zamknięcie karty w trakcie gry = pauza z zapisem.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.status === 'playing') pause();
});

async function connectCloud() {
  cloudStatusElement.textContent = 'Łączenie z bazą…';
  cloudReady = await initCloud();
  if (!cloudReady) {
    cloudStatusElement.textContent = 'Brak połączenia z bazą — wyniki i wznawianie gry niedostępne.';
    return;
  }

  cloudStatusElement.textContent = '';
  const [saved] = await Promise.all([loadSavedGame(), refreshLeaderboard()]);
  const restored = saved && restoreGame(saved, { width: BOARD_SIZE, height: BOARD_SIZE, random: Math.random });

  // Zapis odtwarzamy tylko, jeśli gracz w międzyczasie nie zaczął nowej gry.
  if (restored && state.status === 'start') {
    state = restored;
    draw();
  }
}

setupInput({ onDirection: handleDirection, onEnter: handleEnter, onPause: handlePause });
draw();
connectCloud();
```

- [ ] **Step 6: Testy i sprawdzenie, że moduły się ładują**

Run: `node --test`
Expected: PASS.

Run (serwer z `python -m http.server 8000` działa): `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/src/cloud.js` dla `cloud.js`, `config.js`, `leaderboard.js`, `main.js`
Expected: `200` dla każdego.

- [ ] **Step 7: Commit (po zgodzie, zbiorczo)**

```bash
git add src/input.js src/render.js src/main.js index.html style.css
git commit -m "pauza, wznawianie gry i tabela najlepszych wyników w interfejsie"
```

---

### Task 5: Weryfikacja na żywej bazie, dokumentacja, publikacja

**Files:**
- Modify: `wymagania.md`, `README.md`

- [ ] **Step 1: Test integracyjny Supabase przez REST (z terminala, bez przeglądarki)**

Skrypt w katalogu scratchpad (nie w repo) — Node 22, `fetch`:

```js
// smoke.mjs — sprawdza logowanie anonimowe, RLS i operacje używane przez cloud.js
const URL = 'https://dhluvtmrtxavdzkxvlfl.supabase.co';
const KEY = 'sb_publishable_BHiK8bjjpzuprVMbvEcaZA_PPe2zwR-';
const base = { apikey: KEY, 'Content-Type': 'application/json' };

async function call(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = { ...base, Authorization: `Bearer ${token ?? KEY}` };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${URL}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const signup = await call('/auth/v1/signup', { method: 'POST', body: {} });
const token = signup.body.access_token;
const userId = signup.body.user.id;
console.log('anon signup', signup.status, userId);

const state = { width: 20, height: 20, snake: [{ x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }], direction: 'right', food: { x: 9, y: 9 }, score: 0 };
console.log('upsert', (await call('/rest/v1/saved_games', { method: 'POST', token, prefer: 'resolution=merge-duplicates', body: { user_id: userId, state } })).status);
console.log('upsert again', (await call('/rest/v1/saved_games', { method: 'POST', token, prefer: 'resolution=merge-duplicates', body: { user_id: userId, state: { ...state, score: 0 } } })).status);
console.log('own save', (await call('/rest/v1/saved_games?select=state', { token })).body.length);
console.log('anon key sees saves', (await call('/rest/v1/saved_games?select=state')).body.length);
console.log('delete', (await call(`/rest/v1/saved_games?user_id=eq.${userId}`, { method: 'DELETE', token })).status);
console.log('score insert', (await call('/rest/v1/scores', { method: 'POST', token, body: { nickname: 'smoke-test', score: 1 } })).status);
console.log('score too high', (await call('/rest/v1/scores', { method: 'POST', token, body: { nickname: 'x', score: 999 } })).status);
console.log('score as other user', (await call('/rest/v1/scores', { method: 'POST', token, body: { nickname: 'x', score: 1, user_id: '00000000-0000-0000-0000-000000000000' } })).status);
console.log('top', JSON.stringify((await call('/rest/v1/scores?select=nickname,score&order=score.desc&limit=10')).body));
```

Run: `node <scratchpad>/smoke.mjs`
Expected: signup 200; upsert 201 oba razy; own save 1; anon key sees saves 0; delete 204; score insert 201;
score too high 400; score as other user 403 (lub 401); top zawiera `smoke-test`.

Sprzątanie danych testowych:
Run: `npx -y supabase@2.120.0 db query --linked --project-ref dhluvtmrtxavdzkxvlfl "delete from public.scores where nickname = 'smoke-test'; delete from auth.users where is_anonymous and id not in (select user_id from public.scores)"`
Expected: bez błędów. (Usuwa tylko anonimowych użytkowników bez wyników — w świeżym projekcie to tylko użytkownik testowy.)

- [ ] **Step 2: Test ręczny w przeglądarce (lokalnie, http://localhost:8000)**

Lista do przejścia przez użytkownika (lub przez osobę wdrażającą):
1. Pod tabelą „Najlepsi” po chwili znika „Łączenie z bazą…”, w konsoli brak błędów.
2. Start strzałką → Spacja: nakładka „Pauza”, wąż stoi; Spacja: gra rusza dalej.
3. Zjedz 2 owoce → Spacja → odśwież stronę (F5) → gra startuje od razu w pauzie z wynikiem 2 → Spacja wznawia.
4. W trakcie gry przełącz kartę i wróć → gra jest w pauzie.
5. Pauza → Enter → nowa gra; odśwież stronę → brak zapisu (ekran startowy).
6. Przegraj z wynikiem > 0 → pojawia się formularz → wpisz `<b>test</b>` → Zapisz → w tabeli widać dosłownie `<b>test</b> — N`.
7. Kolejna przegrana → formularz podpowiada zapamiętany nick.
8. DevTools → Network → Offline → odśwież → gra działa, widać „Brak połączenia z bazą…”.

Po teście usuń wpis z kroku 6 (`delete from public.scores where nickname = '<b>test</b>'` przez `db query`).

- [ ] **Step 3: `wymagania.md`**

W sekcji 2 zastąp akapit „W zakresie (wersja 1)” i „Poza zakresem”:

```markdown
**W zakresie (wersja 1):** ruch węża, jedzenie, punktacja, przechodzenie przez ściany, kolizja z ogonem,
przyspieszanie, rekord w `localStorage`, ekran startowy i ekran końca gry, testy logiki,
publikacja na GitHub Pages.

**W zakresie (wersja 2):** pauza, zapis przerwanej gry w Supabase i jej wznawianie,
publiczna tabela 10 najlepszych wyników (gracze anonimowi, nick podawany przy wejściu do top 10).

**Poza zakresem:** dźwięki, sterowanie dotykowe / wersja mobilna, poziomy trudności,
przeszkody na planszy, konta użytkowników, ochrona tabeli przed celowo sfałszowanymi wynikami.
```

W sekcji 4 tabela sterowania:

```markdown
| Klawisz | Działanie |
|---|---|
| Strzałki ↑ ↓ ← → | zmiana kierunku; na ekranie startowym — rozpoczęcie gry |
| Spacja / Esc | pauza (z zapisem gry w bazie) i wznowienie |
| Enter | na ekranie końca gry lub w pauzie — nowa gra |
```

W sekcji 5 zdanie o stanach zastąp:

```markdown
Gra ma cztery stany: `start` → `playing` ⇄ `paused`, `playing` → `over` → (Enter) → `playing`.
Zapisana gra jest odtwarzana przy wejściu na stronę od razu w stanie `paused`.
```

W sekcji 7 pod nagłówkiem dopisz akapit:

```markdown
**Wyjątek od zasady „bez bibliotek” (wersja 2):** `src/cloud.js` ładuje dynamicznie
`@supabase/supabase-js` z CDN jsDelivr (wersja przypięta). Testy `node --test` dalej nie wymagają
żadnych zależności. Schemat bazy: `supabase/schema.sql`; dane projektu: `src/config.js`.
```

W drzewie plików sekcji 7 dopisz: `config.js` (dane projektu Supabase), `cloud.js` (komunikacja z Supabase),
`leaderboard.js` (reguły tabeli wyników), `tests/leaderboard.test.js`, `supabase/schema.sql`.

W sekcji 9 zamień `main` na `master` w punktach o GitHub i GitHub Pages.

- [ ] **Step 4: `README.md`**

- Link „Zagraj”: `https://kacper08070605.github.io/GameSnake/` (usunąć komentarz o podmianie).
- Tabela sterowania jak w `wymagania.md` (z wierszem Spacja / Esc).
- Po akapicie o rekordzie dopisz: „Wyniki trafiają do publicznej tabeli 10 najlepszych (Supabase). Przerwaną grę
  (Spacja / Esc albo zamknięcie karty) można wznowić po powrocie w tej samej przeglądarce. Bez połączenia z bazą
  gra działa normalnie, tylko bez tabeli i wznawiania.”
- W „Struktura” dopisz `src/config.js`, `src/cloud.js`, `src/leaderboard.js`, `tests/leaderboard.test.js`, `supabase/schema.sql`.
- W „Publikacja” zamień gałąź `main` na `master`.

- [ ] **Step 5: Zgoda użytkownika na commit i push, potem publikacja**

Zapytaj użytkownika o zgodę. Po zgodzie:

```bash
git add src tests index.html style.css wymagania.md README.md supabase docs
git commit -m "wyniki w Supabase i wznawianie przerwanej gry"
git push origin master
```

Poczekaj na wdrożenie Pages (`gh run watch`) i sprawdź, że `https://kacper08070605.github.io/GameSnake/src/cloud.js` zwraca 200.
