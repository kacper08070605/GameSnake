// Obsługa klawiatury: tłumaczy klawisze na kierunki i akcje.

const KEY_TO_DIRECTION = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Nasłuchuje klawiatury i wywołuje odpowiednie funkcje.
 * @param {{ onDirection: (dir: string) => void, onEnter: () => void, onPause: () => void }} handlers
 */
export function setupInput({ onDirection, onEnter, onPause }) {
  window.addEventListener('keydown', (event) => {
    // Pisanie w polach (nick, login, hasło) nie steruje grą.
    if (event.target instanceof HTMLInputElement) return;
    // Enter i spacja na przycisku go „klikają” — nie mogą przy okazji pauzować ani zaczynać gry.
    // Strzałki działają dalej, więc po kliknięciu przycisku można od razu grać.
    if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return;

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
