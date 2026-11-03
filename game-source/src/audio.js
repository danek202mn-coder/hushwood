// Весь звук генерируется кодом: эффекты, страшная музыка и голоса персонажей.
const A = { ctx: null, master: null, sfx: null, mus: null, noise: null, listener: { x: 0, y: 0, z: 0, yaw: 0 }, set: { music: 0.7, sfx: 0.9, voice: true }, mode: 'off', layers: null, timer: null, next: 0, step: 0, evT: 0 };

export function audioSettings(s) {
  Object.assign(A.set, s);
  if (A.ctx) { A.sfx.gain.value = A.set.sfx; A.mus.gain.value = A.set.music * 0.8; }
}

export function ensureAudio() {
  try {
    if (!A.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      A.ctx = new C();
      A.master = A.ctx.createGain(); A.master.gain.value = 1; A.master.connect(A.ctx.destination);
      const comp = A.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      A.sfx = A.ctx.createGain(); A.sfx.gain.value = A.set.sfx; A.sfx.connect(comp);
      A.mus = A.ctx.createGain(); A.mus.gain.value = A.set.music * 0.8; A.mus.connect(comp);
      comp.connect(A.master);
      const len = A.ctx.sampleRate * 2;
      A.noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = A.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      startLayers();
      loadDance();
      A.timer = setInterval(scheduler, 50);
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    loadDance();
  } catch (e) { /* звук не обязателен */ }
}

export function setListener(x, y, z, yaw) { const l = A.listener; l.x = x; l.y = y; l.z = z; l.yaw = yaw; }

function att(pos, maxD) {
  if (!pos) return { a: 1, pan: 0, d: 0 };
  const dx = pos.x - A.listener.x, dy = (pos.y - A.listener.y) * 2, dz = pos.z - A.listener.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  let a = Math.max(0, 1 - d / maxD); a *= a;
  const rx = Math.cos(A.listener.yaw), rz = -Math.sin(A.listener.yaw);
  const pan = d > 0.01 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
  return { a, pan, d };
}
function out(pos, maxD, vol, bus) {
  const c = A.ctx, { a, pan } = att(pos, maxD);
  if (a <= 0.001) return null;
  const g = c.createGain(); g.gain.value = vol * a;
  if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan * 0.8; g.connect(p); p.connect(bus || A.sfx); }
  else g.connect(bus || A.sfx);
  return g;
}
function nb(pos, maxD, vol, dur, type, freq, q = 1, bus, delay = 0, slideTo) {
  if (!A.ctx) return;
  const dst = out(pos, maxD, vol, bus); if (!dst) return;
  const c = A.ctx, t = c.currentTime + delay;
  const s = c.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(1, t + 0.008); e.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(e); e.connect(dst);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function tone(pos, maxD, vol, freq, dur, type = 'sine', slideTo = null, delay = 0, bus, attack = 0.01, when) {
  if (!A.ctx) return;
  const dst = out(pos, maxD, vol, bus); if (!dst) return;
  const c = A.ctx, t = when !== undefined ? when : c.currentTime + delay;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const e = c.createGain(); e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(1, t + attack);
  e.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(e); e.connect(dst); o.start(t); o.stop(t + dur + 0.05);
}

// ---------- трек для танца (файл, который прислали) ----------
// треки из присланных файлов: dance — танцы, shahed — дрон и танец «самолётик»
const TR = {
  dance: { key: '__DANCE', buf: null, src: null, gain: null, pan: null, len: 30.6, loading: false },
  shahed: { key: '__SHAHED', buf: null, src: null, gain: null, pan: null, len: 24.4, loading: false },
  adam: { key: '__ADAM', buf: null, src: null, gain: null, pan: null, len: 68.5, loading: false },
  ch2: { key: '__CH2INTRO', buf: null, src: null, gain: null, pan: null, len: 14, loading: false },
};
const DT = TR.dance;
export const trackLen = (n) => TR[n].len;
export const danceLen = () => TR.dance.len;
function loadTrack(T) {
  const b64 = window[T.key];
  if (T.buf || T.loading || !A.ctx || !b64 || b64.length < 100) return;
  T.loading = true;
  try {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const done = (b) => { T.buf = b; T.len = b.duration; T.loading = false; };
    const p = A.ctx.decodeAudioData(u.buffer, done, () => { T.loading = false; });
    if (p && p.catch) p.catch(() => { T.loading = false; });
  } catch (e) { T.loading = false; }
}
function loadDance() { loadTrack(TR.dance); loadTrack(TR.shahed); loadTrack(TR.adam); loadTrack(TR.ch2); }
export const trackReady = (n) => !!TR[n].buf;
// сколько секунд трека уже прозвучало (с поправкой на задержку вывода звука)
export function trackTime(n) { const T = TR[n]; if (!T.src || !A.ctx) return -1; return A.ctx.currentTime - T.t0 - (A.ctx.outputLatency || A.ctx.baseLatency || 0); }
// включить/выключить трек; offset — с какой секунды
export function playTrack(name, on, offset = 0, loop = false) {
  const T = TR[name];
  if (!A.ctx) return false;
  if (T.src) { try { T.src.stop(); } catch (e) { } T.src = null; }
  if (!on || !T.buf) return false;
  const c = A.ctx;
  T.gain = c.createGain(); T.gain.gain.value = 0;
  T.pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (T.pan) { T.gain.connect(T.pan); T.pan.connect(A.mus); } else T.gain.connect(A.mus);
  T.src = c.createBufferSource(); T.src.buffer = T.buf; T.src.loop = !!loop; T.src.connect(T.gain);
  const off = Math.max(0, loop ? offset % T.len : Math.min(T.len - 0.1, offset)), when = c.currentTime + 0.05;
  T.src.start(when, off); T.t0 = when - off;
  return true;
}
// громкость по расстоянию до источника: рядом — громко, далеко — еле слышно (но слышно всем)
export function trackVol(name, pos, minV = 0.1, maxD = 34, boost = 1.1) {
  const T = TR[name];
  if (!T.src || !A.ctx) return;
  const { a, pan } = att(pos, maxD);
  T.gain.gain.setTargetAtTime(Math.max(minV, a) * boost, A.ctx.currentTime, 0.15);
  if (T.pan) T.pan.pan.setTargetAtTime(pan * 0.6, A.ctx.currentTime, 0.15);
}
export function danceTrack(on, offset = 0) { return playTrack('dance', on, offset); }
export function danceVol(pos) { trackVol('dance', pos); }

// ---------- фонк для аура-баттла (своя мелодия: ковбелл, 808, хэты) ----------
const PH = { on: false, start: 0, bpm: 140, step: 0, next: 0, timer: null };
export const phonkBpm = () => PH.bpm;
export function phonkTime() { return A.ctx && PH.on ? A.ctx.currentTime - PH.start : -1; }
export function startPhonk(bpm = 140) {
  if (!A.ctx) return false;
  PH.bpm = bpm; PH.on = true; PH.start = A.ctx.currentTime + 0.6; PH.step = 0; PH.next = PH.start;
  clearInterval(PH.timer); PH.timer = setInterval(phonkSched, 25);
  return true;
}
export function stopPhonk() { PH.on = false; clearInterval(PH.timer); }
const BELL = [12, null, 12, 15, null, 12, 10, null, 12, null, 7, null, 10, 12, null, 15, 17, null, 15, 12, null, 10, 12, null, 7, null, 10, null, 5, 7, null, null];
const BASS = [0, 0, null, 0, null, null, -2, null, -4, null, -4, null, -5, null, -2, null];
function phonkSched() {
  if (!PH.on || !A.ctx) return;
  const c = A.ctx, sp = 60 / PH.bpm / 4;
  while (PH.next < c.currentTime + 0.2) {
    const t = PH.next, st = PH.step, s32 = st % 32, s16 = st % 16, bar = Math.floor(st / 16);
    const intro = bar < 1;
    // ковбелл-мелодия (резкая, с «металлом»)
    const n = BELL[s32];
    if (n !== null && !intro) { const f = 392 * Math.pow(2, n / 12); tone(null, 1, 0.09, f, 0.22, 'square', null, 0, A.mus, 0.002, t); tone(null, 1, 0.06, f * 1.47, 0.16, 'square', null, 0, A.mus, 0.002, t); }
    // 808 с глайдом
    const b = BASS[s16];
    if (b !== null) { const f = 49 * Math.pow(2, (b + (bar % 4 === 3 ? -3 : 0)) / 12); tone(null, 1, 0.5, f * 1.5, sp * 3.2, 'sine', f, 0, A.mus, 0.003, t); tone(null, 1, 0.12, f * 2, sp * 2, 'triangle', f, 0, A.mus, 0.003, t); }
    // бочка, снэйр, хэты (с триолями)
    if (s16 === 0 || s16 === 10) { tone(null, 1, 0.55, 120, 0.18, 'sine', 40, 0, A.mus, 0.002, t); }
    if (s16 === 4 || s16 === 12) { nb(null, 1, 0.35, 0.16, 'bandpass', 1800, 0.9, A.mus, t - c.currentTime); tone(null, 1, 0.12, 220, 0.08, 'triangle', 160, 0, A.mus, 0.002, t); }
    if (!intro) { nb(null, 1, 0.07, 0.03, 'highpass', 8000, 1, A.mus, t - c.currentTime); if (s16 === 14) { for (let k = 1; k < 3; k++) nb(null, 1, 0.06, 0.02, 'highpass', 9000, 1, A.mus, t - c.currentTime + k * sp / 3); } }
    // «вокальный» отклик раз в 2 такта
    if (s32 === 30 && !intro) nb(null, 1, 0.12, 0.25, 'bandpass', 900, 6, A.mus, t - c.currentTime, 500);
    PH.next += sp; PH.step++;
  }
}

// ---------- музыка ----------
function startLayers() {
  const c = A.ctx;
  const drone = c.createGain(); drone.gain.value = 0; drone.connect(A.mus);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 3; lp.connect(drone);
  [55, 55.6, 82.4, 77.8].forEach((f, i) => { const o = c.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; const g = c.createGain(); g.gain.value = i < 2 ? 0.25 : 0.12; o.connect(g); g.connect(lp); o.start(); });
  const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  const wind = c.createBufferSource(); wind.buffer = A.noise; wind.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
  const wg = c.createGain(); wg.gain.value = 0; wind.connect(bp); bp.connect(wg); wg.connect(A.mus); wind.start();
  const wl = c.createOscillator(); wl.frequency.value = 0.11; const wlg = c.createGain(); wlg.gain.value = 250; wl.connect(wlg); wlg.connect(bp.frequency); wl.start();
  // высокий тремолирующий «скрип» для погони
  const trem = c.createOscillator(); trem.type = 'sawtooth'; trem.frequency.value = 1244;
  const tf = c.createBiquadFilter(); tf.type = 'bandpass'; tf.frequency.value = 1300; tf.Q.value = 6;
  const tg = c.createGain(); tg.gain.value = 0; const tl = c.createOscillator(); tl.frequency.value = 9; const tlg = c.createGain(); tlg.gain.value = 0;
  tl.connect(tlg); tlg.connect(tg.gain); trem.connect(tf); tf.connect(tg); tg.connect(A.mus); trem.start(); tl.start();
  A.layers = { drone, wind: wg, trem: tg, tremL: tlg };
}
export function setMusic(mode) {
  if (mode === A.mode) return;
  A.mode = mode;
  if (!A.ctx) return;
  const t = A.ctx.currentTime, L = A.layers;
  const tgt = { off: [0, 0, 0], menu: [0.35, 0.25, 0], ambient: [0.55, 0.35, 0], chase: [0.3, 0.15, 0.05], dance: [0, 0.03, 0] }[mode] || [0, 0, 0];
  L.drone.gain.setTargetAtTime(tgt[0], t, 0.8); L.wind.gain.setTargetAtTime(tgt[1], t, 0.8);
  L.trem.gain.setTargetAtTime(tgt[2], t, 0.3); L.tremL.gain.setTargetAtTime(tgt[2], t, 0.3);
  A.next = t + 0.05; A.step = 0;
}
const BOX = [0, 3, 7, 12, 11, 7, 3, 2, 0, 3, 7, 8, 7, 3, -1, -5, 0, 3, 7, 12, 15, 14, 12, 11, 8, 7, 3, 7, 2, -1, 0, null];
function mbox(semi, when, vol, detune = 0) {
  const f = 440 * Math.pow(2, (semi + 12) / 12) * (1 + detune);
  tone(null, 1, vol, f, 1.4, 'triangle', null, 0, A.mus, 0.005, when);
  tone(null, 1, vol * 0.35, f * 2.01, 0.6, 'sine', null, 0, A.mus, 0.005, when);
}
function scheduler() {
  if (!A.ctx || A.mode === 'off') return;
  const c = A.ctx, now = c.currentTime;
  if (A.next < now) A.next = now + 0.02;
  while (A.next < now + 0.25) {
    const t = A.next;
    if (A.mode === 'menu') {
      const n = BOX[A.step % BOX.length];
      if (n !== null) mbox(n, t, 0.16, Math.sin(A.step * 0.7) * 0.004);
      if (A.step % 16 === 0) [0, 3, 7].forEach(s => tone(null, 1, 0.05, 110 * Math.pow(2, s / 12), 6, 'sine', null, 0, A.mus, 1.5, t));
      A.next += 0.42;
    } else if (A.mode === 'ambient') {
      A.evT -= 0.5;
      if (A.evT <= 0) {
        const r = Math.random();
        if (r < 0.35) { const start = (Math.random() * 16) | 0; for (let i = 0; i < 5; i++) { const n = BOX[(start + i) % BOX.length]; if (n !== null) mbox(n - 12, t + i * 0.55, 0.07, 0.012 * Math.random()); } }
        else if (r < 0.7) { const base = 98 + Math.random() * 40; [0, 1, 6].forEach(s => tone(null, 1, 0.07, base * Math.pow(2, s / 12), 5, 'sawtooth', null, 0, A.mus, 2.2, t)); }
        else if (r < 0.85) { tone(null, 1, 0.3, 48, 2.5, 'sine', 30, 0, A.mus, 0.01, t); nb(null, 1, 0.2, 1.5, 'lowpass', 120, 1, A.mus, t - c.currentTime); }
        else { for (let i = 0; i < 3; i++) nb(null, 1, 0.06, 0.6, 'bandpass', 900 + i * 300, 8, A.mus, t - c.currentTime + i * 0.3, 400); }
        A.evT = 8 + Math.random() * 10;
      }
      A.next += 0.5;
    } else if (A.mode === 'chase') {
      const s = A.step % 16, sp = 60 / 150 / 2;
      const bass = [0, 0, 1, 0, 0, 0, 6, 0, 0, 0, 1, 0, 7, 6, 1, 0][s];
      tone(null, 1, 0.22, 41.2 * Math.pow(2, bass / 12), sp * 0.9, 'sawtooth', null, 0, A.mus, 0.005, t);
      tone(null, 1, 0.12, 82.4 * Math.pow(2, bass / 12), sp * 0.6, 'square', null, 0, A.mus, 0.005, t);
      if (s % 4 === 0) nb(null, 1, 0.35, 0.18, 'lowpass', 180, 1, A.mus, t - c.currentTime);
      if (s % 8 === 4) nb(null, 1, 0.25, 0.15, 'bandpass', 1800, 1, A.mus, t - c.currentTime);
      nb(null, 1, 0.05, 0.04, 'highpass', 7000, 1, A.mus, t - c.currentTime);
      if (s === 0 && (A.step / 16 | 0) % 2 === 0) [0, 1, 6, 11].forEach(k => tone(null, 1, 0.06, 220 * Math.pow(2, k / 12), 1.2, 'sawtooth', null, 0, A.mus, 0.02, t));
      A.next += sp;
    } else if (A.mode === 'dance' && !DT.buf) {
      // своя дурацкая танцевальная мелодия: 132 удара в минуту, мажор, «восьмибитный» звук
      const sp = 60 / 132 / 2, s16 = A.step % 32;
      const bassLine = [0, 0, 12, 0, 7, 0, 12, 7, 5, 5, 17, 5, 7, 7, 19, 7, 0, 0, 12, 0, 7, 0, 12, 7, 5, 5, 17, 5, 7, 12, 7, 2];
      tone(null, 1, 0.22, 65.4 * Math.pow(2, bassLine[s16] / 12), sp * 0.8, 'square', null, 0, A.mus, 0.004, t);
      if (s16 % 4 === 0) { tone(null, 1, 0.45, 110, 0.15, 'sine', 40, 0, A.mus, 0.002, t); nb(null, 1, 0.15, 0.05, 'lowpass', 300, 1, A.mus, t - c.currentTime); }
      if (s16 % 4 === 2) nb(null, 1, 0.22, 0.09, 'bandpass', 2500, 1.2, A.mus, t - c.currentTime);
      nb(null, 1, 0.05, 0.03, 'highpass', 8000, 1, A.mus, t - c.currentTime);
      const lead = [12, null, 16, 19, null, 16, 12, null, 14, null, 17, 21, null, 17, 14, null, 16, null, 19, 24, 23, 21, 19, null, 17, 19, 17, 16, 14, 12, null, null];
      const n = lead[s16]; if (n !== null) { tone(null, 1, 0.1, 261.6 * Math.pow(2, n / 12), sp * 1.6, 'square', null, 0, A.mus, 0.004, t); tone(null, 1, 0.05, 261.6 * Math.pow(2, (n + 12) / 12) * 1.003, sp * 0.8, 'triangle', null, 0, A.mus, 0.004, t); }
      if (s16 === 0 && (A.step / 32 | 0) % 2 === 1) for (let i = 0; i < 4; i++) tone(null, 1, 0.06, 523 * Math.pow(2, [0, 4, 7, 12][i] / 12), 0.12, 'square', null, 0, A.mus, 0.003, t + i * sp / 2);
      A.next += sp;
    } else A.next += 0.5;
    A.step++;
  }
}

// ---------- голоса (синтез речи системы) ----------
let voiceRU = null, lastSay = {};
function pickVoice() {
  try { const vs = speechSynthesis.getVoices(); voiceRU = vs.find(v => /^ru/i.test(v.lang) && /male|юрий|yuri|milena|милена/i.test(v.name)) || vs.find(v => /^ru/i.test(v.lang)) || null; } catch (e) { }
}
try { if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } } catch (e) { }
const VOICES = {
  hostess: { pitch: 0.1, rate: 0.72, lines: {
    hear: ['Кто здесь?..', 'Я слышу тебя...', 'Шуршишь, мышка?', 'Кто это ходит по моему дому?'],
    chase: ['Иди к бабушке!', 'Не убежишь!', 'Я чую тебя!', 'Куда же ты, деточка?'],
    lost: ['Куда ты спрятался...', 'Всё равно найду.', 'Тише... тише...'],
    catch: ['Попался!', 'Вот ты где!'], pull: ['Думаешь, я слепая?'], trap: ['Поставлю-ка капканчик...', 'Вот так. Наступишь — не уйдёшь.'], snap: ['Попалась мышка!', 'Ага! Щёлкнуло!'], drone: ['Ой, летит! Схоронюсь...', 'Опять эта жужжалка!'], idle: ['Кхе-кхе...', 'Ох, косточки мои...'], hurt: ['Ай! Негодник!'], dance: ['Дедуля, потанцуем?', 'Ох, моя любимая!'], down: ['Лежи тихо, деточка.'] } },
  watchman: { pitch: 0.01, rate: 0.6, lines: {
    wake: ['Кто шумит?..', 'Не дают поспать...'], chase: ['Стой!', 'Убери свет!', 'Я тебя вижу!'],
    catch: ['Тихо. Теперь тихо.'], pull: ['Думаешь, я настолько глуп?'], trap: ['Сюда никто не пройдёт.'], drone: ['Воздух! В укрытие!'], hurt: ['Ох!'], dance: ['Эх, тряхну стариной!'], down: ['Лежать.'] } },
  doll: { pitch: 2, rate: 1.2, lines: { alarm: ['Нашла! Нашла!', 'Хозяйка, он здесь!', 'Поиграй со мной!'], catch: ['Хи-хи-хи!'], hurt: ['Ой!'] } },
  yard: { pitch: 0.3, rate: 0.95, lines: { chase: ['А ну стоять!', 'Куда по газону?!', 'Догоню — уши надеру!'], hear: ['Кто там шуршит?', 'Опять лазят...'], lost: ['Ну, попадись мне ещё.'], catch: ['Попался, голубчик.'], sack: ['В мешок тебя! До утра посидишь.'], hurt: ['Ах ты ж!'], drone: ['Опять эта дрянь летит! В сарай!'], shush: ['А ну тихо там!', 'Кто там шебуршит?'] } },
  adam: { pitch: 0.7, rate: 0.9, lines: { mog: ['Посмотри на эту челюсть.', 'Ты стоишь в моей ауре.', 'Готов к аура-баттлу?'], lose: ['Невозможно… меня могнули.', 'Ладно. Держи свой шахед.'], win: ['Ты был могнут.'], catch: ['Ты был могнут.'] } },
  player: { pitch: 1.5, rate: 1.4, lines: { scream: ['КОЧ, БРАТАН, КОЧ!'] } },
  koch: { pitch: 0.55, rate: 1.05, lines: {
    hear: ['Кто там, братан?', 'Слышу, слышу, братан!', 'Заходи, не стесняйся!'],
    chase: ['Братан, куда?! Ещё заход!', 'Веничком тебя, братан!', 'Пар костей не ломит!', 'Стой, братан, спинку попарю!'],
    steam: ['Поддам парку!', 'Ух, жарко будет!', 'Ковшик на каменку!'],
    lost: ['Остыл, что ли, братан?', 'Ладно... пойду ещё попарюсь.'],
    catch: ['Всё, братан, распарился!', 'Готов, братан!'], dash: ['Вжух!'] } },
  sosed: { pitch: 0.2, rate: 0.7, lines: { hear: ['Кто топает у меня над головой?..', 'Сколько можно шуметь…', 'Я спущусь. Я уже спускаюсь.'], chase: ['Тише! ТИШЕ!', 'Я же просил не шуметь!', 'Стой, соседушка!'], door: ['Открой. Это сосед.', 'Я знаю, что ты там.'], catch: ['Вот и тихо.'] } },
  lifter: { pitch: 0.05, rate: 0.75, lines: { call: ['Вам на какой?..', 'Заходите. Поедем.', 'Лифт подан.'], grab: ['Едем вниз. До самого низа.'] } },
  vah: { pitch: 1.3, rate: 1.1, lines: { yell: ['Это кто тут шастает?!', 'А ну стоять! Ты из какой квартиры?!', 'Ноги вытирай!', 'Я милицию вызову!'], grab: ['Попался, хулиган!'] } },
  mom: { pitch: 1.15, rate: 0.9, lines: { msg: ['Сынок… если ты это слышишь, значит, ты выбрался из Глухова. Не верь вахтёрше. Её журнал в будке — без него тебе никто не поверит. Код от щитка я разорвала на три записки. Он ходит по лестнице. Он боится света. Береги фонарь.'] } },
  narrator: { pitch: 0.5, rate: 0.85, lines: { day: ['День первый.', 'День второй.', 'День третий.', 'День четвёртый.', 'День пятый.', 'День шестой.'], over: ['Дом тебя не отпустил.'], win: ['Ты свободен.'] } },
};
export function say(who, kind, pos, idx) {
  try {
    if (!A.set.voice || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const V = VOICES[who]; if (!V || !V.lines[kind]) return;
    const now = performance.now();
    if (kind !== 'catch' && kind !== 'pull' && kind !== 'day' && kind !== 'scream' && now - (lastSay[who] || 0) < 5000) return;
    const { a } = att(pos, 22);
    if (pos && a < 0.02) return;
    lastSay[who] = now;
    const list = V.lines[kind];
    const u = new SpeechSynthesisUtterance(idx !== undefined ? list[Math.min(idx, list.length - 1)] : list[(Math.random() * list.length) | 0]);
    u.lang = 'ru-RU'; if (voiceRU) u.voice = voiceRU;
    u.pitch = V.pitch; u.rate = V.rate; u.volume = Math.min(1, (pos ? 0.25 + a * 0.75 : 1) * A.set.sfx * (kind === 'scream' ? 1.6 : 1));
    if (kind === 'scream' || kind === 'day') speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { }
}
export function stopVoices() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { } }

// ---------- эффекты ----------
export const sfx = {
  alarm(pos) { for (let i = 0; i < 8; i++) tone(pos, 60, 0.5, i % 2 ? 1250 : 880, 0.2, 'square', null, i * 0.22); },
  steam(pos) { nb(pos, 30, 0.6, 2.4, 'highpass', 1800, 1, null, 0.05); nb(pos, 30, 0.35, 1.6, 'bandpass', 900, 2, null, 0.1); tone(pos, 30, 0.2, 90, 0.5, 'sawtooth', 60); },
  dig(pos) { nb(pos, 14, 0.4, 0.25, 'lowpass', 600); nb(pos, 14, 0.25, 0.18, 'bandpass', 1800, 3, null, 0.08); },
  venik(pos) { nb(pos, 18, 0.5, 0.18, 'highpass', 2600, 1, null, 0); nb(pos, 18, 0.6, 0.12, 'bandpass', 900, 2, null, 0.14); },
  scrape(pos) { nb(pos, 22, 0.35, 0.3, 'bandpass', 380 + Math.random() * 160, 5, null, 0); nb(pos, 22, 0.2, 0.2, 'bandpass', 900, 6, null, 0.12); },
  dip(pos) { nb(pos, 20, 0.6, 0.6, 'lowpass', 900); tone(pos, 20, 0.15, 300, 0.3, 'sine', 120, 0.05); },
  step(crouch, sprint, stone) { nb(null, 1, crouch ? 0.05 : sprint ? 0.3 : 0.15, 0.09, 'lowpass', stone ? 900 : 480); },
  creak(pos) { tone(pos, 18, 0.25, 160, 0.45, 'sawtooth', 95); tone(pos, 18, 0.12, 230, 0.3, 'square', 180, 0.05); },
  door(pos, open) { tone(pos, 20, 0.22, open ? 120 : 200, 0.5, 'sawtooth', open ? 210 : 90); nb(pos, 20, 0.2, 0.15, 'lowpass', 300); },
  wardrobe(pos) { tone(pos, 14, 0.18, 300, 0.35, 'sawtooth', 180); nb(pos, 14, 0.12, 0.1, 'lowpass', 400, 1, null, 0.25); },
  trap(pos) { nb(pos, 40, 0.9, 0.12, 'highpass', 2500); tone(pos, 40, 0.5, 900, 0.18, 'square', 300); tone(pos, 40, 0.35, 1900, 0.25, 'triangle', 1200, 0.02); nb(pos, 40, 0.5, 0.3, 'bandpass', 4200, 6, null, 0.03); },
  // сочное причмокивание (мини-игра с шоколадом)
  // «пение» в аура-баттле: короткий слог с формантами, высота по стрелке
  sing(lane, low) {
    if (!A.ctx) return;
    const base = (low ? 140 : 230) * Math.pow(2, [0, 3, 7, 10][lane % 4] / 12);
    const c = A.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(base * 1.06, t); o.frequency.exponentialRampToValueAtTime(base, t + 0.08);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = [700, 400, 900, 550][lane % 4]; f1.Q.value = 5;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = [1200, 900, 2300, 1700][lane % 4]; f2.Q.value = 7;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * A.set.sfx, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(A.sfx); o.start(t); o.stop(t + 0.26);
  },
  miss() { tone(null, 1, 0.25, 160, 0.25, 'sawtooth', 70); nb(null, 1, 0.15, 0.15, 'lowpass', 400); },
  smack() {
    const v = Math.random();
    nb(null, 1, 0.55, 0.05, 'bandpass', 1400 + v * 900, 2.5);
    tone(null, 1, 0.5, 340 + v * 120, 0.09, 'sine', 110, 0.01);
    nb(null, 1, 0.35, 0.14, 'bandpass', 700, 3, null, 0.04, 2400);
    nb(null, 1, 0.3, 0.03, 'highpass', 5000, 1, null, 0.11);
    if (v > 0.5) { tone(null, 1, 0.25, 520, 0.06, 'triangle', 260, 0.16); nb(null, 1, 0.22, 0.08, 'bandpass', 1900, 4, null, 0.17, 900); }
  },
  gulp() { tone(null, 1, 0.45, 220, 0.18, 'sine', 90); nb(null, 1, 0.25, 0.2, 'lowpass', 500, 1, null, 0.05); },
  aura(ok) { if (ok) { [0, 4, 7, 12].forEach((k, i) => tone(null, 1, 0.16, 523 * Math.pow(2, k / 12), 0.5, 'triangle', null, i * 0.04)); nb(null, 1, 0.12, 0.4, 'highpass', 6000, 1); } else { tone(null, 1, 0.3, 300, 0.5, 'sawtooth', 90); tone(null, 1, 0.2, 200, 0.6, 'square', 60, 0.05); } },
  sparkle(pos) { for (let i = 0; i < 5; i++) tone(pos, 30, 0.1, 1800 + Math.random() * 2400, 0.2, 'sine', null, i * 0.05); },
  carHum(pos, sp) { tone(pos, 40, 0.12, 50 + sp * 9, 0.2, 'sawtooth', 50 + sp * 9.5); nb(pos, 40, 0.05, 0.2, 'lowpass', 200 + sp * 30); },
  carStart(pos) { for (let i = 0; i < 4; i++) tone(pos, 40, 0.18, 60 + i * 12, 0.2, 'sawtooth', 90, i * 0.18); nb(pos, 40, 0.2, 0.9, 'lowpass', 300); },
  radio() { nb(null, 1, 0.25, 0.35, 'bandpass', 2500, 0.8); },
  boom(pos) { nb(pos, 90, 1.0, 1.6, 'lowpass', 900, 0.7, null, 0, 60); tone(pos, 90, 0.9, 70, 1.2, 'sine', 28); nb(pos, 90, 0.6, 0.4, 'highpass', 1800); for (let i = 0; i < 6; i++) nb(pos, 60, 0.25, 0.15, 'bandpass', 2000 + Math.random() * 3000, 2, null, 0.2 + Math.random() * 0.8); },
  sack(pos) { nb(pos, 14, 0.35, 0.35, 'bandpass', 2200, 1.2); nb(pos, 14, 0.25, 0.25, 'lowpass', 600, 1, null, 0.15); },
  trapSet(pos) { nb(pos, 12, 0.25, 0.06, 'bandpass', 3000, 4); tone(pos, 12, 0.12, 1400, 0.1, 'square', 900, 0.08); },
  struggle() { nb(null, 1, 0.3, 0.1, 'bandpass', 1800, 3); tone(null, 1, 0.12, 700 + Math.random() * 300, 0.08, 'square'); },
  locked(pos) { nb(pos, 10, 0.3, 0.12, 'bandpass', 1500, 3); nb(pos, 10, 0.25, 0.1, 'bandpass', 1100, 3, null, 0.08); },
  impact(pos, s) { nb(pos, 30, Math.min(0.9, 0.12 + s * 0.06), 0.18, 'lowpass', 600 + s * 120); tone(pos, 30, Math.min(0.4, s * 0.04), 260 + Math.random() * 300, 0.12, 'triangle'); },
  glass(pos) { nb(pos, 34, 0.7, 0.4, 'highpass', 3000); for (let i = 0; i < 5; i++) tone(pos, 34, 0.15, 2500 + Math.random() * 3000, 0.25, 'sine', null, i * 0.03); },
  bell(pos) { tone(pos, 24, 0.2, 1760, 0.6, 'sine'); tone(pos, 24, 0.1, 2637, 0.4, 'sine'); tone(pos, 24, 0.05, 3520, 0.3, 'sine'); },
  dollRing(pos) { for (let i = 0; i < 12; i++) tone(pos, 50, 0.32, 1500 + (i % 2) * 400, 0.12, 'square', null, i * 0.08); },
  giggle(pos) { for (let i = 0; i < 6; i++) tone(pos, 20, 0.12, 900 + Math.random() * 200, 0.08, 'triangle', 1300, i * 0.11); },
  pickup() { tone(null, 1, 0.15, 520, 0.08, 'triangle'); tone(null, 1, 0.12, 780, 0.1, 'triangle', null, 0.06); },
  install() { tone(null, 1, 0.25, 300, 0.15, 'square'); nb(null, 1, 0.3, 0.2, 'bandpass', 1800, 2); tone(null, 1, 0.2, 660, 0.25, 'triangle', null, 0.15); },
  grind(pos) { for (let i = 0; i < 10; i++) nb(pos, 30, 0.35, 0.18, 'bandpass', 300 + Math.random() * 200, 4, null, i * 0.15); tone(pos, 30, 0.2, 70, 1.6, 'sawtooth', 55); },
  chest(pos) { tone(pos, 12, 0.25, 140, 0.7, 'sawtooth', 260); nb(pos, 12, 0.2, 0.3, 'lowpass', 500); },
  twang() { tone(null, 1, 0.3, 180, 0.25, 'triangle', 90); nb(null, 1, 0.25, 0.08, 'bandpass', 2000, 2); },
  flare() { nb(null, 1, 0.8, 0.5, 'lowpass', 1200); tone(null, 1, 0.4, 120, 0.4, 'sawtooth', 50); nb(null, 1, 0.3, 2.0, 'bandpass', 2500, 0.5, null, 0.1); },
  hurt(pos) { tone(pos, 24, 0.4, 300, 0.5, 'sawtooth', 120); nb(pos, 24, 0.3, 0.3, 'bandpass', 800, 2); },
  roar(pos) { nb(pos, 26, 0.7, 1.2, 'lowpass', 300, 6, null, 0, 90); tone(pos, 26, 0.35, 60, 1.2, 'sawtooth', 35); },
  whisper(pos) { for (let i = 0; i < 6; i++) nb(pos, 16, 0.12, 0.25, 'bandpass', 2000 + Math.random() * 2500, 6, null, i * 0.18); },
  scare() {
    if (!A.ctx) return;
    [0, 1, 6, 11, 13].forEach(k => tone(null, 1, 0.5, 300 * Math.pow(2, k / 12), 1.4, 'sawtooth', 150 * Math.pow(2, k / 12), 0, A.sfx, 0.005));
    nb(null, 1, 1, 1.2, 'bandpass', 1400, 0.6, null, 0, 500);
    tone(null, 1, 0.9, 1100, 1.0, 'square', 280);
    tone(null, 1, 0.8, 45, 1.2, 'sine', 30);
  },
  heart() { tone(null, 1, 0.5, 60, 0.18, 'sine', 40); tone(null, 1, 0.35, 55, 0.18, 'sine', 38, 0.22); },
  snore(pos) { nb(pos, 14, 0.35, 0.9, 'lowpass', 220, 4); },
  gurgle(pos) { nb(pos, 16, 0.5, 0.6, 'lowpass', 160, 8); tone(pos, 16, 0.25, 70, 0.6, 'sawtooth', 45); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(null, 1, 0.25, f, 0.7, 'triangle', null, i * 0.15)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(null, 1, 0.3, f, 0.8, 'sawtooth', null, i * 0.25)); },
  splash(pos) { nb(pos, 20, 0.5, 0.5, 'lowpass', 900); },
  engine() { for (let i = 0; i < 10; i++) nb(null, 1, 0.3, 0.12, 'lowpass', 250, 2, null, i * 0.12); },
  wind() { nb(null, 1, 0.5, 2.5, 'bandpass', 600, 0.4); },
  click() { tone(null, 1, 0.12, 900, 0.04, 'square'); },
  beep(ok) { if (ok) [880, 1320].forEach((f, i) => tone(null, 1, 0.18, f, 0.12, 'square', null, i * 0.1)); else tone(null, 1, 0.2, 220, 0.3, 'square'); },
  key() { tone(null, 1, 0.1, 1200, 0.05, 'square'); },
  safe(pos) { tone(pos, 14, 0.3, 90, 0.6, 'sawtooth', 160); nb(pos, 14, 0.3, 0.3, 'lowpass', 600); tone(pos, 14, 0.15, 400, 0.2, 'triangle', null, 0.4); },
  climb() { for (let i = 0; i < 4; i++) nb(null, 1, 0.18, 0.08, 'lowpass', 500, 2, null, i * 0.2); },
  hatch(pos) { tone(pos, 18, 0.3, 140, 0.6, 'sawtooth', 70); nb(pos, 18, 0.35, 0.25, 'lowpass', 400, 1, null, 0.45); },
  down() { tone(null, 1, 0.5, 200, 0.8, 'sawtooth', 60); nb(null, 1, 0.5, 0.4, 'lowpass', 300); },
  revive() { [392, 523, 659].forEach((f, i) => tone(null, 1, 0.2, f, 0.3, 'triangle', null, i * 0.1)); },
  paper() { nb(null, 1, 0.2, 0.15, 'highpass', 2500, 1); nb(null, 1, 0.15, 0.1, 'highpass', 3500, 1, null, 0.12); },
};

