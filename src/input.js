// Obsługa klawiatury: tłumaczy klawisze na kierunki i akcje.

const KEY_TO_DIRECTION = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Nasłuchuje klawiatury i wywołuje odpowiednie funkcje.
 * @param {{ onDirection: (dir: string) => void, onEnter: () => void }} handlers
 */
export function setupInput({ onDirection, onEnter }) {
  window.addEventListener('keydown', (event) => {
    const direction = KEY_TO_DIRECTION[event.key];
    if (direction) {
      event.preventDefault(); // strzałki nie mogą przewijać strony
      onDirection(direction);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onEnter();
    }
  });
}
