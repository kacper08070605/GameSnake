// Komunikacja z Supabase: anonimowe logowanie, zapisana gra i tabela wyników.
// Każda funkcja łapie błędy i zwraca wartość „pustą” (false / null / []),
// żeby gra działała normalnie także bez sieci.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { TOP_LIMIT } from './leaderboard.js';
import { usernameToEmail } from './account.js';

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

// ID gracza zapamiętujemy w chwili wywołania: jeśli zadanie poczeka w kolejce, a w tym czasie
// gracz zmieni konto, nie może ono dotknąć zapisu nowego konta.
export function saveGame(data) {
  const ownerId = userId;
  return enqueueSavedGameChange('zapis gry', (db) =>
    db.from('saved_games').upsert({
      user_id: ownerId,
      state: data,
      updated_at: new Date().toISOString(),
    }),
  );
}

export function deleteSavedGame() {
  const ownerId = userId;
  return enqueueSavedGameChange('usunięcie zapisanej gry', (db) =>
    db.from('saved_games').delete().eq('user_id', ownerId),
  );
}

/** Czeka, aż skończą się wszystkie zapisy i usunięcia zapisanej gry (np. przed zmianą konta). */
export function waitForSavedGames() {
  return savedGameQueue;
}

export async function submitScore(nickname, score) {
  const { ok } = await runQuery('zapis wyniku', (db) =>
    db.from('scores').insert({ nickname, score }),
  );
  return ok;
}

/** Zwraca listę najlepszych wyników albo null, gdy nie udało się jej pobrać. */
export async function fetchTopScores(limit = TOP_LIMIT) {
  const { ok, data } = await runQuery('tabela wyników', (db) =>
    db
      .from('scores')
      .select('nickname, score')
      .gt('score', 0)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit),
  );
  return ok ? data : null;
}

/**
 * Zamienia bieżącego gościa w konto: to samo ID, więc zapisana gra i wyniki zostają.
 * Zwraca { ok, error } — error to błąd Supabase do pokazania graczowi.
 */
export async function register(username, password) {
  return runAuth('rejestracja', async () => {
    // Tylko gość może założyć konto — inaczej updateUser zmieniłby login i hasło istniejącego konta.
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user.is_anonymous) throw new Error('Rejestracja możliwa tylko z konta gościa');

    const { error } = await client.auth.updateUser({ email: usernameToEmail(username), password });
    if (error) throw error;
    // Nowy token z e-mailem konta — reguła bazy pozwala założyć profil tylko z takim tokenem.
    const { data, error: refreshError } = await client.auth.refreshSession();
    if (refreshError) throw refreshError;
    await ensureProfile(data.user, username);
  });
}

/**
 * Loguje na istniejące konto (sesja gościa zostaje porzucona).
 * Profil sprawdza (i w razie potrzeby zakłada) dopiero fetchAccount.
 */
export async function logIn(username, password) {
  return runAuth('logowanie', async () => {
    const { data, error } = await client.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) throw error;
    userId = data.user.id;
  });
}

/** Wylogowuje i od razu zaczyna sesję nowego gościa. */
export async function logOut() {
  const { ok } = await runAuth('wylogowanie', async () => {
    await client.auth.signOut({ scope: 'local' });
    // Od tej chwili nie ma sesji — do czasu nowego gościa nie zapisujemy niczego pod starym ID.
    userId = null;
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    userId = data.user.id;
  });
  return ok;
}

/** Profil i statystyki zalogowanego gracza; dla gościa (albo przy błędzie) null. */
export async function fetchAccount() {
  if (!client) return null;
  try {
    const { data: { session } } = await client.auth.getSession();
    const user = session?.user;
    if (!user || user.is_anonymous) return null;

    const username = await ensureProfile(user);
    const { data, error } = await client.rpc('my_stats');
    if (error) throw error;
    const [stats] = data;
    return { username, bestScore: stats.best_score, gamesPlayed: Number(stats.games_played) };
  } catch (error) {
    console.warn('Supabase — profil:', error);
    return null;
  }
}

// Zwraca login z profilu; jeśli profilu brak (np. przerwana rejestracja), zakłada go.
// Login odczytujemy z technicznego e-maila (część przed @).
async function ensureProfile(user, username = user.email.split('@')[0]) {
  const { data, error } = await client
    .from('profiles')
    .select('username')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.username;

  const { error: insertError } = await client.from('profiles').insert({ user_id: user.id, username });
  if (insertError) throw insertError;
  return username;
}

// Wykonuje operację na koncie; zwraca { ok, error } zamiast rzucać wyjątek.
async function runAuth(label, action) {
  if (!client) return { ok: false, error: null };
  try {
    await action();
    return { ok: true, error: null };
  } catch (error) {
    console.warn(`Supabase — ${label}:`, error);
    return { ok: false, error };
  }
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
