// Rysowanie stanu gry na canvas — wywoływane w każdej klatce animacji (requestAnimationFrame).

import { drawEffects, shakeOffset } from './effects.js';

export const CELL_SIZE = 20;

const COLORS = {
  background: '#111418',
  grid: '#1b2027',
  snakeBody: '#2e9d3a',
  snakeHead: '#6ee06e',
  food: '#e53935',
  overlay: 'rgba(0, 0, 0, 0.65)',
  text: '#ffffff',
  highlight: '#ffd54f',
};

// Grafiki SVG. Dopóki się nie wczytają (albo gdy się nie wczytają), rysujemy zwykłe kolory.
const IMAGES = {
  board: loadImage('assets/board-bg.svg'),
  food: loadImage('assets/apple.svg'),
  start: loadImage('assets/start.svg'),
};

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function isLoaded(image) {
  return image.complete && image.naturalWidth > 0;
}

// SVG rysowane w każdej klatce byłoby drogie — rasteryzujemy je raz do zwykłego canvasu.
const rasterCache = new Map();

function raster(image, width, height) {
  if (!isLoaded(image)) return null;
  const key = `${image.src}@${width}x${height}`;
  if (!rasterCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    rasterCache.set(key, canvas);
  }
  return rasterCache.get(key);
}

const FOOD_POP_MS = 250;

/**
 * Rysuje całą klatkę gry.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state stan z game.js
 * @param {{
 *   highScore: number, isNewRecord: boolean,
 *   now: number,              // czas klatki (performance.now)
 *   effects: object[],        // efekty z effects.js
 *   foodAppearedAt: number,   // kiedy pojawił się obecny owoc (do animacji „pop”)
 *   motion: boolean,          // false = użytkownik prosi o ograniczenie ruchu
 * }} info
 */
export function render(ctx, state, { highScore, isNewRecord, now, effects, foodAppearedAt, motion }) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Trzęsienie przesuwa całą planszę (tło, owoc, wąż) o kilka pikseli.
  const shake = motion ? shakeOffset(effects, now) : { x: 0, y: 0 };
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawBoard(ctx, state.width, state.height);
  if (state.food) drawFood(ctx, state.food, now, foodAppearedAt, motion);
  drawSnake(ctx, state.snake);
  ctx.restore();

  // Pulsowanie napisów i kołysanie ilustracji — wolne, żeby nie rozpraszały.
  const pulse = motion ? 0.75 + 0.25 * Math.sin(now / 450) : 1;
  const sway = motion ? Math.sin(now / 900) * 3 : 0;

  if (state.status === 'start') {
    drawOverlay(
      ctx,
      [
        { text: 'Naciśnij strzałkę, aby zacząć', size: 20, alpha: pulse },
        { text: `Rekord: ${highScore}`, size: 16 },
        { text: 'Spacja — pauza w trakcie gry', size: 14 },
      ],
      { image: IMAGES.start, offsetY: sway },
    );
  } else if (state.status === 'paused') {
    drawOverlay(ctx, [
      { text: 'Pauza', size: 32, alpha: pulse },
      { text: `Wynik: ${state.score}`, size: 18 },
      { text: 'Spacja — wznów', size: 16 },
      { text: 'Enter — nowa gra', size: 16 },
    ]);
  } else if (state.status === 'over') {
    const lines = [
      { text: state.won ? 'Wygrana!' : 'Koniec gry', size: 32 },
      { text: `Wynik: ${state.score}`, size: 18 },
      { text: `Rekord: ${highScore}`, size: 18 },
    ];
    if (isNewRecord) lines.push({ text: 'Nowy rekord!', size: 18, color: COLORS.highlight });
    lines.push({ text: 'Enter — zagraj ponownie', size: 16 });
    drawOverlay(ctx, lines);
  }

  // Efekty na wierzchu — także nad nakładką (np. złote iskry nowego rekordu).
  drawEffects(ctx, effects, now);
}

function drawBoard(ctx, width, height) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width * CELL_SIZE, height * CELL_SIZE);
  const board = raster(IMAGES.board, width * CELL_SIZE, height * CELL_SIZE);
  if (board) ctx.drawImage(board, 0, 0);

  // Delikatna siatka pól.
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < width; x++) {
    ctx.moveTo(x * CELL_SIZE + 0.5, 0);
    ctx.lineTo(x * CELL_SIZE + 0.5, height * CELL_SIZE);
  }
  for (let y = 1; y < height; y++) {
    ctx.moveTo(0, y * CELL_SIZE + 0.5);
    ctx.lineTo(width * CELL_SIZE, y * CELL_SIZE + 0.5);
  }
  ctx.stroke();
}

function drawSnake(ctx, snake) {
  // Rysujemy od ogona, żeby głowa zawsze była na wierzchu.
  for (let i = snake.length - 1; i >= 0; i--) {
    ctx.fillStyle = i === 0 ? COLORS.snakeHead : COLORS.snakeBody;
    drawCell(ctx, snake[i]);
  }
}

// Owoc lekko pulsuje, a nowy pojawia się z krótkim „pop” (rośnie od zera z małym przeskokiem).
function drawFood(ctx, food, now, appearedAt, motion) {
  let scale = 1;
  if (motion) {
    const popProgress = Math.min(1, Math.max(0, (now - appearedAt) / FOOD_POP_MS));
    scale = easeOutBack(popProgress) * (1 + 0.07 * Math.sin(now / 260));
  }

  const centerX = food.x * CELL_SIZE + CELL_SIZE / 2;
  const centerY = food.y * CELL_SIZE + CELL_SIZE / 2;
  const size = CELL_SIZE * scale;
  const image = raster(IMAGES.food, 64, 64);
  if (image) {
    ctx.drawImage(image, centerX - size / 2, centerY - size / 2, size, size);
    return;
  }

  ctx.fillStyle = COLORS.food;
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(0, (CELL_SIZE / 2 - 2) * scale), 0, Math.PI * 2);
  ctx.fill();
}

// 0 → 1 z lekkim przekroczeniem jedynki pod koniec (efekt sprężynki).
function easeOutBack(t) {
  const overshoot = 1.7;
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

function drawCell(ctx, { x, y }) {
  ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
}

// Półprzezroczysta nakładka z wyśrodkowanymi liniami tekstu (opcjonalnie z ilustracją pod tekstem).
function drawOverlay(ctx, lines, illustration) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, width, height);
  const picture = illustration && raster(illustration.image, width, height);
  if (picture) ctx.drawImage(picture, 0, illustration.offsetY);

  const lineGap = 14;
  const totalHeight = lines.reduce((sum, line) => sum + line.size + lineGap, -lineGap);
  let y = (height - totalHeight) / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const line of lines) {
    ctx.globalAlpha = line.alpha ?? 1;
    ctx.fillStyle = line.color ?? COLORS.text;
    ctx.font = `bold ${line.size}px system-ui, sans-serif`;
    ctx.fillText(line.text, width / 2, y);
    y += line.size + lineGap;
  }
  ctx.globalAlpha = 1;
}
