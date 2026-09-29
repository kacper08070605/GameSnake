// Rysowanie stanu gry na canvas.

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

/**
 * Rysuje całą klatkę gry.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state stan z game.js
 * @param {{ highScore: number, isNewRecord: boolean }} info
 */
export function render(ctx, state, { highScore, isNewRecord }) {
  drawBoard(ctx, state.width, state.height);
  if (state.food) drawFood(ctx, state.food);
  drawSnake(ctx, state.snake);

  if (state.status === 'start') {
    drawOverlay(ctx, [
      { text: 'Naciśnij strzałkę, aby zacząć', size: 20 },
      { text: `Rekord: ${highScore}`, size: 16 },
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
}

function drawBoard(ctx, width, height) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width * CELL_SIZE, height * CELL_SIZE);

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

function drawFood(ctx, food) {
  const radius = CELL_SIZE / 2 - 2;
  ctx.fillStyle = COLORS.food;
  ctx.beginPath();
  ctx.arc(
    food.x * CELL_SIZE + CELL_SIZE / 2,
    food.y * CELL_SIZE + CELL_SIZE / 2,
    radius,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawCell(ctx, { x, y }) {
  ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
}

// Półprzezroczysta nakładka z wyśrodkowanymi liniami tekstu.
function drawOverlay(ctx, lines) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, width, height);

  const lineGap = 14;
  const totalHeight = lines.reduce((sum, line) => sum + line.size + lineGap, -lineGap);
  let y = (height - totalHeight) / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const line of lines) {
    ctx.fillStyle = line.color ?? COLORS.text;
    ctx.font = `bold ${line.size}px system-ui, sans-serif`;
    ctx.fillText(line.text, width / 2, y);
    y += line.size + lineGap;
  }
}
