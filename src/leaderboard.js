// Reguły tabeli najlepszych wyników: kto wchodzi do top 10 i jak wygląda poprawny nick.
// Moduł nie zna Supabase ani DOM, dzięki czemu da się go testować w Node.

export const TOP_LIMIT = 10;
export const MAX_NICKNAME_LENGTH = 16;
export const DEFAULT_NICKNAME = 'Anonim';

/**
 * Czy wynik zmieści się w tabeli najlepszych (topScores posortowane malejąco).
 * Remis z ostatnim miejscem nie wystarcza — przy równych wynikach wygrywa starszy.
 * topScores === null oznacza, że tabeli nie udało się pobrać — wtedy nie obiecujemy miejsca.
 */
export function qualifiesForTop(score, topScores, limit = TOP_LIMIT) {
  if (score <= 0 || topScores === null) return false;
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
