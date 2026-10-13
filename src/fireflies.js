// Świetliki nad tłem dżungli: powoli dryfują i pulsują światłem.
// Rysowane na osobnym canvasie pod grą, tylko w bocznych pasach ekranu — środek z planszą zostaje spokojny.

const COUNT = 30;
const SIDE_BAND = 0.3; // szerokość pasa przy każdej krawędzi (część szerokości ekranu)

/** Uruchamia animację świetlików na podanym canvasie (rozciągniętym na całe okno). */
export function startFireflies(canvas) {
  const ctx = canvas.getContext('2d');
  let flies = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    flies = Array.from({ length: COUNT }, createFly);
  }

  function createFly() {
    const width = window.innerWidth;
    const onLeft = Math.random() < 0.5;
    const bandX = Math.random() * width * SIDE_BAND;
    return {
      x: onLeft ? bandX : width - bandX,
      y: Math.random() * window.innerHeight,
      radius: 1.5 + Math.random() * 2.5,
      // Każdy świetlik ma własny rytm dryfu i pulsowania.
      driftX: 8 + Math.random() * 14,
      driftY: 6 + Math.random() * 10,
      speed: 0.00025 + Math.random() * 0.0004,
      pulse: 0.0012 + Math.random() * 0.0018,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function frame(now) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const fly of flies) {
      const x = fly.x + Math.sin(now * fly.speed + fly.phase) * fly.driftX;
      const y = fly.y + Math.cos(now * fly.speed * 0.8 + fly.phase) * fly.driftY;
      const glow = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * fly.pulse + fly.phase));
      drawFly(x, y, fly.radius, glow);
    }
    requestAnimationFrame(frame);
  }

  function drawFly(x, y, radius, glow) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 5);
    halo.addColorStop(0, `rgba(217, 255, 184, ${glow})`);
    halo.addColorStop(0.3, `rgba(157, 255, 122, ${glow * 0.55})`);
    halo.addColorStop(1, 'rgba(110, 224, 110, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, radius * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
}
