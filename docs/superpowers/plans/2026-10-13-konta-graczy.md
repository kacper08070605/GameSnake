# Konta graczy — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login + hasło + profil (nazwa, najlepszy wynik, liczba gier); zapis gry i wyniki przypięte do konta; gość dalej może grać.

**Architecture:** Konto = użytkownik Supabase z technicznym e-mailem z loginu. Rejestracja zamienia anonimowego gościa
w konto (`updateUser`) — to samo ID, więc zapis i wyniki zostają. Czyste reguły w `account.js` (testowane), komunikacja
w `cloud.js`, DOM panelu w `account-panel.js`, przepływ w `main.js`. Baza: tabela `profiles`, trigger podpisujący wynik
loginem, funkcja `my_stats()`.

**Tech Stack:** jak w poprzednim etapie (JS ES modules, supabase-js 2.45.4 z CDN, Supabase Postgres + RLS).

**Spec:** `docs/superpowers/specs/2026-10-13-konta-graczy-design.md`

## Global Constraints

- Login `^[a-z0-9_]{3,16}$`, hasło ≥ 6 znaków, e-mail techniczny `<login>@gracze.waz-bez-granic.app`.
- Supabase: Confirm email = OFF (ustawia użytkownik w panelu), anonimowe logowanie zostaje włączone.
- `node --test` bez zależności; gra działa bez Supabase.
- Git (commit/push) tylko za zgodą użytkownika — jeden commit na końcu.

## Review Focus

1. **Przerwana rejestracja** (konto ma e-mail, brak profilu) → profil dotworzony przy następnym odczycie konta (`ensureProfile`).
2. **Przełączenie konta w trakcie gry / z otwartym formularzem nicku** → gra starego użytkownika zapisana, porzucony wynik wysłany jako stary użytkownik, dopiero potem zmiana sesji.
3. **Fokus na przycisku po kliknięciu** → strzałki dalej sterują grą (blokujemy tylko pola tekstowe i Enter/Spację na przyciskach).
4. **Wynik z konta z cudzym nickiem** (REST) → trigger podpisuje loginem właściciela.
5. **Brak połączenia** → panel konta pokazuje komunikat zamiast formularza.

---

### Task 0: Spike — weryfikacja Supabase (bez kodu w repo)

- [ ] Sprawdź `GET /auth/v1/settings` → `mailer_autoconfirm: true`.
- [ ] Skrypt REST w scratchpad: anonimowy signup → `PUT /auth/v1/user {email, password}` → odpowiedź ma `email` ustawiony od razu i `is_anonymous: false` → `POST /auth/v1/token?grant_type=password` tym e-mailem działa → ponowne `PUT` z tym samym e-mailem przez innego gościa daje błąd „email_exists”. Domena `gracze.waz-bez-granic.app` akceptowana.
- [ ] Wynik zapisany w ledgerze; jeśli zachowanie inne niż opisane — ruling.

### Task 1: Baza — profile, trigger, statystyki

**Files:** Modify `supabase/schema.sql` (dopisanie SQL ze specyfikacji, sekcja „Baza”).

- [ ] Dopisz SQL ze spec do `supabase/schema.sql` i wykonaj **tylko nową część** (`db query --linked -f` na pliku tymczasowym w scratchpad).
- [ ] Sprawdź `pg_policies` dla `profiles` i istnienie triggera oraz funkcji (`pg_trigger`, `pg_proc`).

### Task 2: Reguły kont (`src/account.js`) — TDD

**Files:** Create `src/account.js`, `tests/account.test.js`.

**Produces:** `normalizeUsername(raw)`, `validateUsername(username) → string|null`, `validatePassword(password) → string|null`,
`usernameToEmail(username)`, `describeAuthError(error) → string`.

- [ ] Testy (najpierw, RED):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeUsername,
  validateUsername,
  validatePassword,
  usernameToEmail,
  describeAuthError,
} from '../src/account.js';

test('normalizeUsername usuwa spacje i zmienia na małe litery', () => {
  assert.equal(normalizeUsername('  Kacper_1 '), 'kacper_1');
  assert.equal(normalizeUsername(null), '');
});

test('validateUsername przepuszcza poprawne loginy', () => {
  for (const name of ['abc', 'kacper_1', 'a'.repeat(16), '___']) {
    assert.equal(validateUsername(name), null, name);
  }
});

test('validateUsername odrzuca niepoprawne loginy', () => {
  for (const name of ['', 'ab', 'a'.repeat(17), 'Kacper', 'ola nowak', 'żółw', 'a-b', 'a@b']) {
    assert.equal(typeof validateUsername(name), 'string', name);
  }
});

test('validatePassword wymaga co najmniej 6 znaków', () => {
  assert.equal(validatePassword('123456'), null);
  assert.equal(typeof validatePassword('12345'), 'string');
  assert.equal(typeof validatePassword(undefined), 'string');
});

test('usernameToEmail buduje techniczny adres', () => {
  assert.equal(usernameToEmail('kacper_1'), 'kacper_1@gracze.waz-bez-granic.app');
});

test('describeAuthError tłumaczy błędy Supabase na polski', () => {
  assert.equal(describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }), 'Zły login lub hasło.');
  assert.equal(describeAuthError({ code: 'email_exists' }), 'Ten login jest już zajęty.');
  assert.equal(describeAuthError({ code: '23505' }), 'Ten login jest już zajęty.');
  assert.equal(describeAuthError({ status: 429 }), 'Za dużo prób — spróbuj za chwilę.');
  assert.equal(describeAuthError({ name: 'AuthRetryableFetchError' }), 'Brak połączenia z bazą.');
  assert.equal(describeAuthError(null), 'Coś poszło nie tak — spróbuj ponownie.');
});
```

- [ ] Implementacja (GREEN):

```js
// Reguły kont graczy: poprawny login i hasło, techniczny e-mail i polskie komunikaty błędów.
// Moduł nie zna Supabase ani DOM, dzięki czemu da się go testować w Node.

