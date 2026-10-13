import { test } from 'node:test';
import assert from 'node:assert/strict';

import { qualifiesForTop, cleanNickname } from '../src/leaderboard.js';

const scores = (...values) => values.map((score) => ({ nickname: 'x', score }));

test('wynik 0 nigdy nie wchodzi do tabeli', () => {
  assert.equal(qualifiesForTop(0, []), false);
});

test('przy niepełnej tabeli wchodzi każdy dodatni wynik', () => {
  assert.equal(qualifiesForTop(1, scores(50, 40, 30)), true);
});

test('przy pełnej tabeli trzeba pobić ostatnie miejsce', () => {
  const full = scores(100, 90, 80, 70, 60, 50, 40, 30, 20, 10);

  assert.equal(qualifiesForTop(11, full), true);
  assert.equal(qualifiesForTop(10, full), false, 'remis z ostatnim nie wystarcza');
  assert.equal(qualifiesForTop(5, full), false);
});

test('cleanNickname przycina spacje i długość, pusty nick zamienia na „Anonim”', () => {
  assert.equal(cleanNickname('  Kacper  '), 'Kacper');
  assert.equal(cleanNickname('a'.repeat(30)), 'a'.repeat(16));
  assert.equal(cleanNickname('   '), 'Anonim');
  assert.equal(cleanNickname(''), 'Anonim');
  assert.equal(cleanNickname(null), 'Anonim');
});

test('cleanNickname liczy emoji jako jeden znak i nie rozcina ich', () => {
  const nickname = cleanNickname('🐍'.repeat(20));

  assert.equal(Array.from(nickname).length, 16);
  assert.equal(nickname, '🐍'.repeat(16));
});

test('nieznana tabela (błąd pobierania) nie daje miejsca w top 10', () => {
  assert.equal(qualifiesForTop(50, null), false);
});
