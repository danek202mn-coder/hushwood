// Концовки смерти: когда жизни (дни) кончились.
// Глава 1 — нарисованная сцена на холсте + строки текста; глава 2 — текст поверх 3D-сцены.

const ENDS1 = {
  hostess: { title: 'ВНУЧОК', lines: ['Хозяйка налила тебе чаю с травами.', 'Ты уснул прямо за столом.', 'Теперь у неё снова есть внучок. Навсегда.'], draw: drawKitchen },
  watchman: { title: 'ПОДВАЛ', lines: ['Сторож отнёс тебя в подвал.', 'Дверь заварили снаружи.', 'Сверху иногда слышны шаги. Но никто не спускается.'], draw: drawCell },
  yard: { title: 'МЕШОК', lines: ['Дворник завязал мешок потуже.', 'Хлопнула дверь белого фургона.', 'Тебя повезли в город. На Заводскую, 9.'], draw: drawSack },
  thing: { title: 'В СТЕНАХ', lines: ['Нечто утащило тебя в вентиляцию.', 'Ты до сих пор там, в темноте.', 'Ночью слышно, как ты скребёшься.'], draw: drawVent },
  koch: { title: 'ВЕЧНЫЙ ПАР', lines: ['Коч Братан парил тебя до утра.', 'Пар так и не кончился.', '«Ещё заход, братан…»'], draw: drawSteam },
  adam: { title: 'МОГНУТ', lines: ['Тру Адам посмотрел на тебя сверху вниз.', 'Ты не выдержал его ауры.', 'Теперь ты стоишь у него за спиной. Навсегда.'], draw: drawAura },
  drone: { title: 'ПРЯМОЕ ПОПАДАНИЕ', lines: ['Шахед упал слишком близко.', 'Дом устоял.', 'А ты — нет.'], draw: drawBoom },
};
export function ending1(who) { return ENDS1[who] || ENDS1.hostess; }

let RUN = null;
// показать концовку. opts: { draw: функция холста или null (поверх 3D), lines, title, onDone, dur }
export function playEnding(opts) {
  const el = document.getElementById('ending'), cv = document.getElementById('endCanvas'), tx = document.getElementById('endText'), ti = document.getElementById('endTitle');
  if (!el) { opts.onDone && opts.onDone(); return; }
  stopEnding();
  el.classList.remove('hidden'); el.classList.toggle('over3d', !opts.draw);
  tx.innerHTML = opts.lines.map(l => '<div>' + l + '</div>').join(''); ti.textContent = opts.title || '';
  [...tx.children].forEach((d, i) => { d.style.transitionDelay = (0.6 + i * 2.0) + 's'; });
  ti.style.transitionDelay = (0.8 + opts.lines.length * 2.0) + 's';
  void el.offsetWidth; el.classList.add('on');
  const dur = opts.dur || (2.8 + opts.lines.length * 2.0 + 2.4);
  const t0 = performance.now();
  const R = { done: false, raf: 0 };
  const finish = () => { if (R.done) return; R.done = true; cancelAnimationFrame(R.raf); el.classList.remove('on'); setTimeout(() => el.classList.add('hidden'), 400); RUN = null; opts.onDone && opts.onDone(); };
  const skip = () => { if ((performance.now() - t0) / 1000 > 1.5) finish(); };
  el.onclick = skip;
  const g = cv.getContext('2d');
  const tick = () => {
    if (R.done) return;
    const t = (performance.now() - t0) / 1000;
    if (opts.draw) { const w = cv.width = Math.min(1280, window.innerWidth * (window.devicePixelRatio > 1 ? 1.5 : 1)), h = cv.height = Math.round(w * window.innerHeight / window.innerWidth); opts.draw(g, w, h, t); }
    if (t > dur) { finish(); return; }
    R.raf = requestAnimationFrame(tick);
  };
  RUN = R; tick();
  return R;
}
export function stopEnding() { const el = document.getElementById('ending'); if (RUN) { RUN.done = true; cancelAnimationFrame(RUN.raf); RUN = null; } if (el) { el.classList.remove('on'); el.classList.add('hidden'); } }

