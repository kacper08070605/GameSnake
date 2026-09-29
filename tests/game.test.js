import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, startGame, changeDirection, step } from '../src/game.js';

// Deterministyczne "losowanie": zawsze wybiera pierwsze wolne pole.
const alwaysFirst = () => 0;

// Gra w stanie 'playing' z opcjonalnie nadpisanymi polami stanu.
function playingGame(overrides = {}) {
  const game = startGame(createGame({ width: 20, height: 20, random: alwaysFirst }));
  return { ...game, ...overrides };
}

function isOnSnake(snake, cell) {
  return snake.some((segment) => segment.x === cell.x && segment.y === cell.y);
}

test('1. stan początkowy: 3 segmenty, kierunek w prawo, wynik 0, owoc poza wężem', () => {
  const game = createGame({ width: 20, height: 20, random: alwaysFirst });

  assert.equal(game.snake.length, 3);
  assert.deepEqual(game.snake, [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  assert.equal(game.direction, 'right');
  assert.equal(game.score, 0);
  assert.equal(game.status, 'start');
  assert.equal(game.speedMs, 150);
  assert.equal(isOnSnake(game.snake, game.food), false);
});

test('2. step przesuwa węża o jedno pole w bieżącym kierunku, długość bez zmian', () => {
  const game = playingGame();
  const next = step(game);

  assert.deepEqual(next.snake, [
    { x: 11, y: 10 },
    { x: 10, y: 10 },
    { x: 9, y: 10 },
  ]);
  assert.equal(next.snake.length, game.snake.length);
  assert.equal(next.status, 'playing');
});

test('step nie modyfikuje przekazanego stanu', () => {
  const game = playingGame();
  const snapshot = structuredClone({ ...game, random: undefined });

  step(changeDirection(game, 'up'));

  assert.deepEqual({ ...game, random: undefined }, snapshot);
});

test('3. zjedzenie owocu: wynik +1, długość +1, nowy owoc w wolnym polu', () => {
  const game = playingGame({ food: { x: 11, y: 10 } });
  const next = step(game);

  assert.equal(next.score, 1);
  assert.equal(next.snake.length, 4);
  assert.deepEqual(next.snake[0], { x: 11, y: 10 });
  assert.notDeepEqual(next.food, { x: 11, y: 10 });
  assert.equal(isOnSnake(next.snake, next.food), false);
});

test('4. wyjście za każdą ze ścian przenosi głowę na przeciwną stronę planszy', async (t) => {
  const cases = [
    {
      wall: 'prawa',
      direction: 'right',
      snake: [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }],
      expectedHead: { x: 0, y: 5 },
    },
    {
      wall: 'lewa',
      direction: 'left',
      snake: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }],
      expectedHead: { x: 19, y: 5 },
    },
    {
      wall: 'górna',
      direction: 'up',
      snake: [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }],
      expectedHead: { x: 5, y: 19 },
    },
    {
      wall: 'dolna',
      direction: 'down',
      snake: [{ x: 5, y: 19 }, { x: 5, y: 18 }, { x: 5, y: 17 }],
      expectedHead: { x: 5, y: 0 },
    },
  ];

  for (const { wall, direction, snake, expectedHead } of cases) {
    await t.test(`ściana ${wall}`, () => {
      const game = playingGame({ snake, direction, food: { x: 10, y: 10 } });
      const next = step(game);

      assert.equal(next.status, 'playing');
      assert.deepEqual(next.snake[0], expectedHead);
      assert.equal(next.snake.length, 3);
      assert.equal(next.score, 0);
    });
  }
});

test('5. wjechanie we własne ciało kończy grę', () => {
  // Wąż w kształcie haka; skręt w dół wjeżdża w segment (5,6).
  const game = playingGame({
    snake: [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
    ],
    direction: 'left',
    food: { x: 15, y: 15 },
  });

  const next = step(changeDirection(game, 'down'));

  assert.equal(next.status, 'over');
  assert.equal(next.won, false);
});

