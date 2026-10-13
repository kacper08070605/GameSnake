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
import { render, onImagesLoaded } from './render.js';
import { setupInput } from './input.js';
import { loadHighScore, saveHighScore, loadNickname, saveNickname } from './storage.js';
import { qualifiesForTop, cleanNickname } from './leaderboard.js';
import {
  normalizeUsername,
  validateUsername,
  validatePassword,
  describeAuthError,
} from './account.js';
import { setupAccountPanel } from './account-panel.js';
import {
  initCloud,
  loadSavedGame,
  saveGame,
  deleteSavedGame,
  submitScore,
  fetchTopScores,
  register,
  logIn,
  logOut,
  fetchAccount,
  waitForSavedGames,
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
let account = null; // { username, bestScore, gamesPlayed } zalogowanego gracza; null = gość
let finalScoreTask = Promise.resolve(); // trwająca obsługa wyniku ostatniej gry
// Rośnie przy każdej zmianie gracza; odpowiedzi z bazy zamówione wcześniej są wtedy ignorowane.
let userGeneration = 0;

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
    // Wysyłamy także wynik 0 — liczy się do rozegranych gier w profilu.
    finalScoreTask = handleFinalScore(state.score);
  }
}

// Zalogowany: wynik od razu pod loginem. Gość: wynik z top 10 czeka na nick,
// pozostałe wysyłamy od razu z zapamiętanym nickiem.
async function handleFinalScore(score) {
  if (account) {
    await sendScore(account.username, score);
    return;
  }

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
  await Promise.all([refreshLeaderboard(), account ? refreshAccount() : null]);
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

// Zwraca obietnicę zapisu, żeby przed zmianą konta można było poczekać, aż gra się zapisze.
function pause() {
  stopTimer();
  state = pauseGame(state);
  draw();
  if (!cloudReady) return Promise.resolve();

  return saveGame(serializeGame(state)).then((saved) => {
    if (!saved) showCloudError('Nie udało się zapisać gry — wznowienie po odświeżeniu nie będzie możliwe.');
  });
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

// ---------- Konto ----------

const accountPanel = setupAccountPanel({
  onLogIn: handleLogIn,
  onRegister: handleRegister,
  onLogOut: handleLogOut,
});

async function refreshAccount() {
  const generation = userGeneration;
  const fetched = await fetchAccount();
  if (generation !== userGeneration) return; // w międzyczasie zmienił się gracz

  account = fetched;
  if (account) {
    accountPanel.showAccount(account);
  } else {
    accountPanel.showGuest();
  }
}

// Zwraca poprawny login albo null (wtedy komunikat jest już w panelu).
function readCredentials(rawUsername, password) {
  const username = normalizeUsername(rawUsername);
  const problem = validateUsername(username) ?? validatePassword(password);
  if (problem) {
    accountPanel.showError(problem);
    return null;
  }
  return username;
}

// Rejestracja zamienia gościa w konto z tym samym ID — gra toczy się dalej bez przerwy.
async function handleRegister(rawUsername, password) {
  const username = readCredentials(rawUsername, password);
  if (!username) return;

  accountPanel.setBusy(true);
  try {
    const { ok, error } = await register(username, password);
    // Panel odświeżamy także po błędzie — rejestracja mogła przejść w połowie (konto bez profilu).
    await refreshAccount();
    if (!ok) accountPanel.showError(describeAuthError(error));
  } finally {
    accountPanel.setBusy(false);
  }
}

async function handleLogIn(rawUsername, password) {
  const username = readCredentials(rawUsername, password);
  if (!username) return;

  accountPanel.setBusy(true);
  try {
    await leaveCurrentUser();
    const { ok, error } = await logIn(username, password);
    if (!ok) {
      accountPanel.showError(describeAuthError(error));
      return;
    }
    await startAsNewUser();
  } finally {
    accountPanel.setBusy(false);
  }
}

async function handleLogOut() {
  accountPanel.setBusy(true);
  try {
    await leaveCurrentUser();
    const ok = await logOut();
    // Także po błędzie: sesja konta mogła już zostać zamknięta, więc gra startuje od nowa.
    await startAsNewUser();
    if (!ok) accountPanel.showError('Nie udało się wylogować — spróbuj ponownie.');
  } finally {
    accountPanel.setBusy(false);
  }
}

// Przed zmianą konta: trwająca gra zapisuje się (pauza), a porzucony wynik trafia do tabeli —
// oba jeszcze jako dotychczasowy gracz.
async function leaveCurrentUser() {
  if (state.status === 'playing') await pause();
  await finalScoreTask; // wynik gry zakończonej przed chwilą (może otworzyć formularz nicku)
  if (pendingScore !== null) await submitPendingScore(cleanNickname(loadNickname()));
  await waitForSavedGames();
  userGeneration += 1;
}

// Po zmianie konta: czysta plansza, potem zapis, tabela i profil nowego gracza.
async function startAsNewUser() {
  stopTimer();
  nicknameForm.hidden = true;
  isNewRecord = false;
  state = newGameState();
  draw();
  await loadUserData();
}

// ---------- Start ----------

async function loadUserData() {
  const generation = userGeneration;
  const [saved] = await Promise.all([loadSavedGame(), refreshLeaderboard(), refreshAccount()]);
  if (generation !== userGeneration) return; // zapis innego gracza — nie odtwarzamy
  const restored = saved && restoreGame(saved, { width: BOARD_SIZE, height: BOARD_SIZE, random: Math.random });

  // Zapis odtwarzamy tylko, jeśli gracz w międzyczasie nie zaczął nowej gry.
  if (restored && state.status === 'start') {
    state = restored;
    draw();
  }
}

async function connectCloud() {
  cloudStatusElement.textContent = 'Łączenie z bazą…';
  cloudReady = await initCloud();
  if (!cloudReady) {
    cloudStatusElement.textContent = 'Brak połączenia z bazą — wyniki i wznawianie gry niedostępne.';
    accountPanel.showUnavailable();
    return;
  }

  showCloudError('');
  await loadUserData();
}

setupInput({ onDirection: handleDirection, onEnter: handleEnter, onPause: handlePause });
onImagesLoaded(draw);
draw();
connectCloud();
