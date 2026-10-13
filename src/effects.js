// Krótkie efekty na planszy: iskry, unoszące się „+1”, błyski i trzęsienie.
// Efekt to zwykły obiekt z czasem startu i długością trwania. Funkcje logiki są czyste
// (zwracają nową listę, czas dostają z zewnątrz) i testowane; rysowanie jest na końcu pliku.

export const BURST_DURATION_MS = 600;
export const FLOAT_TEXT_DURATION_MS = 800;
export const FLASH_DURATION_MS = 450;
export const SHAKE_DURATION_MS = 350;

const SHAKE_AMPLITUDE_PX = 6;

export function createEffects() {
  return [];
}

/**
 * Iskry rozlatujące się z punktu (współrzędne w pikselach canvasu).
 * @param {{ count: number, colors: string[], speed?: number }} options
 */
export function addSparks(effects, { x, y }, now, random, { count, colors, speed = 90 }) {
  const sparks = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + random() * 0.6;
    const sparkSpeed = speed * (0.5 + random()); // px na sekundę
    return {
      vx: Math.cos(angle) * sparkSpeed,
      vy: Math.sin(angle) * sparkSpeed,
      color: colors[i % colors.length],
    };
  });
  return [...effects, { type: 'sparks', x, y, sparks, start: now, duration: BURST_DURATION_MS }];
}

/** Zjedzenie owocu: czerwono-zielone iskry i napis „+1”. */
export function addEatEffect(effects, position, now, random) {
  const withSparks = addSparks(effects, position, now, random, {
    count: 12,
    colors: ['#ff6b5b', '#ff6b5b', '#6ee06e'],
  });
  return [
    ...withSparks,
    { type: 'text', x: position.x, y: position.y, text: '+1', start: now, duration: FLOAT_TEXT_DURATION_MS },
  ];
}

/** Błysk całej planszy w danym kolorze (np. przyspieszenie, koniec gry). */
export function addFlash(effects, color, now) {
  return [...effects, { type: 'flash', color, start: now, duration: FLASH_DURATION_MS }];
}

export function addShake(effects, now) {
  return [...effects, { type: 'shake', start: now, duration: SHAKE_DURATION_MS }];
}

/** Usuwa efekty, których czas minął. */
export function pruneEffects(effects, now) {
  return effects.filter((effect) => now - effect.start < effect.duration);
}

/** Postęp efektu od 0 (start) do 1 (koniec). */
export function progress(effect, now) {
  return Math.min(1, Math.max(0, (now - effect.start) / effect.duration));
}

/** Przesunięcie planszy przy trzęsieniu (px); słabnie do zera. */
export function shakeOffset(effects, now) {
  const shake = effects.find((effect) => effect.type === 'shake');
  if (!shake) return { x: 0, y: 0 };

  const t = progress(shake, now);
  const amplitude = SHAKE_AMPLITUDE_PX * (1 - t);
  return { x: Math.sin(t * 40) * amplitude, y: Math.cos(t * 31) * amplitude };
}

/** Położenie iskry w danej chwili — leci od środka i zwalnia. */
export function sparkPosition(effect, spark, now) {
  const seconds = (now - effect.start) / 1000;
  const slowdown = 1 - progress(effect, now) * 0.5;
  return {
    x: effect.x + spark.vx * seconds * slowdown,
    y: effect.y + spark.vy * seconds * slowdown,
  };
}

// ---------- Rysowanie ----------

/** Rysuje wszystkie efekty (bez trzęsienia — to przesuwa całą planszę w render.js). */
export function drawEffects(ctx, effects, now) {
  for (const effect of effects) {
    const t = progress(effect, now);
    ctx.save();
    if (effect.type === 'sparks') drawSparks(ctx, effect, t, now);
    if (effect.type === 'text') drawFloatingText(ctx, effect, t);
    if (effect.type === 'flash') drawFlash(ctx, effect, t);
    ctx.restore();
  }
}

function drawSparks(ctx, effect, t, now) {
  ctx.globalAlpha = 1 - t;
  for (const spark of effect.sparks) {
    const { x, y } = sparkPosition(effect, spark, now);
    ctx.fillStyle = spark.color;
    ctx.shadowColor = spark.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x, y, 2.5 * (1 - t) + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloatingText(ctx, effect, t) {
  ctx.globalAlpha = 1 - t * t;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0b0d10';
  ctx.fillStyle = '#ffd54f';
  const y = effect.y - 10 - t * 28; // unosi się w górę
  ctx.strokeText(effect.text, effect.x, y);
  ctx.fillText(effect.text, effect.x, y);
}

function drawFlash(ctx, effect, t) {
  const { width, height } = ctx.canvas;
  const strength = 1 - t;
  // Poświata przy krawędziach planszy i lekkie zabarwienie środka.
  ctx.globalAlpha = 0.18 * strength;
  ctx.fillStyle = effect.color;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.9 * strength;
  ctx.strokeStyle = effect.color;
  ctx.lineWidth = 6;
  ctx.shadowColor = effect.color;
  ctx.shadowBlur = 18;
  ctx.strokeRect(3, 3, width - 6, height - 6);
}
