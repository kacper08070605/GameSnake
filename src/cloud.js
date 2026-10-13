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

/** Zwraca listę najlepszych wyników albo null, gdy nie udało się jej pobrać. */
export async function fetchTopScores(limit = TOP_LIMIT) {
  const { ok, data } = await runQuery('tabela wyników', (db) =>
    db
      .from('scores')
      .select('nickname, score')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit),
  );
  return ok ? data : null;
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
