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
