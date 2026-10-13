// Spina całość: stan gry, pętla (timer), klawiatura, rysowanie, rekord oraz chmura (Supabase).

import {
  createGame,
  startGame,
  changeDirection,
  step,
  pauseGame,
  resumeGame,
  serializeGame,
  restoreGame,
} from './game.js';
import { render } from './render.js';
import { setupInput } from './input.js';
import { loadHighScore, saveHighScore, loadNickname, saveNickname } from './storage.js';
import { qualifiesForTop, cleanNickname } from './leaderboard.js';
import {
  initCloud,
  loadSavedGame,
  saveGame,
  deleteSavedGame,
  submitScore,
  fetchTopScores,
} from './cloud.js';

const BOARD_SIZE = 20;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const topScoresElement = document.getElementById('top-scores');
const cloudStatusElement = document.getElementById('cloud-status');
const nicknameForm = document.getElementById('nickname-form');
const nicknameInput = document.getElementById('nickname');

let state = newGameState();
let highScore = loadHighScore();
let isNewRecord = false;
let timerId = null;
let cloudReady = false;
let pendingScore = null; // wynik czekający na wpisanie nicku

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

function stopTimer() {
  clearTimeout(timerId);
  timerId = null;
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

  if (cloudReady) {
    deleteSavedGame();
    if (state.score > 0) handleFinalScore(state.score);
  }
}

// Wynik z top 10 czeka na nick; pozostałe wysyłamy od razu z zapamiętanym nickiem.
async function handleFinalScore(score) {
  const topScores = await fetchTopScores();

  // Gracz mógł już zacząć nową grę, zanim przyszła odpowiedź — wtedy nie pytamy o nick.
  if (state.status === 'over' && qualifiesForTop(score, topScores)) {
    pendingScore = score;
    nicknameInput.value = loadNickname();
    nicknameForm.hidden = false;
    nicknameInput.focus();
    nicknameInput.select();
    return;
  }

  await sendScore(cleanNickname(loadNickname()), score);
}

async function submitPendingScore(nickname) {
  if (pendingScore === null) return;

  const score = pendingScore;
  pendingScore = null;
  nicknameForm.hidden = true;
  await sendScore(nickname, score);
}

async function sendScore(nickname, score) {
  const sent = await submitScore(nickname, score);
  if (!sent) {
    showCloudError('Nie udało się zapisać wyniku w tabeli.');
    return;
  }
  await refreshLeaderboard();
}

// Komunikat pod tabelą; pusty tekst = wszystko w porządku.
function showCloudError(message) {
  cloudStatusElement.textContent = message;
}

async function refreshLeaderboard() {
  const topScores = await fetchTopScores();
  // Przy błędzie zostawiamy poprzednią listę, żeby chwilowy brak sieci jej nie wyczyścił.
  if (topScores === null) {
    showCloudError('Nie udało się pobrać tabeli wyników.');
    return;
  }

  showCloudError('');
  // textContent, a nie innerHTML — nick wpisuje gracz, więc nie może być traktowany jak HTML.
  const items = topScores.map(({ nickname, score }) => {
    const item = document.createElement('li');
    item.textContent = `${nickname} — ${score}`;
    return item;
  });
  topScoresElement.replaceChildren(...items);
}

function pause() {
  stopTimer();
  state = pauseGame(state);
  if (cloudReady) {
    saveGame(serializeGame(state)).then((saved) => {
      if (!saved) showCloudError('Nie udało się zapisać gry — wznowienie po odświeżeniu nie będzie możliwe.');
    });
  }
  draw();
}

function resume() {
  // Zapis był potrzebny tylko na czas przerwy; bez tego po awarii wróciłaby stara gra.
  if (cloudReady) deleteSavedGame();
  state = resumeGame(state);
  scheduleTick();
  draw();
}

function handleDirection(dir) {
  if (state.status === 'over' || state.status === 'paused') return;

  state = changeDirection(state, dir);
  if (state.status === 'start') {
    state = startGame(state);
    scheduleTick();
    draw();
  }
}

function handlePause() {
  if (state.status === 'playing') {
    pause();
  } else if (state.status === 'paused') {
    resume();
  }
}

function handleEnter() {
  if (state.status !== 'over' && state.status !== 'paused') return;

  stopTimer();
  // Formularz nicku został porzucony — wynik i tak trafia do tabeli.
  if (pendingScore !== null) submitPendingScore(cleanNickname(loadNickname()));
  if (state.status === 'paused' && cloudReady) deleteSavedGame();

  isNewRecord = false;
  state = startGame(newGameState());
  scheduleTick();
  draw();
}

nicknameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const nickname = cleanNickname(nicknameInput.value);
  saveNickname(nickname);
  nicknameInput.blur();
  submitPendingScore(nickname);
});

// Ukrycie lub zamknięcie karty w trakcie gry = pauza z zapisem.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.status === 'playing') pause();
});

async function connectCloud() {
  cloudStatusElement.textContent = 'Łączenie z bazą…';
  cloudReady = await initCloud();
  if (!cloudReady) {
    cloudStatusElement.textContent = 'Brak połączenia z bazą — wyniki i wznawianie gry niedostępne.';
    return;
  }

  showCloudError('');
  const [saved] = await Promise.all([loadSavedGame(), refreshLeaderboard()]);
  const restored = saved && restoreGame(saved, { width: BOARD_SIZE, height: BOARD_SIZE, random: Math.random });

  // Zapis odtwarzamy tylko, jeśli gracz w międzyczasie nie zaczął nowej gry.
  if (restored && state.status === 'start') {
    state = restored;
    draw();
  }
}

setupInput({ onDirection: handleDirection, onEnter: handleEnter, onPause: handlePause });
draw();
connectCloud();
