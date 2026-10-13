import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEffects,
  addEatEffect,
  addFlash,
  addShake,
  addSparks,
  pruneEffects,
  progress,
  shakeOffset,
  sparkPosition,
  BURST_DURATION_MS,
  FLOAT_TEXT_DURATION_MS,
  SHAKE_DURATION_MS,
} from '../src/effects.js';

const fixedRandom = () => 0.5;

test('zjedzenie dodaje iskry i napis „+1” w podanym miejscu', () => {
  const effects = addEatEffect(createEffects(), { x: 50, y: 70 }, 1000, fixedRandom);

  assert.deepEqual(effects.map((effect) => effect.type), ['sparks', 'text']);
  assert.equal(effects[0].x, 50);
  assert.equal(effects[0].y, 70);
  assert.ok(effects[0].sparks.length > 0);
  assert.equal(effects[1].text, '+1');
});

test('dodawanie efektu nie zmienia przekazanej listy', () => {
  const effects = createEffects();
  addFlash(effects, '#6ee06e', 0);

  assert.equal(effects.length, 0);
});

test('pruneEffects usuwa efekty, których czas minął', () => {
  let effects = addEatEffect(createEffects(), { x: 0, y: 0 }, 1000, fixedRandom);
  effects = addShake(effects, 1000);

  assert.equal(pruneEffects(effects, 1000 + BURST_DURATION_MS - 1).length, 2, 'napis i trzęsienie trwają');
  assert.deepEqual(
    pruneEffects(effects, 1000 + BURST_DURATION_MS).map((effect) => effect.type),
    ['text'],
    'iskry i trzęsienie już się skończyły',
  );
  assert.equal(pruneEffects(effects, 1000 + FLOAT_TEXT_DURATION_MS).length, 0);
});

test('progress rośnie od 0 do 1 i nie wychodzi poza ten zakres', () => {
  const [effect] = addFlash(createEffects(), '#fff', 1000);

  assert.equal(progress(effect, 900), 0);
  assert.equal(progress(effect, 1000), 0);
  assert.ok(progress(effect, 1000 + effect.duration / 2) > 0.49);
  assert.equal(progress(effect, 1000 + effect.duration * 3), 1);
});

test('shakeOffset: bez trzęsienia zero, z trzęsieniem przesunięcie, które gaśnie', () => {
  assert.deepEqual(shakeOffset(createEffects(), 0), { x: 0, y: 0 });

  const effects = addShake(createEffects(), 1000);
  const early = shakeOffset(effects, 1000 + SHAKE_DURATION_MS * 0.1);
  const end = shakeOffset(effects, 1000 + SHAKE_DURATION_MS);

  assert.ok(Math.hypot(early.x, early.y) > 0);
  assert.ok(Math.hypot(end.x, end.y) < 1e-9);
});

test('iskry rozlatują się od punktu startu', () => {
  const [burst] = addSparks(createEffects(), { x: 100, y: 100 }, 0, fixedRandom, {
    count: 8,
    colors: ['#fff'],
  });

  for (const spark of burst.sparks) {
    const start = sparkPosition(burst, spark, 0);
    const later = sparkPosition(burst, spark, 300);
    assert.deepEqual(start, { x: 100, y: 100 });
    assert.ok(Math.hypot(later.x - 100, later.y - 100) > 5);
  }
});
