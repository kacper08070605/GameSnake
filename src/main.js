// Spina całość: stan gry, pętla (timer), klawiatura, rysowanie i rekord.

import { createGame, startGame, changeDirection, step } from './game.js';
import { render } from './render.js';
import { setupInput } from './input.js';
import { loadHighScore, saveHighScore } from './storage.js';

const BOARD_SIZE = 20;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');

let state = newGameState();
let highScore = loadHighScore();
let isNewRecord = false;
let timerId = null;

function newGameState() {
  return createGame({ width: BOARD_SIZE, height: BOARD_SIZE, random: Math.random });
}

function draw() {
  scoreElement.textContent = state.score;
  highScoreElement.textContent = highScore;
  render(ctx, state, { highScore, isNewRecord });
}

function scheduleTick() {
  timerId = setTimeout(tick, state.speedMs);
}

function tick() {
  state = step(state);
  if (state.status === 'over') {
    finishGame();
  } else {
    scheduleTick();
  }
  draw();
}

function finishGame() {
  timerId = null;
  if (state.score > highScore) {
    highScore = state.score;
    isNewRecord = true;
    saveHighScore(highScore);
  }
}

function handleDirection(dir) {
  if (state.status === 'over') return;

  state = changeDirection(state, dir);
  if (state.status === 'start') {
    state = startGame(state);
    scheduleTick();
    draw();
  }
}

function handleEnter() {
  if (state.status !== 'over') return;

  clearTimeout(timerId);
  isNewRecord = false;
  state = startGame(newGameState());
  scheduleTick();
  draw();
}

setupInput({ onDirection: handleDirection, onEnter: handleEnter });
draw();
