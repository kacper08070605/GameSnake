// Odczyt i zapis rekordu w localStorage.
// Gdy localStorage jest niedostępny (np. tryb prywatny), rekord trzymamy tylko w pamięci
// — obowiązuje wtedy do odświeżenia strony.

const HIGH_SCORE_KEY = 'snake.highScore';

let memoryHighScore = 0;

export function loadHighScore() {
  try {
    const value = Number(window.localStorage.getItem(HIGH_SCORE_KEY));
    memoryHighScore = Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    // localStorage niedostępny — zostajemy przy wartości z pamięci.
  }
  return memoryHighScore;
}

export function saveHighScore(score) {
  memoryHighScore = score;
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // localStorage niedostępny — rekord zostaje tylko w pamięci.
  }
}