// ---------- рисунки (всё процедурно, без картинок) ----------
const rnd = (s) => { let x = s; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
function vignette(g, w, h, k = 0.85) { const v = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = v; g.fillRect(0, 0, w, h); }
function grain(g, w, h, t) { const R = rnd((t * 60 | 0) + 7); g.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 400; i++) g.fillRect(R() * w, R() * h, 2, 2); }
function drawKitchen(g, w, h, t) {
  g.fillStyle = '#120c08'; g.fillRect(0, 0, w, h);
  const sw = Math.sin(t * 1.3) * 0.15, lx = w / 2 + Math.sin(sw) * h * 0.4, ly = h * 0.28;
  const L = g.createRadialGradient(lx, ly + h * 0.25, 10, lx, ly + h * 0.25, h * 0.8); L.addColorStop(0, 'rgba(255,190,110,0.55)'); L.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = L; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(lx, ly); g.stroke();
  g.fillStyle = '#3a2410'; g.beginPath(); g.moveTo(lx - h * 0.1, ly + h * 0.06); g.lineTo(lx + h * 0.1, ly + h * 0.06); g.lineTo(lx + h * 0.04, ly); g.lineTo(lx - h * 0.04, ly); g.fill();
  g.fillStyle = '#ffd890'; g.beginPath(); g.arc(lx, ly + h * 0.065, h * 0.02, 0, 7); g.fill();
  g.fillStyle = '#2a1608'; g.fillRect(w * 0.15, h * 0.68, w * 0.7, h * 0.05); g.fillRect(w * 0.2, h * 0.73, w * 0.03, h * 0.27); g.fillRect(w * 0.77, h * 0.73, w * 0.03, h * 0.27);
  // чашка и пар
  const cx = w * 0.42, cy = h * 0.64; g.fillStyle = '#d8d0c0'; g.fillRect(cx - h * 0.035, cy - h * 0.05, h * 0.07, h * 0.05); g.strokeStyle = '#d8d0c0'; g.lineWidth = h * 0.008; g.beginPath(); g.arc(cx + h * 0.04, cy - h * 0.025, h * 0.015, -1.5, 1.5); g.stroke();
  g.strokeStyle = 'rgba(220,220,220,0.25)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); for (let k = 0; k < 20; k++) { const y = cy - h * 0.06 - k * h * 0.01, x = cx + (i - 1) * 10 + Math.sin(t * 2 + k * 0.4 + i) * 8; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  // силуэт старухи в платке
  const bx = w * 0.66, by = h * 0.68; g.fillStyle = '#050302'; g.beginPath(); g.ellipse(bx, by - h * 0.12, h * 0.1, h * 0.14, 0, 0, 7); g.fill(); g.beginPath(); g.arc(bx, by - h * 0.3, h * 0.055, 0, 7); g.fill();
  g.beginPath(); g.moveTo(bx - h * 0.07, by - h * 0.28); g.lineTo(bx + h * 0.07, by - h * 0.28); g.lineTo(bx + h * 0.1, by - h * 0.2); g.lineTo(bx - h * 0.1, by - h * 0.2); g.fill();
  if (Math.sin(t * 0.9) > 0.6) { g.fillStyle = 'rgba(255,240,200,0.8)'; g.fillRect(bx - h * 0.025, by - h * 0.31, 3, 2); g.fillRect(bx + h * 0.02, by - h * 0.31, 3, 2); }
  vignette(g, w, h); grain(g, w, h, t);
  g.fillStyle = `rgba(0,0,0,${Math.min(0.75, Math.max(0, (t - 4) * 0.12))})`; g.fillRect(0, 0, w, h);
}
function drawCell(g, w, h, t) {
  g.fillStyle = '#070808'; g.fillRect(0, 0, w, h);
  const on = Math.random() > (t > 5 ? 0.35 : 0.08);
  if (on) { const L = g.createRadialGradient(w / 2, h * 0.15, 5, w / 2, h * 0.15, h); L.addColorStop(0, 'rgba(255,230,170,0.5)'); L.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = L; g.fillRect(0, 0, w, h); }
  g.fillStyle = '#2a2420'; for (let y = 0; y < h; y += h * 0.07) for (let x = (y / (h * 0.07)) % 2 ? -h * 0.06 : 0; x < w; x += h * 0.12) { g.fillStyle = `rgba(60,40,30,${on ? 0.5 : 0.15})`; g.fillRect(x + 2, y + 2, h * 0.115, h * 0.065); }
  g.fillStyle = on ? '#ffe8b0' : '#332'; g.beginPath(); g.arc(w / 2, h * 0.12, h * 0.02, 0, 7); g.fill();
  g.fillStyle = '#000'; for (let i = 0; i < 7; i++) g.fillRect(w * 0.3 + i * w * 0.065, h * 0.25, w * 0.012, h * 0.75);
  g.fillRect(w * 0.29, h * 0.25, w * 0.42, h * 0.02); g.fillRect(w * 0.29, h * 0.6, w * 0.42, h * 0.02);
  vignette(g, w, h, 0.9); grain(g, w, h, t);
}
function drawSack(g, w, h, t) {
  const k = Math.min(1, t / 6);
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const r = (1 - k) * Math.max(w, h) * 0.6 + h * 0.05;
  g.save(); g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.clip();
  g.fillStyle = '#0a0c12'; g.fillRect(0, 0, w, h);
  const hl = g.createRadialGradient(w * 0.7, h * 0.6, 5, w * 0.7, h * 0.6, h * 0.6); hl.addColorStop(0, 'rgba(255,250,220,0.8)'); hl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hl; g.fillRect(0, 0, w, h);
  g.fillStyle = '#d8d4c8'; g.fillRect(w * 0.45, h * 0.45, w * 0.45, h * 0.3); g.fillStyle = '#7a1a1a'; g.fillRect(w * 0.45, h * 0.62, w * 0.45, h * 0.03);
  g.restore();
  g.strokeStyle = 'rgba(90,70,40,0.8)'; g.lineWidth = 3; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); g.lineTo(w / 2 + Math.cos(a) * (r + h * 0.4), h / 2 + Math.sin(a) * (r + h * 0.4)); g.stroke(); }
  const R = rnd(3); g.fillStyle = 'rgba(80,60,30,0.35)'; for (let i = 0; i < 900; i++) { const x = R() * w, y = R() * h; if (Math.hypot(x - w / 2, y - h / 2) > r) g.fillRect(x, y, 3, 1); }
  grain(g, w, h, t);
}
function drawVent(g, w, h, t) {
  g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
  const s = Math.min(w, h) * 0.7, x0 = (w - s) / 2, y0 = (h - s) / 2;
  g.fillStyle = '#1a1a1a'; g.fillRect(x0, y0, s, s);
  const blink = Math.sin(t * 3) > -0.9;
  if (blink) for (const [ex, ey] of [[0.4, 0.45], [0.6, 0.45], [0.3, 0.7], [0.75, 0.3]]) { g.fillStyle = 'rgba(255,220,120,0.9)'; g.beginPath(); g.ellipse(x0 + ex * s, y0 + ey * s, s * 0.018, s * 0.008, 0, 0, 7); g.fill(); }
  g.fillStyle = '#3a3a38'; for (let i = 0; i <= 10; i++) g.fillRect(x0, y0 + i * s / 10, s, s * 0.025);
  g.strokeStyle = '#3a3a38'; g.lineWidth = s * 0.03; g.strokeRect(x0, y0, s, s);
  const R = rnd((t * 4 | 0) + 1); g.strokeStyle = 'rgba(180,170,160,0.5)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const x = x0 + R() * s; g.beginPath(); g.moveTo(x, y0 + s * 0.2); g.lineTo(x + 6, y0 + s * 0.35); g.stroke(); }
  vignette(g, w, h, 0.95); grain(g, w, h, t);
}
function drawSteam(g, w, h, t) {
  g.fillStyle = '#2a1408'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#4a2a14'; for (let i = 0; i < 6; i++) g.fillRect(0, h * 0.62 + i * h * 0.06, w, h * 0.05);
  const R = rnd(11);
  for (let i = 0; i < 40; i++) { const bx = R() * w, by = h - ((R() * h + t * 40 * (0.5 + R())) % (h * 1.3)), r = h * (0.08 + R() * 0.15); const gr = g.createRadialGradient(bx, by, 1, bx, by, r); gr.addColorStop(0, `rgba(240,230,220,${0.12 + Math.min(0.2, t * 0.03)})`); gr.addColorStop(1, 'rgba(240,230,220,0)'); g.fillStyle = gr; g.fillRect(bx - r, by - r, r * 2, r * 2); }
  g.fillStyle = '#100604'; g.beginPath(); g.ellipse(w * 0.7, h * 0.55, h * 0.12, h * 0.22, 0, 0, 7); g.fill(); g.beginPath(); g.arc(w * 0.7, h * 0.28, h * 0.07, 0, 7); g.fill();
  g.strokeStyle = '#100604'; g.lineWidth = h * 0.02; g.beginPath(); g.moveTo(w * 0.75, h * 0.42); g.lineTo(w * 0.85, h * 0.25 + Math.sin(t * 6) * h * 0.05); g.stroke();
  g.fillStyle = '#2a4a10'; g.beginPath(); g.ellipse(w * 0.86, h * 0.22 + Math.sin(t * 6) * h * 0.05, h * 0.05, h * 0.03, 0.5, 0, 7); g.fill();
  vignette(g, w, h, 0.7); grain(g, w, h, t);
}
function drawAura(g, w, h, t) {
  g.fillStyle = '#05000a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) { const r = h * (0.25 + i * 0.12) + Math.sin(t * 3 + i) * 10; g.strokeStyle = `rgba(170,80,255,${0.35 - i * 0.05})`; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h * 0.55, r, 0, 7); g.stroke(); }
  g.fillStyle = '#000'; g.beginPath(); g.moveTo(w / 2 - h * 0.16, h); g.lineTo(w / 2 - h * 0.13, h * 0.55); g.lineTo(w / 2 + h * 0.13, h * 0.55); g.lineTo(w / 2 + h * 0.16, h); g.fill();
  g.beginPath(); g.moveTo(w / 2 - h * 0.1, h * 0.55); g.lineTo(w / 2 - h * 0.12, h * 0.3); g.quadraticCurveTo(w / 2, h * 0.12, w / 2 + h * 0.12, h * 0.3); g.lineTo(w / 2 + h * 0.1, h * 0.55); g.lineTo(w / 2, h * 0.6); g.fill();
  g.fillStyle = `rgba(255,255,255,${0.6 + Math.sin(t * 8) * 0.3})`; g.fillRect(w / 2 - h * 0.06, h * 0.33, h * 0.035, 3); g.fillRect(w / 2 + h * 0.025, h * 0.33, h * 0.035, 3);
  vignette(g, w, h, 0.8); grain(g, w, h, t);
}
function drawBoom(g, w, h, t) {
  const f = Math.max(0, 1 - t * 0.8);
  g.fillStyle = `rgb(${20 + f * 235},${10 + f * 200},${f * 120})`; g.fillRect(0, 0, w, h);
  const R = rnd(5);
  for (let i = 0; i < 30; i++) { const a = R() * 7, d = (t * 120 + R() * 80) * (0.5 + R()), x = w / 2 + Math.cos(a) * d * 3, y = h * 0.7 - Math.abs(Math.sin(a)) * d * 2; const r = h * (0.05 + R() * 0.1) * (1 + t * 0.3); const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(40,36,32,0.6)'); gr.addColorStop(1, 'rgba(40,36,32,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.fillStyle = '#000'; g.fillRect(0, h * 0.82, w, h * 0.18);
  vignette(g, w, h, 0.8); grain(g, w, h, t);
}