test('5b. kolizja z ciałem po drugiej stronie planszy też kończy grę', () => {
  const game = playingGame({
    snake: [
      { x: 19, y: 5 },
      { x: 18, y: 5 },
      { x: 18, y: 4 },
      { x: 19, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 5 },
      { x: 1, y: 5 },
    ],
    direction: 'right',
    food: { x: 10, y: 10 },
  });

  assert.equal(step(game).status, 'over');
});

test('6. wjazd na pole zwalniane w tym samym ticku przez ogon nie kończy gry', () => {
  // Wąż zamknięty w kwadracie 2×2 — głowa goni własny ogon.
  const game = playingGame({
    snake: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ],
    direction: 'up',
    food: { x: 10, y: 10 },
  });

  const next = step(changeDirection(game, 'left'));

  assert.equal(next.status, 'playing');
  assert.deepEqual(next.snake[0], { x: 0, y: 0 });
  assert.equal(next.snake.length, 4);
});

test('7. zmiana kierunku o 180° jest ignorowana', () => {
  const game = playingGame();

  const changed = changeDirection(game, 'left');
  const next = step(changed);

  assert.deepEqual(changed.pendingDirections, []);
  assert.equal(next.direction, 'right');
  assert.deepEqual(next.snake[0], { x: 11, y: 10 });
});

test('8. dwie szybkie zmiany kierunku w jednym ticku nie zawracają węża w siebie', () => {
  const game = playingGame();

  // W jednym ticku: góra, potem lewo. Lewo nie może zadziałać od razu (zawrócenie).
  const buffered = changeDirection(changeDirection(game, 'up'), 'left');

  const afterFirstTick = step(buffered);
  assert.equal(afterFirstTick.status, 'playing');
  assert.equal(afterFirstTick.direction, 'up');
  assert.deepEqual(afterFirstTick.snake[0], { x: 10, y: 9 });

  const afterSecondTick = step(afterFirstTick);
  assert.equal(afterSecondTick.status, 'playing');
  assert.equal(afterSecondTick.direction, 'left');
  assert.deepEqual(afterSecondTick.snake[0], { x: 9, y: 9 });
});

test('8b. góra, a zaraz potem dół w jednym ticku — dół jest ignorowany', () => {
  const game = playingGame();
  const buffered = changeDirection(changeDirection(game, 'up'), 'down');

  assert.deepEqual(buffered.pendingDirections, ['up']);
});

test('9. co 5 owoców interwał maleje o 10 ms, ale nie spada poniżej 60 ms', () => {
  const eatNext = (score) =>
    step(playingGame({ score, food: { x: 11, y: 10 } }));

  assert.equal(eatNext(3).speedMs, 150); // 4 owoce — bez zmian
  assert.equal(eatNext(4).speedMs, 140); // 5 owoców
  assert.equal(eatNext(9).speedMs, 130); // 10 owoców
  assert.equal(eatNext(44).speedMs, 60); // 45 owoców — maksimum
  assert.equal(eatNext(99).speedMs, 60); // dalej już nie przyspiesza
});

test('10. brak wolnego pola na owoc kończy grę wygraną', () => {
  // Plansza 4×1: wąż zajmuje 3 pola, owoc leży na ostatnim wolnym.
  const game = startGame(createGame({ width: 4, height: 1, random: alwaysFirst }));
  assert.deepEqual(game.food, { x: 3, y: 0 });

  const next = step(game);

  assert.equal(next.status, 'over');
  assert.equal(next.won, true);
  assert.equal(next.score, 1);
  assert.equal(next.snake.length, 4);
  assert.equal(next.food, null);
});

test('step nic nie robi poza stanem playing', () => {
  const game = createGame({ width: 20, height: 20, random: alwaysFirst });
  assert.equal(step(game), game);
});