const USERNAME_PATTERN = /^[a-z0-9_]{3,16}$/;
export const MIN_PASSWORD_LENGTH = 6;

// Supabase wymaga e-maila, więc budujemy go z loginu. Na ten adres nic nie jest wysyłane.
const EMAIL_DOMAIN = 'gracze.waz-bez-granic.app';

export function normalizeUsername(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

/** Zwraca komunikat błędu albo null, gdy login jest poprawny. */
export function validateUsername(username) {
  if (USERNAME_PATTERN.test(username)) return null;
  return 'Login: 3–16 znaków — małe litery, cyfry lub _.';
}

/** Zwraca komunikat błędu albo null, gdy hasło jest poprawne. */
export function validatePassword(password) {
  if (String(password ?? '').length >= MIN_PASSWORD_LENGTH) return null;
  return `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`;
}

export function usernameToEmail(username) {
  return `${username}@${EMAIL_DOMAIN}`;
}

/** Zamienia błąd Supabase na komunikat dla gracza. */
export function describeAuthError(error) {
  const code = error?.code ?? '';
  const message = String(error?.message ?? '').toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Zły login lub hasło.';
  }
  // email_exists — zajęty e-mail techniczny; 23505 — zajęty login w tabeli profiles.
  if (code === 'email_exists' || code === 'user_already_exists' || code === '23505') {
    return 'Ten login jest już zajęty.';
  }
  if (code === 'over_request_rate_limit' || error?.status === 429) {
    return 'Za dużo prób — spróbuj za chwilę.';
  }
  if (error?.name === 'AuthRetryableFetchError' || message.includes('failed to fetch')) {
    return 'Brak połączenia z bazą.';
  }
  return 'Coś poszło nie tak — spróbuj ponownie.';
}
```

- [ ] `node --test` → PASS.

### Task 3: `cloud.js` — konto, profil, statystyki

**Files:** Modify `src/cloud.js`.

**Produces:** `register(username, password) → {ok, error}`, `logIn(username, password) → {ok, error}`, `logOut() → boolean`,
`fetchAccount() → {username, bestScore, gamesPlayed} | null`; `fetchTopScores` z filtrem `score > 0`.

- [ ] Dodaj import `usernameToEmail` z `./account.js`; dopisz funkcje (kod w repo po implementacji; zasady):
  - `register`: `client.auth.updateUser({ email, password })` → `ensureProfile(user, username)`; aktualizuje `userId`.
  - `logIn`: `signInWithPassword` → `userId = user.id` → `ensureProfile(user)`.
  - `logOut`: `signOut({ scope: 'local' })` → `signInAnonymously()` → `userId`.
  - `fetchAccount`: sesja; gość lub brak → `null`; `ensureProfile`; `rpc('my_stats')` → `{ username, bestScore, gamesPlayed }`.
  - `ensureProfile(user, username = część e-maila przed @)`: select profilu, brak → insert.
  - Wszystkie łapią błędy (`console.warn`) i zwracają wartości „puste” / `{ ok: false, error }`.
- [ ] `node --check src/cloud.js`.

### Task 4: Panel konta i przepływ

**Files:** Create `src/account-panel.js`; Modify `index.html`, `style.css`, `src/input.js`, `src/main.js`.

- [ ] `index.html`: `<aside class="sidebar">` z `<section id="account" class="panel">` (formularz: login, hasło, „Zaloguj”, „Załóż konto”; profil: nazwa, najlepszy wynik, rozegrane gry, „Wyloguj”; komunikat) i `<section class="panel leaderboard">` (dotychczasowa tabela).
- [ ] `style.css`: `.sidebar` (kolumna 220 px, odstęp 16 px), `.panel` (ciemne tło jak dotąd `.leaderboard`), pola i przyciski jak w formularzu nicku.
- [ ] `src/input.js`: zamiast `closest('form')` — ignoruj klawisze w polach tekstowych oraz Enter/Spację na przyciskach.
- [ ] `src/account-panel.js`: `setupAccountPanel({ onLogIn, onRegister, onLogOut })` → `{ showGuest, showAccount, showUnavailable, showError, setBusy }`.
- [ ] `src/main.js`:
  - `account` (bieżące konto lub `null`), `refreshAccount()`.
  - `loadUserData()` = zapis + tabela + konto (używane przy starcie i po zmianie użytkownika).
  - `leaveCurrentUser()` przed logowaniem/wylogowaniem: stop timera, pauza z **awaitowanym** zapisem, wysłanie porzuconego wyniku.
  - Po zmianie użytkownika: nowa gra w stanie `start`, `loadUserData()`.
  - Koniec gry: zawsze `handleFinalScore` (także 0); zalogowany → `sendScore(account.username, score)` bez formularza.
  - Po wysłaniu wyniku `refreshAccount()`.
- [ ] `node --test`, `node --check` dla zmienionych plików, moduły serwowane lokalnie (200).

### Task 5: Weryfikacja na żywej bazie, dokumentacja, publikacja

- [ ] Skrypt CDP (scratchpad) — scenariusze ze spec („Testy”) w dwóch profilach przeglądarki + REST próba podpisania cudzym loginem.
- [ ] Sprzątanie: usunięcie testowych użytkowników, profili, wyników, zapisów.
- [ ] `wymagania.md` (zakres wersji 3: konta), `README.md` (konta, ograniczenie: brak resetu hasła).
- [ ] Recenzja całości (opus), poprawki Critical/Important z testem.
- [ ] Zgoda użytkownika → commit + push → weryfikacja Pages.
