// Czysta logika gry Snake.
// Ten moduł operuje wyłącznie na danych: nie zna DOM, canvas ani localStorage,
// a losowość dostaje z zewnątrz (funkcja `random`), dzięki czemu testy są deterministyczne.
// Każda funkcja zwraca NOWY obiekt stanu i nie modyfikuje przekazanego.

export const START_SPEED_MS = 150;
export const MIN_SPEED_MS = 60;
export const SPEED_STEP_MS = 10;
export const FRUITS_PER_SPEEDUP = 5;

// Wektory ruchu dla każdego kierunku.
export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// Ile zmian kierunku może czekać w buforze na kolejne ticki.
const MAX_BUFFERED_DIRECTIONS = 2;

/**
 * Tworzy stan początkowy gry.
 * @param {object} options
 * @param {number} [options.width=20]  szerokość planszy (w polach)
 * @param {number} [options.height=20] wysokość planszy (w polach)
 * @param {() => number} options.random funkcja zwracająca liczbę z przedziału [0, 1)
 */
export function createGame({ width = 20, height = 20, random }) {
  if (typeof random !== 'function') {
    throw new Error('createGame: wymagana jest funkcja random');
  }

  // Wąż: 3 segmenty poziomo na środku planszy, głowa z prawej (pierwszy element tablicy).
  const headX = Math.floor(width / 2);
  const y = Math.floor(height / 2);
  const snake = [
    { x: headX, y },
    { x: headX - 1, y },
    { x: headX - 2, y },
  ];

  return {
    width,
    height,
    random,
    snake,
    direction: 'right',
    pendingDirections: [],
    food: placeFood(snake, width, height, random),
    score: 0,
    status: 'start', // 'start' | 'playing' | 'over'
    won: false,
    speedMs: START_SPEED_MS,
  };
}

/** Przełącza grę ze stanu startowego w stan rozgrywki. */
export function startGame(state) {
  if (state.status !== 'start') return state;
  return { ...state, status: 'playing' };
}

/**
 * Buforuje zmianę kierunku. Nowy kierunek porównujemy z ostatnim zaplanowanym
 * (a nie tylko z bieżącym), więc dwa szybkie naciśnięcia nie zawrócą węża w siebie.
 */
export function changeDirection(state, dir) {
  if (!DIRECTIONS[dir]) return state;

  const pending = state.pendingDirections;
  const lastPlanned = pending.length > 0 ? pending[pending.length - 1] : state.direction;

  const isSame = dir === lastPlanned;
  const isReverse = dir === OPPOSITE[lastPlanned];
  const isBufferFull = pending.length >= MAX_BUFFERED_DIRECTIONS;
  if (isSame || isReverse || isBufferFull) return state;

  return { ...state, pendingDirections: [...pending, dir] };
}

/** Wykonuje jeden tick gry: ruch, jedzenie, kolizje, przyspieszenie. */
export function step(state) {
  if (state.status !== 'playing') return state;

  // W jednym ticku stosujemy najwyżej jedną zmianę kierunku z bufora.
  const [nextDirection = state.direction, ...restDirections] = state.pendingDirections;

  const head = state.snake[0];
  const move = DIRECTIONS[nextDirection];
  const newHead = wrap(
    { x: head.x + move.x, y: head.y + move.y },
    state.width,
    state.height,
  );

  const willEat = newHead.x === state.food.x && newHead.y === state.food.y;

  // Jeśli wąż nie je, ogon w tym ticku schodzi ze swojego pola,
  // więc wjazd na to pole nie jest kolizją.
  const body = willEat ? state.snake : state.snake.slice(0, -1);
  if (body.some((segment) => isSamePosition(segment, newHead))) {
    return { ...state, direction: nextDirection, pendingDirections: restDirections, status: 'over' };
  }

  const snake = [newHead, ...body];
  const base = { ...state, snake, direction: nextDirection, pendingDirections: restDirections };

  if (!willEat) return base;

  const score = state.score + 1;
  const food = placeFood(snake, state.width, state.height, state.random);

  // Brak wolnego pola na owoc — wąż zajął całą planszę.
  if (food === null) {
    return { ...base, score, food: null, status: 'over', won: true };
  }

  return { ...base, score, food, speedMs: speedForScore(score) };
}

/** Interwał ticka dla danego wyniku: co 5 owoców o 10 ms szybciej, nie szybciej niż 60 ms. */
export function speedForScore(score) {
  const speedups = Math.floor(score / FRUITS_PER_SPEEDUP);
  return Math.max(MIN_SPEED_MS, START_SPEED_MS - speedups * SPEED_STEP_MS);
}

// Przejście przez ścianę: wyjście za krawędź przenosi na przeciwną stronę planszy.
function wrap(position, width, height) {
  return {
    x: (position.x + width) % width,
    y: (position.y + height) % height,
  };
}

// Losuje owoc spośród wolnych pól; zwraca null, gdy wolnych pól nie ma.
function placeFood(snake, width, height, random) {
  const freeCells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = { x, y };
      if (!snake.some((segment) => isSamePosition(segment, cell))) {
        freeCells.push(cell);
      }
    }
  }

  if (freeCells.length === 0) return null;
  return freeCells[Math.floor(random() * freeCells.length)];
}

function isSamePosition(a, b) {
  return a.x === b.x && a.y === b.y;
}