// ================= ГЛАВА 2: дождь, гром, звуки подъезда =================
const RN = { src: null, g: null, lp: null, hp: null, drip: null };
// дождь: шум, громкость и «глухость» (в подъезде — только глухой шум за стеной)
export function rain(on, vol = 1, muffle = 0) {
  if (!A.ctx) return;
  const c = A.ctx;
  if (!on) { if (RN.src) { try { RN.src.stop(); } catch (e) { } RN.src = null; } clearInterval(RN.drip); RN.drip = null; return; }
  if (!RN.src) {
    RN.src = c.createBufferSource(); RN.src.buffer = A.noise; RN.src.loop = true;
    RN.hp = c.createBiquadFilter(); RN.hp.type = 'highpass'; RN.hp.frequency.value = 400;
    RN.lp = c.createBiquadFilter(); RN.lp.type = 'lowpass'; RN.lp.frequency.value = 6000;
    RN.g = c.createGain(); RN.g.gain.value = 0;
    RN.src.connect(RN.hp); RN.hp.connect(RN.lp); RN.lp.connect(RN.g); RN.g.connect(A.sfx); RN.src.start();
    RN.drip = setInterval(() => { if (RN.vol > 0.05 && Math.random() < 0.7) nb(null, 1, 0.05 * RN.vol * (1 - RN.muf * 0.8), 0.04, 'bandpass', 2500 + Math.random() * 3000, 6); }, 90);
  }
  RN.vol = vol; RN.muf = muffle;
  const t = c.currentTime;
  RN.g.gain.setTargetAtTime(0.32 * vol * (1 - muffle * 0.55), t, 0.4);
  RN.lp.frequency.setTargetAtTime(6000 - muffle * 5400, t, 0.4);
}
export const sfx2 = {
  thunder(dist = 0.5) { if (!A.ctx) return; const d = 0.3 + dist * 2.2; nb(null, 1, 0.9 * (1 - dist * 0.5), 2.8, 'lowpass', 900, 1, null, d, 60); nb(null, 1, 0.5, 0.35, 'lowpass', 2200, 1, null, d); tone(null, 1, 0.25, 48, 2.5, 'sine', 30, d); },
  click() { tone(null, 1, 0.25, 1800, 0.03, 'square'); nb(null, 1, 0.2, 0.03, 'highpass', 3000); },
  breaker() { tone(null, 1, 0.35, 300, 0.06, 'square', 120); nb(null, 1, 0.4, 0.08, 'bandpass', 1500, 2); },
  buzz(pos) { tone(pos, 10, 0.06, 100, 0.4, 'sawtooth'); tone(pos, 10, 0.03, 200, 0.4, 'square'); },
  pop(pos) { nb(pos, 20, 0.7, 0.15, 'highpass', 2000); tone(pos, 20, 0.3, 2400, 0.05, 'square', 600); },
  knock(pos) { for (let i = 0; i < 3; i++) { nb(pos, 16, 0.6, 0.09, 'lowpass', 500, 2, null, i * 0.28); tone(pos, 16, 0.3, 110, 0.12, 'sine', 70, i * 0.28); } },
  ding(pos) { tone(pos, 30, 0.35, 1320, 1.2, 'sine', null, 0); tone(pos, 30, 0.3, 990, 1.4, 'sine', null, 0.35); },
  lift(pos) { nb(pos, 30, 0.35, 2.2, 'lowpass', 300, 1); tone(pos, 30, 0.12, 60, 2.2, 'sawtooth', 70); },
  steps(pos, n = 8) { for (let i = 0; i < n; i++) nb(pos, 30, 0.5, 0.08, 'lowpass', 700, 1, null, i * 0.18); },
  slam(pos) { nb(pos, 40, 1, 0.4, 'lowpass', 400); tone(pos, 40, 0.4, 70, 0.4, 'sine', 40); },
  key() { for (let i = 0; i < 3; i++) tone(null, 1, 0.12, 2600 + i * 400, 0.05, 'triangle', null, i * 0.06); },
  lock() { tone(null, 1, 0.3, 400, 0.08, 'square', 200); nb(null, 1, 0.3, 0.1, 'bandpass', 1200, 3, null, 0.08); },
  creak(pos) { tone(pos, 14, 0.2, 140, 0.9, 'sawtooth', 90); },
  tv(pos) { nb(pos, 12, 0.15, 1.5, 'bandpass', 3000, 0.5); },
  sting() { tone(null, 1, 0.4, 70, 2.5, 'sawtooth', 52); tone(null, 1, 0.3, 1400, 2.0, 'sine', 1300); nb(null, 1, 0.4, 1.5, 'highpass', 4000, 1, null, 0, 9000); },
  step(soft) { nb(null, 1, soft ? 0.05 : 0.14, 0.08, 'lowpass', 650); },
  drip(pos) { nb(pos, 12, 0.35, 0.06, 'bandpass', 1800, 4); nb(pos, 12, 0.25, 0.12, 'lowpass', 500, 1, null, 0.05); },
};
