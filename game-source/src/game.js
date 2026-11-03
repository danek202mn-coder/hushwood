import * as THREE from 'three';
import { CS, W, H, NFLOORS, FLOOR_Y, buildMaps, rampAt, rampY, insideHouse, setHouseGone, indoor, zoneOf, HATCH, makeTextures, buildWorld, buildFurniture, lampDefs, buildLampMeshes, box, localToWorld, tex, grime, L as LM } from './world.js';
import { makeHostess, makeWatchman, makeDoll, makeThing, makeKid, makeYardman, makeSack, makeDrone, makeAdam, makeKoch, makeCar, makeVan, ITEMS, PROPS, makeItemMesh, makeBoat, makeDraisine, makeGate, makeKiteStand, bakeRig } from './models.js';
import { ensureAudio, setListener, sfx, setMusic, say, stopVoices, audioSettings, startPhonk, stopPhonk, phonkTime, danceTrack, danceVol, danceLen, playTrack, trackVol, trackLen, trackTime, trackReady, rain, sfx2 } from './audio.js';
import { Net } from './net.js';
import { buildSurroundings } from './surround.js';
import { createCh2 } from './ch2.js';
import { pbrify, pbrHints, setupRTX } from './pbr.js';
import { playEnding, stopEnding, ending1 } from './endings.js';

// ---------- безопасный запуск: если прошлый запуск оборвался — графика «низкая» ----------
let SAFE_BOOT = false;
try { if (localStorage.getItem('hushwood.boot') === 'loading') SAFE_BOOT = true; localStorage.setItem('hushwood.boot', 'loading'); } catch (e) { }

// ---------- сложности ----------
const DIFFS = {
  easy: { name: 'Лёгкая', days: 6, speed: 0.85, hear: 0.7, sense: 1.1, random: true, extra: false, traps: 2, traps0: 0, drone: 0.4, droneSp: 3.6, yardSp: 0.85, light: 1.15, ambient: 1.1, lampOff: 0, stamina: false, glow: true, thingIdle: 7, sleep: [45, 60], battery: false, stun: 1.3, dance: [80, 150] },
  normal: { name: 'Нормальная', days: 5, speed: 1.06, hear: 0.95, sense: 1.4, random: true, extra: true, traps: 4, traps0: 1, drone: 0.8, droneSp: 4.1, yardSp: 1.0, light: 1.0, ambient: 1.0, lampOff: 0.1, stamina: false, glow: true, thingIdle: 5, sleep: [30, 42], battery: false, stun: 1.0, dance: [110, 200] },
  hard: { name: 'Сложная', days: 4, speed: 1.22, hear: 1.15, sense: 1.8, random: true, extra: true, traps: 6, traps0: 2, drone: 1, droneSp: 4.6, yardSp: 1.1, light: 0.8, ambient: 0.55, lampOff: 0.3, stamina: true, glow: false, thingIdle: 4, sleep: [22, 32], battery: false, stun: 0.85, dance: [140, 240] },
  nightmare: { name: 'Кошмар', days: 3, speed: 1.36, hear: 1.35, sense: 2.2, random: true, extra: true, traps: 8, traps0: 3, drone: 1, droneSp: 5.1, yardSp: 1.2, dark: true, light: 0.7, ambient: 0.1, lampOff: 0.65, stamina: true, glow: false, thingIdle: 3, sleep: [15, 24], battery: true, stun: 0.7, dance: [170, 300] },
};
const DIFF_ORDER = ['easy', 'normal', 'hard', 'nightmare'];
const ESCAPES = {
  van: { name: 'Фургон', parts: [], how: 'на фургоне по ночной дороге' },
  // единственный выход — ворота: цепь, замок, доски, лазеры, а на сложностях выше — ещё и привод
  gate: { name: 'Ворота', parts: ['cutters', 'gatekey', 'crowbar', 'remote'], how: 'через ворота' },
};
const GATE_EXTRA = { easy: [], normal: ['lever'], hard: ['lever', 'battery'], nightmare: ['lever', 'battery'] };
const partsFor = (type) => { if (type === 'van') return []; return [...ESCAPES.gate.parts, ...(GATE_EXTRA[diffKey] || [])]; };
// слова для голосового замка: их надо произнести вслух
const WORDS = ['полночь', 'колокол', 'варенье', 'тишина', 'кочерга', 'ромашка', 'самовар', 'подсолнух', 'черника', 'граммофон'];
const LOCKS = { '1,15,10': 'rustykey', '2,9,3': 'screwdriver', '1,24,8': 'symlock' };
const LOCK_TEXT = { rustykey: ['Отпереть подвал', 'Заперто: нужен ржавый ключ', 'Подвал открыт'], screwdriver: ['Открутить доски', 'Заколочено: нужна отвёртка', 'Выход на балкон открыт'], symlock: ['Замок с картинками', 'Замок с картинками', 'Сарай открыт'] };
const ZONE_REQ = { house: [], yard: [], green: [], basement: ['rustykey'], secret: ['rustykey'], balcony: ['screwdriver'], attic: ['hook'], shed: [], banya: [] };
const SPOTS = [
  [1, 4, 5], [1, 3, 4], [1, 14, 5], [1, 6, 13], [1, 15, 6], [1, 10, 4], [1, 4, 11], [1, 16, 8], [1, 8, 11], [1, 12, 8],
  [2, 3, 6], [2, 5, 5], [2, 13, 5], [2, 16, 6], [2, 16, 13], [2, 15, 12], [2, 5, 13], [2, 3, 8], [2, 8, 5], [2, 12, 13],
  [1, 18, 5], [1, 12, 1], [1, 2, 16], [1, 28, 10], [1, 6, 20], [1, 24, 20],
  [1, 23, 14], [1, 27, 16], [1, 25, 15],
  [1, 26, 4], [1, 23, 4], [1, 24, 6],
  [0, 13, 3], [0, 10, 5], [0, 5, 9], [0, 8, 8], [0, 4, 11], [0, 6, 15], [0, 13, 16],
  [3, 3, 7], [3, 9, 11], [3, 6, 9], [3, 12, 8], [3, 15, 10],
  [2, 9, 2],
];
const DEFAULT_ITEMS = {
  rustykey: [2, 3, 6], screwdriver: [1, 4, 5], hook: [1, 27, 16],
  cutters: [1, 26, 4], crowbar: [0, 4, 11], shovel: [1, 23, 4], lever: [0, 5, 9], battery: [3, 3, 7],
};
const KEY_ITEMS = ['rustykey', 'screwdriver', 'hook', 'cutters', 'crowbar', 'shovel'];
const BANDAGE_SPOTS = [[1, 10, 5], [2, 12, 12], [0, 9, 15], [1, 25, 13], [3, 12, 9], [2, 5, 5]];
const PROP_SPOTS = [
  [1, 3, 4, 'pot'], [1, 4, 5, 'plate'], [1, 14, 5, 'vase'], [1, 9, 8, 'can'], [1, 12, 8, 'bottle'], [1, 6, 13, 'can'], [1, 10, 5, 'vase'],
  [2, 3, 6, 'vase'], [2, 16, 6, 'plate'], [2, 8, 8, 'can'], [2, 14, 9, 'bottle'], [2, 12, 12, 'can'], [2, 4, 5, 'plate'],
  [0, 8, 3, 'can'], [0, 9, 15, 'bottle'], [0, 6, 9, 'pot'], [1, 26, 4, 'can'], [1, 27, 14, 'pot'], [3, 9, 11, 'vase'], [3, 14, 8, 'bottle'],
];
const HOST_WP = [[2, 4, 5], [2, 9, 8], [2, 14, 5], [2, 15, 12], [2, 12, 12], [2, 5, 12], [1, 9, 8], [1, 4, 5], [1, 14, 5], [1, 5, 12], [1, 10, 5], [1, 9, 1], [1, 12, 15], [1, 4, 8], [1, 15, 8], [3, 6, 9], [3, 13, 10], [1, 25, 15]];
const WATCH_WP = [[1, 9, 8], [1, 15, 8], [1, 4, 8], [1, 10, 5], [1, 14, 5], [1, 4, 5], [1, 9, 2], [1, 18, 8], [1, 18, 15], [1, 3, 15], [2, 9, 8], [2, 14, 5], [2, 4, 8], [1, 20, 6], [1, 25, 10], [1, 12, 18], [1, 26, 20], [1, 24, 5], [1, 25, 15], [1, 29, 14]];
const CHAIR = [1, 5, 12];
const THING_WP = [[0, 13, 15], [0, 9, 15], [0, 11, 10], [0, 7, 12], [0, 4, 13], [0, 11, 4], [0, 6, 9]];
const DANCE_SPOTS = { hostess: [1, 12, 5], watchman: [1, 13, 4] };
const SPAWN_CELLS = [[4, 12], [5, 12], [4, 11], [5, 11]];
const SPAWN_F = 2, SPAWN_YAW = -Math.PI / 2;
const COLORS = [0x9a2a2a, 0x2a5a9a, 0x2a8a3a, 0xa07a1a];
const WORLD_FX = new Set(['bell', 'door', 'creak', 'impact', 'glass', 'dollRing', 'giggle', 'grind', 'chest', 'hurt', 'roar', 'gurgle', 'snore', 'splash', 'whisper', 'locked', 'wardrobe', 'safe', 'hatch', 'trap', 'trapSet', 'boom', 'sack', 'alarm', 'steam', 'dig', 'venik', 'dip', 'scrape']);

const $ = (id) => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const cc = (c) => (c + 0.5) * CS;
const cellOf = (v) => [Math.floor(v.x / CS), Math.floor(v.z / CS)];
const rand = (a, b) => a + Math.random() * (b - a);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const QS = new URLSearchParams(location.search);
const log = (m) => { try { window.__log && window.__log(m); } catch (e) { } };
const r2 = (v) => Math.round(v * 100) / 100;
const pv = (v) => [r2(v.x), r2(v.y), r2(v.z)];

// ---------- настройки ----------
const SET = { sens: 1, music: 0.7, sfx: 0.9, voice: true, quality: 'medium', invert: false, fps: false, name: '' };
try { Object.assign(SET, JSON.parse(localStorage.getItem('hushwood.settings') || '{}')); } catch (e) { }
if (SAFE_BOOT && SET.quality !== 'low') { SET.quality = 'low'; try { localStorage.setItem('hushwood.settings', JSON.stringify(SET)); } catch (e) { } }
function saveSet() { try { localStorage.setItem('hushwood.settings', JSON.stringify(SET)); } catch (e) { } audioSettings({ music: SET.music, sfx: SET.sfx, voice: SET.voice }); }
audioSettings({ music: SET.music, sfx: SET.sfx, voice: SET.voice });
const PR = { low: 1, medium: 1.35, high: 2 };

// ---------- рендер ----------
const canvas = $('c');
function makeRenderer() {
  const base = { canvas, antialias: SET.quality === 'high', powerPreference: 'default', preserveDrawingBuffer: QS.has('shot') };
  try { return new THREE.WebGLRenderer(base); } catch (e) {
    log('WebGL попытка 1: ' + e.message);
    try { return new THREE.WebGLRenderer({ ...base, antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false }); } catch (e2) {
      log('WebGL попытка 2: ' + e2.message);
      $('nogl').classList.remove('hidden'); $('menu').classList.add('hidden');
      throw e2;
    }
  }
}
let CH2 = null;   // вторая глава (создаётся в конце файла)
let RTX = null;   // постобработка первой главы (bloom)
let netChap = 1;  // какую главу хозяин выбрал для игры по сети
const renderer = makeRenderer();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.FogExp2(0x05060a, 0.055);
const camera = new THREE.PerspectiveCamera(72, 1, 0.03, 140);
camera.rotation.order = 'YXZ';
scene.add(camera);
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (RTX) RTX.resize(); }
function applyPixelRatio() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PR[SET.quality] || 1.35)); resize(); }
renderer.outputColorSpace = THREE.SRGBColorSpace;
// киношная цветокоррекция: мягкие света, глубокие тени
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.7;
const SHADOWS = SET.quality === 'high';
if (SHADOWS) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
// плёночное зерно поверх картинки
try {
  const gc = document.createElement('canvas'); gc.width = gc.height = 160; const gx = gc.getContext('2d'); const id = gx.createImageData(160, 160);
  for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  gx.putImageData(id, 0, 0); $('grain').style.backgroundImage = 'url(' + gc.toDataURL() + ')';
  if (SET.quality === 'low') $('grain').style.display = 'none';
} catch (e) { }
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); log('WebGL context lost'); showFade('…', 'Графика перезапускается'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());
window.addEventListener('resize', () => { resize(); if (CH2 && (CH2.S.on || CH2.S.menu)) CH2.resize(); }); applyPixelRatio();

const T = makeTextures(SET.quality);
const baseMaps = buildMaps();
let world = buildWorld(scene, baseMaps, T);
const furn = buildFurniture(scene, baseMaps, T);
const LAMPS = lampDefs(); buildLampMeshes(scene, LAMPS);
if (SHADOWS) scene.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
const hemi = new THREE.HemisphereLight(0x4a5070, 0x1c140e, 0.9); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8090c0, 0.5); moon.position.set(-25, 40, 45); scene.add(moon);   // луна со стороны двора — деревню за дорогой видно, а не силуэтами
// пул точечных источников: их число не меняется (шейдеры не пересобираются), они переезжают к ближайшим лампам
pbrHints(T); RTX = setupRTX(renderer, scene, camera, SET.quality);
const POOL = []; for (let i = 0; i < (SET.quality === 'low' ? 3 : 4); i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); scene.add(l); POOL.push(l); }
const COLS = [0, 1, 2, 3].map(f => furn.colliders.filter(c => c.f === f));
const SURF = [0, 1, 2, 3].map(f => furn.surfaces.filter(s => s.f === f));
SURF[0].push({ f: 0, x0: 19 * CS - 0.36, x1: 19 * CS - 0.05, z0: 3.5 * CS - 0.7, z1: 3.5 * CS + 0.7, top: -3 + 0.93 });
{ const hx = cc(HATCH.x), hz = cc(HATCH.z); COLS[3].push({ f: 3, x0: hx - 0.62, x1: hx + 0.62, z0: hz - 0.62, z1: hz + 0.62, y0: 6, y1: 8 }); }

const flash = new THREE.SpotLight(0xfff0d0, 0, 22, 0.42, 0.55, 1.3);
if (SHADOWS) { flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); flash.shadow.bias = -0.0008; flash.shadow.camera.near = 0.2; flash.shadow.camera.far = 22; }
flash.position.set(0.15, -0.1, 0); camera.add(flash);
const flashT = new THREE.Object3D(); flashT.position.set(0, 0, -5); camera.add(flashT); flash.target = flashT;

// ---------- состояние ----------
let maps, D, diffKey = 'normal';
const G = { trk: {}, fxs: [], shake: 0, mode: 'menu', day: 1, time: 0, splits: [], esc: null, doors: new Map(), objects: [], byNid: new Map(), nidSeq: 1, shards: [], dyn: null, heartT: 0, prevMode: null, flares: [], snapT: 0, poseT: 0, fullT: 0, code: '0000', notes: [], lampOff: new Set(), danceT: 999, danceTime: 0 };
function newPlayer(id, name, color, local) {
  return { id, name, color, local, f: SPAWN_F, pos: V(), yaw: 0, pitch: 0, crouch: false, sprint: false, held: null, hidden: null, hideAnim: null, stamina: 100, tired: false, light: false, battery: 100, stepAcc: 0, lastCell: '', idle: 0, noiseT: -99, eye: 1.6, moving: 0, paused: false,
    weapons: { slingshot: false, flaregun: false }, weap: null, stones: 0, flareAmmo: 0, kick: 0, avatar: null, tgt: V(), anim: 0, idx: 0, lives: 2, downed: false, climb: null, ui: false, known: {} };
}
const P = newPlayer('me', 'Я', COLORS[0], true);
const PL = new Map([[P.id, P]]);
const players = () => [...PL.values()];
const standing = () => players().filter(p => !p.downed && !p.dead && !p.sacked);
const isHost = () => Net.role !== 'client';
const MP = () => Net.role !== 'single';
let hostess, watchman, doll, thing, yard, adam, koch, gateM, heldView = null, weapView = null;
try { const s = localStorage.getItem('hushwood.diff'); if (s && DIFFS[s]) diffKey = s; } catch (e) { }

const fx = new Proxy({}, { get: (_, n) => (...a) => {
  sfx[n](...a);
  if (Net.role === 'host' && WORLD_FX.has(n)) Net.send({ t: 'fx', n, a: a.map(x => x && x.isVector3 ? { v: pv(x) } : x) });
} });
function psfx(pl, n) { if (pl.local) sfx[n](); else Net.send({ t: 'pfx', n }, false, pl.id); }
function ptoast(pl, text, dur) { if (pl.local) toast(text, dur); else Net.send({ t: 'toast', text, dur }, true, pl.id); }
function alltoast(text, dur) { toast(text, dur); if (Net.role === 'host') Net.send({ t: 'toast', text, dur }, true); }
function sayW(who, kind, pos, idx) { say(who, kind, pos, idx); if (Net.role === 'host') Net.send({ t: 'say', who, kind, p: pos ? pv(pos) : null, idx }); }

// ---------- карта ----------
const cell = (f, x, z) => (x < 0 || z < 0 || x >= W || z >= H || f < 0 || f >= NFLOORS) ? null : maps[f][z][x];
const doorAt = (f, x, z) => G.doors.get(f + ',' + x + ',' + z);
function solidCell(f, x, z) {
  const ch = cell(f, x, z);
  if (ch === null) return true;
  if ('#fwRq '.includes(ch)) return true;
  if (ch === 'H') return !furn.secret.open;
  if (ch === 'G') return !G.esc.gateOpen;
  if (ch === 'D' || ch === 'L') { const d = doorAt(f, x, z); return !d || d.t < 0.85; }
  return false;
}
function solidSight(f, x, z) {
  const ch = cell(f, x, z);
  if (ch === null) return true;
  if ('#W YH'.includes(ch)) return true;
  if (ch === 'D' || ch === 'L') { const d = doorAt(f, x, z); return !d || d.t < 0.5; }
  return false;
}
function hitCollider(f, x, z, r, yFeet) {
  for (const c of COLS[f]) if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1 && yFeet < c.y1 - 0.25 && yFeet + 1.5 > c.y0) return true;
  return false;
}
function heightAt(f, x, z) {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
  if (cell(f, cx, cz) === 'S') { const r = rampAt(cx, cz); if (r) return rampY(r, x, z); }
  return FLOOR_Y[f];
}
function floorFromY(f, x, z, y) {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
  if (cell(f, cx, cz) !== 'S') return f;
  const r = rampAt(cx, cz); if (!r) return f;
  return y > (FLOOR_Y[r.low] + FLOOR_Y[r.high]) / 2 ? r.high : r.low;
}
function los(f, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  const za = zoneAt(a.x, a.z);
  if (za === 'banya') { for (let i = 1; i < 10; i++) if (banyaWall(a.x + dx * i / 10, a.z + dz * i / 10)) return false; return true; }
  if (za === 'arena' || za === 'club') return true;
  const n = Math.ceil(d / 0.25);
  const [ax, az] = cellOf(a), [bx, bz] = cellOf(b);
  for (let i = 1; i < n; i++) {
    const x = a.x + dx * i / n, z = a.z + dz * i / n;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    if ((cx === ax && cz === az) || (cx === bx && cz === bz)) continue;
    if (solidSight(f, cx, cz)) return false;
  }
  return true;
}

// ---------- поиск пути (с лестницами и люком) ----------
const NID = (f, x, z) => f * W * H + z * W + x;
const NF = (id) => Math.floor(id / (W * H)), NZ = (id) => Math.floor((id % (W * H)) / W), NX = (id) => id % W;
function bfs(from, goal, allow) {
  if (from === goal) return [];
  const prev = new Int32Array(NFLOORS * W * H).fill(-2); prev[from] = -1;
  const q = [from];
  for (let qi = 0; qi < q.length; qi++) {
    const id = q[qi]; if (id === goal) break;
    const f = NF(id), x = NX(id), z = NZ(id);
    const nbs = [[f, x + 1, z], [f, x - 1, z], [f, x, z + 1], [f, x, z - 1]];
    if (cell(f, x, z) === 'S') { const r = rampAt(x, z); if (r) nbs.push([f === r.low ? r.high : r.low, x, z]); }
    if (furn.hatch.open && x === HATCH.x && z === HATCH.z && (f === 2 || f === 3)) nbs.push([f === 2 ? 3 : 2, x, z]);
    for (const [nf, nx, nz] of nbs) {
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const nid = NID(nf, nx, nz);
      if (prev[nid] !== -2 || !allow(nf, nx, nz, cell(nf, nx, nz))) continue;
      prev[nid] = id; q.push(nid);
    }
  }
  if (prev[goal] === -2) return null;
  const path = []; for (let c = goal; c !== from; c = prev[c]) path.push(c);
  return path.reverse();
}
function nearestAllowed(f, x, z, allow) {
  if (allow(f, x, z, cell(f, x, z))) return NID(f, x, z);
  for (let r = 1; r < 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, nz = z + dz; if (allow(f, nx, nz, cell(f, nx, nz))) return NID(f, nx, nz);
  }
  return null;
}
const allowUpper = (f, x, z, ch) => f >= 1 && ch !== null && '.cDgrSp'.includes(ch) && !(f === 1 && z === 0);
const allowThing = (f, x, z, ch) => f === 0 && ch === '.' && !(x >= 14 && z <= 5);

// ---------- враги ----------
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
const now = () => G.time;
function distTo(e, pl) { const dy = Math.abs(e.pos.y - pl.pos.y); return Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) + (dy > 1.4 ? dy * 2 : 0); }
const inSecret = (pl) => pl.f === 0 && pl.pos.x > 14 * CS && pl.pos.z < 6 * CS;
const targetable = (pl) => !pl.hidden && !pl.downed && !pl.climb && !pl.dead && !pl.sacked && !pl.aura && !pl.inBunker && CAR.driver !== pl.id;
class Walker {
  constructor(mesh, allow) { this.mesh = mesh; this.allow = allow; this.f = 1; this.pos = V(); this.yaw = 0; this.path = []; this.state = 'idle'; this.timer = 0; this.stun = 0; this.anim = 0; this.repath = 0; this.witness = null; this.wait = 0; this.lastSeen = -99; this.known = null; this.moving = false; this.speedNow = 0; this.tp = null; this.tgt = V(); this.tyaw = 0; }
  place(f, x, z) { this.f = f; this.pos.set(cc(x), heightAt(f, cc(x), cc(z)), cc(z)); this.path = []; this.tgt.copy(this.pos); this.sync(); }
  node() { const [x, z] = cellOf(this.pos); return NID(this.f, x, z); }
  goTo(id) { if (id === null || id === undefined) { this.path = []; return false; } const p = bfs(this.node(), id, this.allow); this.path = p || []; return !!p; }
  goToCell(f, x, z) { return this.goTo(nearestAllowed(f, x, z, this.allow)); }
  step(speed, dt) {
    this.moving = false; this.speedNow = 0;
    if (this.wait > 0) { this.wait -= dt; return false; }
    if (!this.path.length) return true;
    const id = this.path[0], nf = NF(id), nx = NX(id), nz = NZ(id);
    if (nf !== this.f && Math.floor(this.pos.x / CS) === nx && Math.floor(this.pos.z / CS) === nz) {
      const viaHatch = !rampAt(nx, nz);
      this.f = nf; this.path.shift(); this.pos.y = heightAt(nf, this.pos.x, this.pos.z);
      if (viaHatch) { this.wait = 0.9; fx.climb && sfx.climb(); }
      return false;
    }
    const ch = cell(nf, nx, nz);
    if (ch === 'D' || ch === 'L') { const d = doorAt(nf, nx, nz); if (d && !d.open) { if (d.locked && this === yard) { d.open = true; fx.door(V(cc(d.x), 1.2, cc(d.z)), true); this.wait = 0.6; return false; } setDoor(d, true); this.wait = 0.45; return false; } }
    const tx = cc(nx), tz = cc(nz);
    const dx = tx - this.pos.x, dz = tz - this.pos.z, dist = Math.hypot(dx, dz);
    const mv = speed * dt;
    if (dist <= mv + 0.02) { this.pos.x = tx; this.pos.z = tz; this.f = nf; this.path.shift(); }
    else { this.pos.x += dx / dist * mv; this.pos.z += dz / dist * mv; this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8)); }
    this.f = floorFromY(this.f, this.pos.x, this.pos.z, heightAt(this.f, this.pos.x, this.pos.z));
    this.pos.y = heightAt(this.f, this.pos.x, this.pos.z);
    this.moving = true; this.speedNow = speed; this.anim += mv * 2.6;
    return !this.path.length;
  }
  face(target, dt) { this.yaw = lerpAngle(this.yaw, Math.atan2(target.x - this.pos.x, target.z - this.pos.z), Math.min(1, dt * 6)); }
  sync() { this.mesh.position.copy(this.pos); this.mesh.rotation.order = 'YXZ'; this.mesh.rotation.y = this.yaw + (this.state === 'dance' ? danceSpin(G.danceTime) : 0); this.mesh.rotation.x = this.tiltX || 0; this.mesh.rotation.z = this.tiltZ || 0; if (this.rag) this.mesh.position.y += 0.12; }
  distP() { return distTo(this, P); }
  nearest(filter) { let best = null, bd = 1e9; for (const pl of players()) { if (filter && !filter(pl)) continue; const d = distTo(this, pl); if (d < bd) { bd = d; best = pl; } } return best; }
}
const getTp = (e) => (e.tp && PL.get(e.tp.id) === e.tp && !e.tp.downed) ? e.tp : null;

// ---------- анимация ----------
function walkPose(U, e, amp, armAmp) {
  const s = e.moving ? Math.sin(e.anim) : 0, c = e.moving ? Math.cos(e.anim) : 0;
  const run = Math.min(1.4, e.speedNow / 2.2);
  U.legs.forEach((l, i) => { const ph = i ? -s : s; l.a.rotation.x = -ph * amp * run; l.a.rotation.z = 0; l.b.rotation.x = Math.max(0, (i ? c : -c)) * amp * 1.4 * run; });
  return { s, c, run, aa: armAmp * run };
}
// танцы: два своих стиля. 1 — «бабкин» (руки, пружинка, хлопки), 2 — «дедов» (присядка, руки в боки, кружение)
const BPM = 132;
function danceRig(U, t, style, base) {
  if (style === 3) {
    const ph = t * (157 / 60) * Math.PI / 2, bank = Math.sin(ph) * 0.55;
    U.hips.position.y = base - 0.06 + Math.abs(Math.cos(ph)) * 0.04;
    U.spine.rotation.x = 0.35 + Math.abs(Math.sin(ph)) * 0.18; U.spine.rotation.z = bank;
    U.arms.forEach((a, i) => { const s = i ? 1 : -1; a.a.rotation.x = -0.15; a.a.rotation.z = s * 1.45 + Math.sin(ph * 2 + i) * 0.12; a.b.rotation.x = -0.05; });
    U.legs.forEach((l, i) => { l.a.rotation.z = (i ? -1 : 1) * 0.08 + bank * 0.25; l.a.rotation.x = -0.18 - Math.max(0, Math.sin(ph + i * Math.PI)) * 0.25; l.b.rotation.x = 0.3 + Math.max(0, Math.sin(ph + i * Math.PI)) * 0.4; });
    U.head.rotation.z = -bank * 0.5; U.head.rotation.y = 0; U.neck.rotation.x = 0.35;
    return;
  }
  const beat = t * BPM / 60, b = beat * Math.PI, bounce = Math.abs(Math.sin(b)), bar = Math.floor(beat / 4) % 4;
  if (style === 2) {
    if (bar < 2) {
      const side = Math.floor(beat) % 2, hop = Math.abs(Math.sin(b));
      U.hips.position.y = base * 0.62 + hop * 0.06;
      U.legs.forEach((l, i) => { l.a.rotation.z = (i ? -1 : 1) * 0.1; if (i === side) { l.a.rotation.x = -1.35; l.b.rotation.x = 0.05; } else { l.a.rotation.x = -1.75; l.b.rotation.x = 2.3; } });
      U.arms.forEach((a, i) => { a.a.rotation.x = -1.45; a.a.rotation.z = (i ? 1 : -1) * 0.12; a.b.rotation.x = -1.2; });
      U.spine.rotation.x = 0.12; U.spine.rotation.z = 0;
    } else if (bar === 2) {
      U.hips.position.y = base - 0.03 + bounce * 0.04;
      U.legs.forEach((l, i) => { const up = Math.max(0, Math.sin(b * 2 + i * Math.PI)); l.a.rotation.x = -up * 0.6; l.b.rotation.x = up * 0.9; l.a.rotation.z = 0; });
      U.arms.forEach((a, i) => { a.a.rotation.x = -0.25; a.a.rotation.z = (i ? 1 : -1) * 0.75; a.b.rotation.x = -1.9; });
      U.spine.rotation.z = Math.sin(b * 0.5) * 0.18; U.spine.rotation.x = 0.05;
    } else {
      U.hips.position.y = base - 0.02 + bounce * 0.05;
      U.legs.forEach((l, i) => { const up = Math.max(0, Math.sin(b * 2 + i * Math.PI)); l.a.rotation.x = -up * 0.4; l.b.rotation.x = up * 0.7; l.a.rotation.z = 0; });
      U.arms[0].a.rotation.x = -2.9; U.arms[0].a.rotation.z = -0.2; U.arms[0].b.rotation.x = -0.5 + Math.sin(b * 2) * 0.3;
      U.arms[1].a.rotation.x = -1.4; U.arms[1].a.rotation.z = 1.2; U.arms[1].b.rotation.x = -0.1;
      U.spine.rotation.z = -0.1; U.spine.rotation.x = 0.02;
    }
    U.head.rotation.z = Math.sin(b) * 0.15; U.head.rotation.y = 0; U.neck.rotation.x = -0.1;
    return;
  }
  U.hips.position.y = base - 0.07 + bounce * 0.09;
  U.legs.forEach((l, i) => { const up = Math.max(0, Math.sin(b + i * Math.PI)); l.a.rotation.x = -up * 0.8; l.b.rotation.x = up * 1.2; l.a.rotation.z = (i ? -1 : 1) * 0.12; });
  U.spine.rotation.z = Math.sin(b * 0.5) * 0.22; U.spine.rotation.x = 0.1 + bounce * 0.05;
  U.arms.forEach((a, i) => {
    const s = i ? 1 : -1;
    if (bar === 0) { a.a.rotation.x = -2.7 + Math.sin(b + i * Math.PI) * 0.35; a.a.rotation.z = s * 0.25; a.b.rotation.x = -0.25; }
    else if (bar === 1) { a.a.rotation.x = -1.3 + Math.sin(b * 0.5 + i * Math.PI) * 1.2; a.a.rotation.z = s * 0.5; a.b.rotation.x = -0.2; }
    else if (bar === 2) { a.a.rotation.x = -0.5 + Math.sin(b * 2 + i) * 0.5; a.a.rotation.z = s * 0.15; a.b.rotation.x = -1.7; }
    else { a.a.rotation.x = -2.9; a.a.rotation.z = s * (0.15 + bounce * 0.35); a.b.rotation.x = -0.4; }
  });
  U.head.rotation.z = Math.sin(b) * 0.25; U.head.rotation.y = 0; U.neck.rotation.x = -0.15;
}
function resetDancePose(U) {
  U.spine.rotation.z = 0; U.spine.rotation.y = 0; U.head.rotation.z = 0; U.head.rotation.y = 0; U.neck.rotation.x = 0;
  U.arms.forEach(a => { a.a.rotation.z = 0; a.b.rotation.x = -0.15; });
  U.legs.forEach(l => { l.a.rotation.z = 0; });
}
// в последнем такте — оборот вокруг себя
function danceSpin(t, style) { if (style === 3) return Math.sin(t * 1.1) * 0.6; const beat = t * BPM / 60; return Math.floor(beat / 4) % 4 === 3 ? (beat % 4) / 4 * Math.PI * 2 : 0; }
function animDance(e, t) {
  const U = e.mesh.userData, bounce = Math.abs(Math.sin(t * BPM / 60 * Math.PI));
  danceRig(U, t, e === hostess ? 1 : 2, e === hostess ? 0.92 : 1.0);
  if (e === hostess) U.spine.rotation.x += 0.08;
  if (U.jaw) U.jaw.rotation.x = 0.1 + bounce * 0.25;
  if (U.lantern) U.lantern.rotation.x = Math.sin(t * 3) * 0.6;
  if (U.face && U.face.map !== U.faceO) { U.face.map = U.faceO; U.face.needsUpdate = true; }
}
function animHostess() {
  const h = hostess, U = h.mesh.userData, t = now() + (G.mode === 'menu' ? mt : 0);
  if (h.rag) { ragPose(h); return; }
  if (h.state === 'dance') { animDance(h, G.danceTime); return; }
  if (h.state === 'settrap') { bendPose(U, 0.92, t); return; }
  if (h.stun > 0) {
    U.spine.rotation.x = 1.0; U.neck.rotation.x = 0.3; U.head.rotation.z = Math.sin(t * 7) * 0.3;
    U.legs.forEach(l => { l.a.rotation.x = -0.6; l.b.rotation.x = 1.0; }); U.hips.position.y = 0.7; return;
  }
  const { s, run, aa } = walkPose(U, h, 0.55, 0.6);
  U.hips.position.y = 0.92 + Math.abs(s) * 0.03 * run;
  U.spine.rotation.x = U.hunch + Math.sin(t * 1.3) * 0.02 + (h.state === 'chase' ? 0.12 : 0);
  U.spine.rotation.z = Math.sin(h.anim * 0.5) * 0.06 * run;
  const reach = h.state === 'chase' ? 1 : 0;
  U.arms.forEach((a, i) => {
    const sw = (i ? s : -s) * aa;
    a.a.rotation.x = THREE.MathUtils.lerp(sw, -1.35 + Math.sin(t * 9 + i) * 0.1, reach);
    a.b.rotation.x = THREE.MathUtils.lerp(-0.25, -0.35, reach);
    a.a.rotation.z = (i ? 1 : -1) * (0.08 + reach * 0.1);
    a.fingers.forEach((f, k) => f.rotation.x = reach ? 0.6 + Math.sin(t * 14 + k) * 0.3 : 0.3);
  });
  if (h.state === 'listen' || h.state === 'pause' || h.state === 'gloat') { U.head.rotation.z = Math.sin(t * 1.5) * 0.35; U.head.rotation.y = Math.sin(t * 0.9) * 0.6; }
  else { U.head.rotation.z *= 0.9; U.head.rotation.y *= 0.9; }
  U.neck.rotation.x = -0.35 + (h.state === 'chase' ? -0.15 : 0);
  U.jaw.rotation.x = h.state === 'chase' ? 0.15 + Math.abs(Math.sin(t * 6)) * 0.15 : Math.max(0, Math.sin(t * 0.7)) * 0.06;
}
function bendPose(U, base, t) {
  U.hips.position.y = base * 0.6; U.spine.rotation.x = 1.0; U.spine.rotation.z = 0; U.neck.rotation.x = 0.2;
  U.legs.forEach((l, i) => { l.a.rotation.x = -1.3; l.b.rotation.x = 1.9; l.a.rotation.z = (i ? -1 : 1) * 0.15; });
  U.arms.forEach((a, i) => { a.a.rotation.x = -0.9 + Math.sin(t * 6 + i) * 0.15; a.a.rotation.z = (i ? 1 : -1) * 0.15; a.b.rotation.x = -0.3; });
}
function animWatchman() {
  const w = watchman, U = w.mesh.userData, t = now() + (G.mode === 'menu' ? mt : 0);
  if (w.rag) { U.spot.intensity = 0; ragPose(w); return; }
  const setFace = (open) => { const m = open ? U.faceO : U.faceC; if (U.face.map !== m) { U.face.map = m; U.face.needsUpdate = true; } };
  if (w.state === 'dance') { U.spot.intensity = 30; animDance(w, G.danceTime + 0.3); return; }
  if (w.state === 'settrap') { U.spot.intensity = 30; bendPose(U, 1.0, t); setFace(false); return; }
  if (w.stun > 0) {
    U.spine.rotation.x = 0.9; U.hips.position.y = 0.75; U.neck.rotation.x = 0.5; U.spot.intensity = 6;
    U.legs.forEach(l => { l.a.rotation.x = -0.5; l.b.rotation.x = 0.9; }); setFace(false); return;
  }
  if (w.state === 'sleep') {
    U.spot.intensity = 6;
    U.hips.position.y = 0.6; U.spine.rotation.x = -0.25; U.spine.rotation.z = 0;
    U.legs.forEach((l, i) => { l.a.rotation.x = -1.45; l.b.rotation.x = 1.45; l.a.rotation.z = (i ? -1 : 1) * 0.08; });
    U.arms.forEach((a, i) => { a.a.rotation.x = -0.55; a.b.rotation.x = -0.6; a.a.rotation.z = (i ? 1 : -1) * 0.12; });
    U.lantern.rotation.x = 0.6;
    U.neck.rotation.x = 0.55 + Math.sin(t * 0.6) * 0.04; U.head.rotation.z = 0.25;
    U.jaw.rotation.x = 0.12 + Math.sin(t * 1.2) * 0.06;
    setFace(false); return;
  }
  U.spot.intensity = 40 * (D ? D.light : 1);
  const { s, run } = walkPose(U, w, 0.45, 0.4);
  U.hips.position.y = 1.0 + Math.abs(s) * 0.02 * run;
  const chase = w.state === 'chase';
  U.spine.rotation.x = 0.1 + (chase ? 0.15 : 0); U.spine.rotation.z = 0;
  U.arms[0].a.rotation.x = chase ? -1.4 + Math.sin(t * 8) * 0.1 : -1.25 + Math.sin(t * 0.8) * 0.05; U.arms[0].b.rotation.x = -0.1; U.arms[0].a.rotation.z = -0.05;
  U.arms[1].a.rotation.x = -0.75 + s * 0.05; U.arms[1].b.rotation.x = -0.65; U.arms[1].a.rotation.z = 0.12;
  U.lantern.rotation.x = 1.35 + Math.sin(t * 2) * 0.05;
  U.neck.rotation.x = chase ? -0.1 : 0.15; U.head.rotation.z = chase ? 0 : Math.sin(t * 0.7) * 0.12;
  U.jaw.rotation.x = chase ? 0.25 + Math.abs(Math.sin(t * 5)) * 0.15 : 0.05;
  setFace(chase);
}
function animDoll(dt) {
  const d = doll, U = d.mesh.userData, t = now();
  U.key.rotation.z += dt * (d.stun > 0 ? 0.5 : 4);
  U.legs.forEach((l, i) => { l.a.rotation.x = Math.sin(t * 2 + i * 2) * 0.25; l.b.rotation.x = 0.2; });
  U.arms.forEach((a, i) => { a.a.rotation.x = Math.sin(t * 1.7 + i) * 0.3; });
  d.mesh.position.set(d.x, DOLL_Y, DOLL_Z);
  if (d.stun > 0) { U.body.rotation.z = Math.sin(t * 3) * 0.7 * Math.min(1, d.stun / 3); U.head.rotation.x = 0.8; U.eyeMat.emissive.setHex(0); return; }
  U.head.rotation.x = 0; U.body.rotation.z = Math.sin(t * 2) * 0.05;
  d.mesh.rotation.y = lerpAngle(d.mesh.rotation.y, d.dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.min(1, dt * 4));
  if (P.f === 1 && Math.abs(P.pos.z - DOLL_Z) < 4 && Math.abs(P.pos.x - d.x) < 8) {
    const want = Math.atan2(P.pos.x - d.x, P.pos.z - DOLL_Z) - d.mesh.rotation.y;
    U.head.rotation.y = lerpAngle(U.head.rotation.y, Math.max(-1.2, Math.min(1.2, want)), dt * 3);
  } else U.head.rotation.y *= 0.95;
  U.eyeMat.emissive.setHex(d.cool > 4 ? 0xaa0000 : 0x000000);
  U.jaw.rotation.x = d.cool > 5 ? Math.abs(Math.sin(t * 12)) * 0.4 : 0;
}
function animThing() {
  if (thing.rag) { ragPose(thing); return; } else if (thing.mesh.userData.core && thing.mesh.userData.core.scale.y < 0.7) thing.mesh.userData.core.scale.set(1, 1, 1);
  const t = thing, U = t.mesh.userData, k = now();
  U.tents.forEach((tn) => {
    const spread = t.state === 'block' ? 1 : 0;
    tn.base.rotation.x = 0.25 - spread * 0.3 + Math.sin(k * 2 + tn.phase) * 0.15;
    tn.segs.forEach((s, j) => { s.rotation.x = Math.sin(k * 3 + tn.phase + j) * (0.35 - spread * 0.2) + (spread ? 0 : 0.18); s.rotation.y = Math.cos(k * 2.2 + tn.phase + j) * 0.25; });
  });
  U.core.scale.set(1 + Math.sin(k * 3) * 0.05, 1 + Math.cos(k * 3) * 0.05, 1);
  U.eyes.forEach((e, i) => { e.scale.y = (Math.sin(k * 0.7 + i * 2.1) > 0.97) ? 0.1 : 1; });
  U.jaw.scale.y = t.state === 'hunt' ? 1 + Math.abs(Math.sin(k * 5)) * 0.6 : 1 + Math.abs(Math.sin(k)) * 0.2;
}
// аватар другого игрока
function animKid(pl, dt) {
  const av = pl.avatar; if (!av) return;
  const U = av.userData;
  av.visible = CAR.driver !== pl.id && !pl.hidden && !pl.sacked && G.mode !== 'menu' && (!pl.dead || !!P.dead);
  setGhostLook(av, !!pl.dead);
  if (pl.dead) {
    if (av.position.distanceTo(pl.tgt) > 4) av.position.copy(pl.tgt); else av.position.lerp(pl.tgt, Math.min(1, dt * 8));
    av.position.y += Math.sin(now() * 2 + pl.idx) * 0.08 - 0.3; av.rotation.y = pl.yaw + Math.PI; av.rotation.x = 0; pl.avBase = false;
    U.tag.position.set(0, 1.95, 0); U.help.position.set(0, 0.9, 0);
    U.help.visible = false; U.beam.visible = false; U.hips.position.y = 0.82;
    U.legs.forEach((l, i) => { l.a.rotation.x = -0.2 + Math.sin(now() * 1.5 + i) * 0.1; l.b.rotation.x = 0.4; });
    U.arms.forEach((a, i) => { a.a.rotation.x = -1.6 + Math.sin(now() * 2 + i) * 0.2; a.a.rotation.z = (i ? 1 : -1) * 0.3; a.b.rotation.x = -0.2; });
    return;
  }
  if (pl.downed) { av.position.copy(pl.tgt); pl.avBase = true; } else { if (pl.avBase) { av.position.copy(pl.tgt); pl.avBase = false; } if (av.position.distanceTo(pl.tgt) > 4) av.position.copy(pl.tgt); else av.position.lerp(pl.tgt, Math.min(1, dt * 10)); }
  av.rotation.x = 0;
  av.rotation.y = lerpAngle(av.rotation.y, pl.yaw + Math.PI, Math.min(1, dt * 10));
  U.help.visible = !!pl.downed;
  if (!pl.downed) { U.tag.position.set(0, 1.95, 0); U.help.position.set(0, 0.9, 0); }
  if (pl.downed) resetDancePose(U);
  if (pl.emote && !pl.downed) {
    pl.emoteT = (pl.emoteT || 0) + dt;
    danceRig(U, pl.emoteT, pl.emote, 0.82);
    av.rotation.y = pl.yaw + Math.PI + danceSpin(pl.emoteT, pl.emote);
    U.beam.visible = false; return;
  }
  if (pl.downed) {
    // ползёт по-пластунски: лёжа на животе, головой вперёд; руки по очереди тянутся вперёд, ноги отталкиваются
    av.rotation.order = 'YXZ'; av.rotation.x = Math.PI / 2;
    const fwx = -Math.sin(pl.yaw), fwz = -Math.cos(pl.yaw);
    av.position.x -= fwx * 0.8; av.position.z -= fwz * 0.8; av.position.y += 0.14;
    U.hips.position.y = 0.82; U.spine.rotation.set(0, 0, 0); U.neck.rotation.set(0, 0, 0);
    U.head.rotation.set(-0.7, Math.max(-0.6, Math.min(0.6, -pl.pitch * 0.3)), 0); U.beam.visible = false;
    const mv = (pl.moving || 0) > 0.15; if (mv) pl.anim += dt * 4.5;
    U.arms.forEach((a, i) => { const ph = mv ? Math.sin(pl.anim + i * Math.PI) : 0; a.a.rotation.set(-2.7 - ph * 0.5, 0, (i ? 1 : -1) * (0.35 + Math.max(0, ph) * 0.25)); a.b.rotation.x = -0.3 - Math.max(0, -ph) * 0.9; });
    U.legs.forEach((l, i) => { const ph = mv ? Math.sin(pl.anim + i * Math.PI + 0.6) : 0; l.a.rotation.set(0.05 + ph * 0.18, 0, (i ? -1 : 1) * (0.12 + Math.max(0, ph) * 0.25)); l.b.rotation.x = 0.15 + Math.max(0, ph) * 0.9; });
    U.tag.position.set(0, 0.9, -1.3); U.help.position.set(0, 0.9, -0.9);   // в повёрнутом теле «вверх» — это -z
    return;
  }
  resetDancePose(U);
  const sp = pl.moving || 0;
  pl.anim += sp * dt * 2.4;
  const s = sp > 0.3 ? Math.sin(pl.anim) : 0, c = sp > 0.3 ? Math.cos(pl.anim) : 0, run = Math.min(1.4, sp / 3);
  U.legs.forEach((l, i) => { const ph = i ? -s : s; l.a.rotation.z = 0; l.a.rotation.x = -ph * 0.6 * run + (pl.crouch ? -0.9 : 0); l.b.rotation.x = Math.max(0, (i ? c : -c)) * 0.8 * run + (pl.crouch ? 1.6 : 0); });
  U.hips.position.y = pl.crouch ? 0.5 : 0.82 + Math.abs(s) * 0.03;
  U.spine.rotation.x = pl.crouch ? 0.4 : 0.05;
  U.arms[0].a.rotation.x = s * 0.5 * run; U.arms[0].a.rotation.z = 0; U.arms[1].a.rotation.x = -1.2 - pl.pitch * 0.6; U.arms[1].a.rotation.z = 0; U.arms[1].b.rotation.x = -0.2;
  U.head.rotation.x = -pl.pitch * 0.5; U.head.rotation.y = 0;
  U.beam.visible = !!pl.light;
  U.lens.material.color.setHex(pl.light ? 0xfff0c0 : 0x555555);
  const hid = pl.held ? pl.held.nid : -1;
  if (U.heldNid !== hid) {
    if (U.heldMesh) { U.hand.remove(U.heldMesh); U.heldMesh = null; }
    if (pl.held) { U.heldMesh = makeItemMesh(pl.held.id, false); U.heldMesh.rotation.x = Math.PI / 2; U.hand.add(U.heldMesh); }
    U.heldNid = hid;
  }
}

// ---------- шум ----------
function noise(f, pos, radius, pl) {
  if (radius <= 0 || !isHost()) return;
  if (pl) pl.noiseT = now();
  hostessHear(f, pos, radius, pl);
  watchmanHear(f, pos, radius);
  yardHear(f, pos, radius, pl);
  thingHear(f, pos, radius, pl);
}
function myNoise(f, pos, radius) {
  if (radius <= 0) return;
  P.noiseT = now();
  if (Net.role === 'client') Net.send({ t: 'n', f, p: pv(pos), r: radius });
  else noise(f, pos, radius, P);
}

// ---------- Хозяйка ----------
const busy = (e) => e.state === 'dance' || e.state === 'gloat' || e.state === 'dronehide' || e.state === 'indrone';
// на каком расстоянии слепая Хозяйка чувствует игрока без звука: присевшего — только вплотную
const senseR = (p) => p.crouch && (p.moving || 0) < 2 ? D.sense * 0.45 : D.sense;
function hostessHear(f, pos, radius, pl) {
  const h = hostess; if (h.stun > 0 || busy(h) || h.state === 'off') return;
  const d = Math.hypot(h.pos.x - pos.x, h.pos.z - pos.z) + Math.abs(h.pos.y - pos.y) * 1.6;
  if (d > radius * D.hear) return;
  const [x, z] = cellOf(pos);
  if (h.state === 'chase') { if (pl && pl === getTp(h)) { h.known = { f, x, z }; h.lastSeen = now(); } return; }
  if (h.state === 'todance') return;
  // шум совсем рядом от самого игрока — сразу бросается на него
  if (pl && targetable(pl) && radius >= 3 && d < radius * D.hear * 0.45 && Math.abs(h.pos.y - pos.y) < 1.5) { startChase(h, pl); return; }
  if (h.state !== 'investigate') sayW('hostess', 'hear', h.pos);
  h.state = 'investigate'; h.goToCell(f, x, z); h.known = { f, x, z }; h.heardT = now();
  h.yaw = Math.atan2(pos.x - h.pos.x, pos.z - h.pos.z);
}
function updateHostess(dt) {
  const h = hostess;
  if (updateRag(h, dt)) { ragPose(h); h.sync(); return; }
  if (droneScare(h, dt)) { animHostess(); h.sync(); return; }
  if (h.stun > 0) { h.stun -= dt; animHostess(); h.sync(); return; }
  const sp = D.speed;
  if (h.state !== 'chase' && !busy(h)) { const pl = h.nearest(p => targetable(p) && distTo(h, p) < senseR(p)); if (pl) startChase(h, pl); }
  switch (h.state) {
    case 'idle': case 'patrol': case 'menu':
      if (!h.path.length) { const w = HOST_WP[(Math.random() * HOST_WP.length) | 0]; h.goToCell(...w); h.state = 'patrol'; }
      if (h.step(1.3 * sp, dt)) { h.state = 'pause'; h.timer = rand(1.5, 3.5); maybeSetTrap(h); }
      h.idleT = (h.idleT || 20) - dt; if (h.idleT <= 0) { sayW('hostess', 'idle', h.pos); h.idleT = rand(25, 45); }
      break;
    case 'pause': h.timer -= dt; if (h.timer <= 0) h.state = 'patrol'; break;
    case 'settrap': h.timer -= dt; if (h.timer <= 0) { finishTrap(h); h.state = 'patrol'; } break;
    case 'investigate': if (h.step(2.9 * sp, dt)) { h.state = 'listen'; h.timer = 3.2; } break;
    case 'listen': h.timer -= dt; if (h.timer <= 0) h.state = 'patrol'; break;
    case 'gloat': h.timer -= dt; if (h.timer <= 0) { h.state = 'patrol'; h.path = []; } break;
    case 'todance': if (h.step(2.3 * sp, dt)) h.face(watchman.pos, dt); break;
    case 'dance': break;
    case 'chase': {
      let tp = getTp(h);
      const near = h.nearest(p => targetable(p) && distTo(h, p) < senseR(p) * 2.2);
      if (near && (!tp || !targetable(tp) || distTo(h, near) < distTo(h, tp) - 1)) tp = near;
      h.tp = tp;
      if (tp && targetable(tp)) { const pd = distTo(h, tp); if (pd < senseR(tp) * 2.2 || (now() - tp.noiseT < 1.2 && pd < 22)) { const [x, z] = cellOf(tp.pos); h.known = { f: tp.f, x, z }; h.lastSeen = now(); } }
      h.repath -= dt;
      if (h.repath <= 0 && h.known) {
        h.repath = 0.35;
        if (tp && tp.hidden && h.witness === tp.id) { const hd = tp.hidden; h.goToCell(hd.f, hd.x + hd.face[0], hd.z + hd.face[1]); }
        else h.goToCell(h.known.f, h.known.x, h.known.z);
      }
      h.step(3.25 * sp, dt);
      if (tp && !h.path.length && distTo(h, tp) < 3) h.face(tp.pos, dt);
      if (now() - h.lastSeen > (tp && tp.hidden && h.witness === tp.id ? 6 : 3.2)) { h.state = 'listen'; h.timer = 3; h.witness = null; sayW('hostess', 'lost', h.pos); }
      break;
    }
  }
  const active = h.state === 'chase' || h.state === 'investigate';
  for (const pl of players()) {
    if (pl.downed || pl.climb) continue;
    const pd = distTo(h, pl);
    if (pl.hidden) { if (active && h.witness === pl.id && pd < 2.3) { caught(h, pl); break; } }
    else if (pd < (active ? 1.05 : busy(h) || pl.crouch ? 0.6 : 0.85)) { caught(h, pl); break; }
  }
  h.bell = (h.bell || 0) - dt;
  if (h.moving && h.bell <= 0) { fx.bell(V(h.pos.x, h.pos.y + 1.4, h.pos.z)); h.bell = h.state === 'chase' ? 0.32 : 0.75; }
  animHostess();
  h.sync();
}
function startChase(e, pl) {
  if (e.state === 'off') return;
  if (e.state !== 'chase') { e.state = 'chase'; e.repath = 0; sayW(whoOf(e), 'chase', e.pos); }
  e.tp = pl;
  const [x, z] = cellOf(pl.pos); e.known = { f: pl.f, x, z }; e.lastSeen = now();
}

// ---------- Сторож ----------
function watchmanHear(f, pos, radius) {
  const w = watchman; if (w.stun > 0 || busy(w) || w.state === 'todance' || w.state === 'off') return;
  const d = Math.hypot(w.pos.x - pos.x, w.pos.z - pos.z) + Math.abs(w.pos.y - pos.y) * 1.6;
  if (w.state === 'sleep' && d < radius * 0.6 * D.hear) wakeWatch();
  else if ((w.state === 'walk' || w.state === 'return') && radius >= 9 && d < radius * D.hear) { const [x, z] = cellOf(pos); w.goToCell(f, x, z); w.state = 'walk'; }
}
function wakeWatch() { const w = watchman; if (w.state === 'off') return; if (w.state === 'sleep') sayW('watchman', 'wake', w.pos); w.state = 'walk'; w.timer = rand(45, 70); w.path = []; }
function watchSees(pl) {
  const w = watchman; if (!targetable(pl)) return false;
  if (Math.abs(w.pos.y - pl.pos.y) > 1.6) return false;
  const dx = pl.pos.x - w.pos.x, dz = pl.pos.z - w.pos.z, d = Math.hypot(dx, dz);
  const range = pl.light ? 16 : pl.crouch ? 5.5 : 9;
  if (d > range) return false;
  const fx2 = Math.sin(w.yaw), fz2 = Math.cos(w.yaw);
  const cos = (dx * fx2 + dz * fz2) / (d || 1);
  const lim = pl.light ? Math.cos(1.3) : Math.cos(0.62);
  if (d > 1.4 && cos < lim) return false;
  return los(w.f, w.pos, pl.pos);
}
function updateWatchman(dt) {
  const w = watchman;
  if (updateRag(w, dt)) { ragPose(w); w.sync(); return; }
  if (droneScare(w, dt)) { animWatchman(); w.sync(); return; }
  if (w.stun > 0) { w.stun -= dt; animWatchman(); w.sync(); return; }
  const sp = D.speed;
  if (w.state !== 'sleep' && w.state !== 'chase' && !busy(w)) { const pl = players().find(p => watchSees(p)); if (pl) startChase(w, pl); }
  switch (w.state) {
    case 'sleep':
      w.timer -= dt;
      w.snore = (w.snore || 0) - dt; if (w.snore <= 0) { fx.snore(w.pos); w.snore = 3.2; }
      if (w.timer <= 0) wakeWatch();
      break;
    case 'walk':
      w.timer -= dt;
      if (!w.path.length) { if (maybeSetTrap(w)) break; w.goToCell(...WATCH_WP[(Math.random() * WATCH_WP.length) | 0]); }
      w.step(1.2 * sp, dt);
      if (w.timer <= 0) { w.state = 'return'; w.goToCell(...CHAIR); }
      break;
    case 'settrap': w.timer -= dt; if (w.timer <= 0) { finishTrap(w); w.state = 'walk'; } break;
    case 'return':
      if (w.step(1.4 * sp, dt)) { w.state = 'sleep'; w.timer = rand(...D.sleep); w.yaw = Math.PI; }
      break;
    case 'gloat': w.timer -= dt; if (w.timer <= 0) { w.state = 'walk'; w.timer = 30; w.path = []; } break;
    case 'todance': if (w.step(2.3 * sp, dt)) w.face(hostess.pos, dt); break;
    case 'dance': break;
    case 'chase': {
      let tp = getTp(w);
      const seen = players().find(p => watchSees(p));
      if (seen) { tp = seen; w.tp = seen; const [x, z] = cellOf(seen.pos); w.known = { f: seen.f, x, z }; w.lastSeen = now(); }
      w.repath -= dt;
      if (w.repath <= 0 && w.known) {
        w.repath = 0.35;
        if (tp && tp.hidden && w.witness === tp.id) { const hd = tp.hidden; w.goToCell(hd.f, hd.x + hd.face[0], hd.z + hd.face[1]); }
        else w.goToCell(w.known.f, w.known.x, w.known.z);
      }
      w.step(3.35 * sp, dt);
      if (tp && !w.path.length && distTo(w, tp) < 3) w.face(tp.pos, dt);
      if (now() - w.lastSeen > (tp && tp.hidden && w.witness === tp.id ? 6 : 4)) { w.state = 'walk'; w.timer = 25; w.witness = null; }
      break;
    }
  }
  if (w.state !== 'sleep') for (const pl of players()) {
    if (pl.downed || pl.climb) continue;
    const pd = distTo(w, pl);
    if (pl.hidden) { if (w.witness === pl.id && pd < 2.3) { caught(w, pl); break; } }
    else if (pd < (busy(w) ? 0.75 : 1.05)) { caught(w, pl); break; }
  }
  animWatchman();
  w.sync();
}

// ---------- танец бабки и деда ----------
function updateDance(dt) {
  const h = hostess, w = watchman;
  if (h.state === 'dance' || w.state === 'dance') {
    G.danceTime += dt; G.danceLeft -= dt;
    if (G.danceLeft <= 0) {
      if (h.state === 'dance') { h.state = 'patrol'; h.path = []; }
      if (w.state === 'dance') { w.state = 'walk'; w.timer = 30; w.path = []; }
      G.danceT = rand(...D.dance);
    }
    return;
  }
  if (h.state === 'todance' || w.state === 'todance') {
    G.danceWait -= dt;
    if (h.state !== 'todance' || w.state !== 'todance') { if (h.state === 'todance') h.state = 'patrol'; if (w.state === 'todance') { w.state = 'walk'; w.timer = 20; } G.danceT = rand(60, 100); return; }
    if (G.danceWait <= 0 && (h.path.length || w.path.length)) { h.state = 'patrol'; h.path = []; w.state = 'walk'; w.timer = 25; w.path = []; G.danceT = rand(40, 80); return; }
    if (!h.path.length && !w.path.length) {
      h.state = w.state = 'dance'; h.path = []; w.path = []; G.danceTime = 0; G.danceLeft = danceLen() + 0.3;
      sayW('hostess', 'dance', h.pos); setTimeout(() => sayW('watchman', 'dance', watchman.pos), 1200);
      alltoast('Где-то в доме заиграла весёлая музыка… Они танцуют!', 3.5);
    }
    return;
  }
  G.danceT -= dt;
  if (G.danceT > 0) return;
  if (h.stun > 0 || w.stun > 0 || h.state === 'chase' || w.state === 'chase' || h.state === 'investigate') { G.danceT = 20; return; }
  if (w.state === 'sleep') wakeWatch();
  h.state = 'todance'; w.state = 'todance'; G.danceWait = 40;
  h.goToCell(...DANCE_SPOTS.hostess); w.goToCell(...DANCE_SPOTS.watchman);
}

// ---------- капканы ----------
let TRAP_GEO = null;
function makeTrap() {
  if (!TRAP_GEO) TRAP_GEO = {
    met: new THREE.MeshLambertMaterial({ map: T.metal, color: 0x8a8278 }), rust: new THREE.MeshLambertMaterial({ map: T.metal, color: 0x7a4422 }),
    base: new THREE.CylinderGeometry(0.1, 0.12, 0.03, 12), plate: new THREE.CylinderGeometry(0.075, 0.075, 0.012, 12),
    jaw: new THREE.TorusGeometry(0.25, 0.014, 4, 16, Math.PI), tooth: new THREE.ConeGeometry(0.014, 0.05, 4), chain: new THREE.TorusGeometry(0.025, 0.006, 4, 8),
  };
  const Gm = TRAP_GEO, g = new THREE.Group();
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(Gm.base, Gm.rust, 0, 0.015, 0); add(Gm.plate, Gm.met, 0, 0.034, 0);
  const bar = box(0.6, 0.016, 0.03, Gm.rust); bar.position.y = 0.01; g.add(bar);
  for (let i = 0; i < 4; i++) { const c = add(Gm.chain, Gm.rust, 0.34 + i * 0.045, 0.01, 0.02 * (i % 2)); c.rotation.set(Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0); }
  const pivs = [];
  for (const side of [0, 1]) {
    const piv = new THREE.Group(); piv.position.y = 0.02; piv.rotation.y = side ? Math.PI : 0; g.add(piv);
    const jaw = new THREE.Mesh(Gm.jaw, Gm.met); jaw.rotation.x = -Math.PI / 2; piv.add(jaw);
    for (let k = 1; k < 8; k++) { const a = k / 8 * Math.PI; const tt = new THREE.Mesh(Gm.tooth, Gm.met); tt.position.set(Math.cos(a) * 0.24, 0.025, -Math.sin(a) * 0.24); piv.add(tt); }
    pivs.push(piv);
  }
  g.userData.pivs = pivs;
  return g;
}
function trapOK(f, x, z) {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), ch = cell(f, cx, cz);
  if (!ch || !'.cgp'.includes(ch)) return false;
  if (f === 2 && cx >= 3 && cx <= 6 && cz >= 11 && cz <= 13) return false;   // спальня, где просыпаешься
  if (zoneOf(f, cx, cz) === 'secret') return false;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = cell(f, cx + dx, cz + dz); if (n === 'S' || n === 'L') return false; }
  if (G.traps.some(t => !t.gone && t.f === f && Math.hypot(t.pos.x - x, t.pos.z - z) < 3.5)) return false;
  if (players().some(p => p.f === f && Math.hypot(p.pos.x - x, p.pos.z - z) < 1.6)) return false;
  if (COLS[f].some(c => x > c.x0 - 0.35 && x < c.x1 + 0.35 && z > c.z0 - 0.35 && z < c.z1 + 0.35)) return false;
  return true;
}
function addTrap(f, x, z, id) {
  const mesh = makeTrap(); mesh.position.set(x, heightAt(f, x, z) + 0.002, z); mesh.rotation.y = rand(0, 6.28); G.dyn.add(mesh);
  const t = { id: id || ++G.trapSeq, f, pos: V(x, mesh.position.y, z), armed: true, gone: false, close: 0, mesh };
  G.traps.push(t); return t;
}
function maybeSetTrap(e) {
  if (!D.traps || e.state === 'off' || G.trapCD > 0) return false;
  if (G.traps.filter(t => t.armed && !t.gone).length >= D.traps) return false;
  if (Math.random() > 0.55) return false;
  const x = e.pos.x + rand(-0.4, 0.4), z = e.pos.z + rand(-0.4, 0.4);
  if (!trapOK(e.f, x, z)) return false;
  e.state = 'settrap'; e.timer = 1.6; e.path = []; e.trapAt = { f: e.f, x, z };
  sayW(e === hostess ? 'hostess' : 'watchman', 'trap', e.pos);
  G.trapCD = rand(18, 32) / D.speed;
  return true;
}
function finishTrap(e) {
  const a = e.trapAt; if (!a) return; e.trapAt = null;
  if (!trapOK(a.f, a.x, a.z)) return;
  const t = addTrap(a.f, a.x, a.z); fx.trapSet(t.pos);
}
function springTrap(t, pl) {
  if (!t || !t.armed) return;
  t.armed = false; t.close = 0.001;
  fx.trap(t.pos);
  noise(t.f, t.pos.clone(), 15, pl || null);
  if (pl && hostess.state !== 'off' && hostess.distP && distTo(hostess, pl) < 25) setTimeout(() => sayW('hostess', 'snap', hostess.pos), 600);
  if (!pl) setTimeout(() => { t.gone = true; }, 3500);
}
function stepTrap(t) {
  const need = 6 + DIFF_ORDER.indexOf(diffKey) * 2;
  P.trapped = { id: t.id, need, got: 0 }; P.emote = null;
  t.armed = false; t.close = 0.001;
  $('flash').style.opacity = 0.35; setTimeout(() => $('flash').style.opacity = 0, 120);
  P.kick = 0.4; sfx.hurt(null);
  toast('КАПКАН! Жми кнопку, чтобы вырваться', 3);
  if (Net.role === 'client') { sfx.trap(t.pos); Net.send({ t: 'r', a: 'trap', id: t.id }, true); }
  else springTrap(t, P);
}
function struggle() {
  const tr = P.trapped; if (!tr) return;
  tr.got++; sfx.struggle(); P.kick = 0.15;
  myNoise(P.f, P.pos.clone(), 3);
  if (tr.got >= tr.need) {
    P.trapped = null; toast('Вырвался!', 1.5);
    if (Net.role === 'client') Net.send({ t: 'r', a: 'trapfree', id: tr.id }, true);
    else { const t = G.traps.find(t => t.id === tr.id); if (t) t.gone = true; }
  }
}
function updateTraps(dt) {
  if (isHost()) G.trapCD -= dt;
  for (let i = G.traps.length - 1; i >= 0; i--) {
    const t = G.traps[i];
    if (t.gone) { if (t.mesh.parent) t.mesh.parent.remove(t.mesh); G.traps.splice(i, 1); continue; }
    if (t.close > 0 && t.close < 1) { t.close = Math.min(1, t.close + dt * 14); }
    const a = (t.armed ? 0 : t.close) * 1.42;
    t.mesh.userData.pivs.forEach(p => p.rotation.x = a);
  }
  // сам игрок наступил?
  if (G.mode === 'play' && !P.trapped && !P.downed && !P.hidden && !P.climb && !P.dead && !P.sacked) {
    for (const t of G.traps) if (t.armed && t.f === P.f && Math.hypot(t.pos.x - P.pos.x, t.pos.z - P.pos.z) < 0.38) { stepTrap(t); break; }
  }
}
function placeStartTraps() {
  for (const t of G.traps) if (t.mesh.parent) t.mesh.parent.remove(t.mesh);
  G.traps = []; G.trapCD = 25;
  const n = D.traps0 || 0; let tries = 0;
  while (G.traps.length < n && tries++ < 200) {
    const sp = SPOTS[(Math.random() * SPOTS.length) | 0];
    if (sp[0] === 3) continue;
    const x = cc(sp[1]) + rand(-0.5, 0.5), z = cc(sp[2]) + rand(-0.5, 0.5);
    if (trapOK(sp[0], x, z)) addTrap(sp[0], x, z);
  }
}
function syncTraps(arr) {
  const seen = new Set();
  for (const [id, f, x, z, armed, gone] of arr) {
    seen.add(id);
    let t = G.traps.find(t => t.id === id);
    if (!t) { if (gone) continue; t = addTrap(f, x, z, id); }
    if (gone) { t.gone = true; continue; }
    if (P.trapped && P.trapped.id === id) continue;
    if (t.armed && !armed) t.close = 0.001;
    t.armed = !!armed;
  }
  for (const t of G.traps) if (!seen.has(t.id)) t.gone = true;
}

// ================= ДВОРНИК (во дворе) =================
const YARD_WP = [[1, 20, 4], [1, 28, 6], [1, 20, 12], [1, 29, 16], [1, 12, 16], [1, 5, 20], [1, 22, 21], [1, 12, 2], [1, 26, 11], [1, 3, 17], [1, 29, 3], [1, 21, 16]];
const allowYard = (f, x, z, ch) => f === 1 && ch !== null && '.gpcDLr'.includes(ch) && !insideHouse(x, z);
const SACK_SLOTS = [[24.3, 5.2], [25.45, 5.35], [23.55, 6.45], [24.85, 6.55], [25.85, 6.1]];
const SHED_DOOR = '1,24,8';
const outdoors = (pos) => { const [cx, cz] = cellOf(pos); return !insideHouse(cx, cz); };
function yardSees(pl) {
  const y = yard; if (!y || y.state === 'off' || !targetable(pl) || pl.f !== 1 || !outdoors(pl.pos)) return false;
  const dx = pl.pos.x - y.pos.x, dz = pl.pos.z - y.pos.z, d = Math.hypot(dx, dz);
  const range = (pl.light ? 26 : pl.crouch ? 9 : 17) * (D.dark ? 0.8 : 1);
  if (d > range) return false;
  const cos = (dx * Math.sin(y.yaw) + dz * Math.cos(y.yaw)) / (d || 1);
  if (d > 2.5 && cos < Math.cos(1.05)) return false;
  return los(1, y.pos, pl.pos);
}
function yardHear(f, pos, radius, pl) {
  const y = yard; if (!y || y.state === 'off' || y.stun > 0 || ['chase', 'carry', 'gloat', 'dronehide', 'indrone'].includes(y.state) || f !== 1) return;
  const inside = !outdoors(pos);
  const d = Math.hypot(y.pos.x - pos.x, y.pos.z - pos.z);
  const r = radius * D.hear * (inside ? 0.4 : 1.6);   // во дворе слышит отлично, сквозь стены дома — плохо
  if (d > r) return;
  if (pl && targetable(pl) && !inside && d < r * 0.55) { startChase(y, pl); return; }
  if (inside) return;
  const [x, z] = cellOf(pos);
  if (y.state !== 'investigate') sayW('yard', 'hear', y.pos);
  y.state = 'investigate'; y.goToCell(1, x, z);
}
function updateYard(dt) {
  const y = yard; if (!y || y.state === 'off') return;
  if (updateRag(y, dt)) { ragPose(y); y.sync(); return; }
  if (droneScare(y, dt)) { animYard(); y.sync(); return; }
  if (y.stun > 0) { y.stun -= dt; animYard(); y.sync(); return; }
  const sp = D.speed * D.yardSp;
  if (!['chase', 'carry', 'gloat'].includes(y.state)) { const pl = players().find(p => yardSees(p)); if (pl) startChase(y, pl); }
  switch (y.state) {
    case 'idle': case 'patrol': case 'menu':
      if (!y.path.length) { y.goToCell(...YARD_WP[(Math.random() * YARD_WP.length) | 0]); y.state = 'patrol'; }
      if (y.step(1.35 * sp, dt)) { y.state = 'pause'; y.timer = rand(2.5, 5); }
      break;
    case 'pause': y.timer -= dt; if (y.timer <= 0) y.state = 'patrol'; break;
    case 'investigate': if (y.step(3.1 * sp, dt)) {
      y.state = 'listen'; y.timer = 3;
      // пришёл на шорох в сарае — перекладывает шумный мешок на другое место
      const v = players().find(p => p.sacked && p.sackSlot >= 0 && G.time - (p.wiggleT || -99) < 30 && Math.hypot(p.pos.x - y.pos.x, p.pos.z - y.pos.z) < 4);
      if (v) { v.prevSlot = v.sackSlot; v.sackSlot = -1; y.state = 'carry'; y.carry = v.id; y.path = []; y.goToCell(1, 24, 6); sayW('yard', 'shush', y.pos); fx.sack(y.pos); if (Net.role === 'host') Net.send({ t: 'sackdrop', pid: v.id, slot: -1 }, true); if (v.local) toast('Дворник услышал тебя и тащит мешок на другое место!', 3); }
    } break;
    case 'listen': y.timer -= dt; if (y.timer <= 0) y.state = 'patrol'; break;
    case 'gloat': y.timer -= dt; if (y.timer <= 0) { y.state = 'patrol'; y.path = []; } break;
    case 'chase': {
      let tp = getTp(y);
      const seen = players().find(p => yardSees(p));
      if (seen) { tp = seen; y.tp = seen; }
      if (tp && targetable(tp) && tp.f === 1 && outdoors(tp.pos) && (seen === tp || distTo(y, tp) < 9)) { const [x, z] = cellOf(tp.pos); y.known = { f: 1, x, z }; y.lastSeen = now(); }
      y.repath -= dt;
      if (y.repath <= 0 && y.known) { y.repath = 0.35; y.goToCell(1, y.known.x, y.known.z); }
      y.step(3.6 * sp, dt);
      if (tp && !y.path.length && distTo(y, tp) < 3.5 && tp.f === 1) {
        // последние метры — прямо к игроку
        y.face(tp.pos, dt); const dx = tp.pos.x - y.pos.x, dz = tp.pos.z - y.pos.z, dd = Math.hypot(dx, dz) || 1, mv = 3.6 * sp * dt;
        const nx = y.pos.x + dx / dd * mv, nz = y.pos.z + dz / dd * mv;
        if (!solidCell(1, Math.floor(nx / CS), Math.floor(nz / CS))) { y.pos.x = nx; y.pos.z = nz; y.moving = true; y.speedNow = 3.6 * sp; y.anim += mv * 2.6; }
      }
      if (now() - y.lastSeen > 3.5) { y.state = 'listen'; y.timer = 3; sayW('yard', 'lost', y.pos); }
      break;
    }
    case 'carry': {
      const v = PL.get(y.carry);
      if (!v || !v.sacked) { y.carry = null; y.state = 'patrol'; y.path = []; break; }
      v.f = 1; v.pos.set(y.pos.x, 0, y.pos.z);
      if (!y.path.length) y.goToCell(1, 24, 6);
      if (y.step(2.1 * sp, dt) && Math.hypot(y.pos.x - cc(24), y.pos.z - cc(6)) < 1.6) dropSack(v);
      break;
    }
  }
  // уходя из сарая, дворник закрывает дверь
  const d = G.doors.get(SHED_DOOR);
  if (d && d.locked && d.open && !d.blown && y.state !== 'carry') {
    const [cx, cz] = cellOf(y.pos);
    if (Math.hypot(cx - 24, cz - 8) > 2.5 && !players().some(p => p.f === 1 && cellOf(p.pos)[0] === 24 && cellOf(p.pos)[1] === 8)) { d.open = false; fx.door(V(cc(24), 1.2, cc(8)), false); }
  }
  if (y.state !== 'carry' && y.state !== 'gloat') for (const pl of players()) {
    if (!targetable(pl) || pl.f !== 1 || distTo(y, pl) > 1.1) continue;
    if (MP()) sackPlayer(pl); else caught(y, pl);
    break;
  }
  animYard(); y.sync();
}
function animYard() {
  const y = yard, U = y.mesh.userData, t = now() + mt;
  U.sack.visible = y.state === 'carry';
  if (y.rag) { ragPose(y); return; }
  if (y.stun > 0) { U.spine.rotation.x = 0.9; U.hips.position.y = 0.75; U.legs.forEach(l => { l.a.rotation.x = -0.5; l.b.rotation.x = 0.9; }); return; }
  const { s, run } = walkPose(U, y, 0.5, 0.5);
  U.hips.position.y = 1.08 + Math.abs(s) * 0.03 * run;
  U.spine.rotation.x = 0.12 + (y.state === 'chase' ? 0.2 : 0); U.spine.rotation.z = 0;
  U.arms[0].a.rotation.x = y.state === 'carry' ? -2.6 : s * 0.5 * run; U.arms[0].a.rotation.z = -0.08; U.arms[0].b.rotation.x = y.state === 'carry' ? -1.2 : -0.2;
  if (y.state === 'pause') { U.arms[1].a.rotation.x = -0.6 + Math.sin(t * 3) * 0.35; U.arms[1].a.rotation.z = Math.sin(t * 3) * 0.3; U.broom.rotation.x = -0.3 + Math.sin(t * 3) * 0.25; }
  else if (y.state === 'chase') { U.arms[1].a.rotation.x = -1.6 + Math.sin(t * 9) * 0.2; U.arms[1].a.rotation.z = 0.1; U.broom.rotation.x = -1.2; }
  else { U.arms[1].a.rotation.x = -0.35 - s * 0.2; U.arms[1].a.rotation.z = 0.1; U.broom.rotation.x = -0.3; }
  U.arms[1].b.rotation.x = -0.5;
  U.neck.rotation.x = y.state === 'chase' ? -0.1 : 0.1;
  U.head.rotation.y = y.state === 'listen' ? Math.sin(t * 1.4) * 0.7 : 0;
  U.jaw.rotation.x = y.state === 'chase' ? 0.2 + Math.abs(Math.sin(t * 5)) * 0.15 : 0.03;
}
// мешки
function sackPlayer(pl) {
  pl.sacked = true; pl.sackSlot = -1; pl.crouch = false; pl.emote = null; pl.trapped = null;
  if (pl.held) dropFor(pl, false, null, null);
  yard.state = 'carry'; yard.carry = pl.id; yard.tp = null; yard.path = []; yard.goToCell(1, 24, 6);
  sayW('yard', 'sack', yard.pos); fx.sack(yard.pos);
  G.splits.push({ t: G.time, what: 'День ' + G.day + ' — ' + pl.name + ' в мешке у дворника' });
  if (Net.role === 'host') Net.send({ t: 'sacked', pid: pl.id, name: pl.name }, true);
  onSacked(pl.id, pl.name);
  if (!standing().length) endDayAll(yard);
}
function onSacked(pid, name) {
  const pl = PL.get(pid); if (pl) pl.sacked = true;
  const me = pid === P.id;
  shout(me ? null : name);
  if (me) { P.sacked = true; P.emote = null; stopEmote(); if (P.held) setHeldView(null); $('sackView').classList.remove('hidden'); }
  toast(me ? 'Дворник засунул тебя в мешок и несёт в сарай!' : name + ' в мешке! Дворник несёт его в сарай — найдите его среди мешков', 4);
}
function dropSack(v) {
  const used = new Set(players().filter(p => p.sacked && p.sackSlot >= 0).map(p => p.sackSlot));
  let free = SACK_SLOTS.map((_, i) => i).filter(i => !used.has(i));
  if (free.length > 1 && v.prevSlot !== undefined) free = free.filter(i => i !== v.prevSlot);
  const i = free.length ? free[(Math.random() * free.length) | 0] : 0;
  v.sackSlot = i; v.pos.set(SACK_SLOTS[i][0] * CS, 0, SACK_SLOTS[i][1] * CS);
  yard.state = 'gloat'; yard.timer = 2; yard.carry = null; yard.path = []; fx.sack(v.pos);
  if (Net.role === 'host') Net.send({ t: 'sackdrop', pid: v.id, slot: i }, true);
  if (v.local) toast('Тебя бросили в сарае среди мешков. Шурши, чтобы друзья нашли', 4);
}
function yardDrop() {
  const v = yard.carry && PL.get(yard.carry);
  if (v && v.sacked && v.sackSlot < 0) freeSack(v, null);
  yard.carry = null; if (yard.state === 'carry') yard.state = 'patrol';
}
function freeSack(v, by) {
  const slot = v.sackSlot >= 0 ? SACK_SLOTS[v.sackSlot] : null;
  v.sacked = false; v.sackSlot = -1;
  if (slot) v.pos.set(slot[0] * CS, 0, slot[1] * CS + 0.6);
  const p = pv(v.pos);
  if (Net.role === 'host') Net.send({ t: 'unsack', pid: v.id, name: by ? by.name : '', p }, true);
  onUnsacked(v.id, by ? by.name : '', p);
}
function onUnsacked(pid, by, p) {
  const pl = PL.get(pid); if (pl) { pl.sacked = false; pl.sackSlot = -1; }
  if (pid === P.id) { P.sacked = false; P.sackSlot = -1; if (p) { P.pos.set(...p); P.f = 1; } $('sackView').classList.add('hidden'); }
  sfx.revive(); toast(pid === P.id ? (by ? by + ' развязал мешок!' : 'Ты вывалился из мешка!') : (pl ? pl.name : '') + ' свободен', 3);
}
function wiggleSack(pl) {
  if (!pl.sacked || pl.sackSlot < 0) return;
  if (G.time - (pl.wiggleT || -9) < 0.5) return;
  // чем чаще шуршишь подряд, тем громче — дворник слышит со всего двора
  pl.wiggleN = G.time - (pl.wiggleT || -9) < 3 ? Math.min(5, (pl.wiggleN || 0) + 1) : 1;
  pl.wiggleT = G.time; fx.sack(pl.pos);
  const r = 7 + pl.wiggleN * 4;
  noise(1, pl.pos.clone(), r, null);
  const y = yard;
  if (y && y.state !== 'off' && y.stun <= 0 && !['carry', 'dronehide', 'indrone'].includes(y.state) && pl.wiggleN >= 3) {
    // громко шуршишь — он обязательно идёт в сарай проверить
    if (y.state === 'chase' && getTp(y)) return;
    y.state = 'investigate'; y.goToCell(1, Math.floor(pl.pos.x / CS), Math.floor(pl.pos.z / CS) + 1); y.checkSack = pl.id;
    if (!y.saidShush || G.time - y.saidShush > 6) { y.saidShush = G.time; sayW('yard', 'shush', y.pos); }
  }
}
function updateSacks() {
  if (!G.sackMeshes) return;
  G.sackMeshes.forEach((m, i) => {
    m.visible = !P.sacked;   // сидя в мешке, другие мешки не видно — так интереснее
    const v = players().find(p => p.sacked && p.sackSlot === i);
    const w = v && G.time - (v.wiggleT || -9) < 0.8 ? Math.sin(G.time * 30) * 0.18 : 0;
    m.rotation.z = w; m.rotation.x = w * 0.5;
  });
}

// ================= ДРОН =================
const DR = { active: false, phase: '', t: 0, t2: 0, pos: V(), vel: V(), yaw: 0, roll: 0, mesh: null, tgt: V() };
function scheduleDrone() { G.droneT = Math.random() < (D.drone || 0) ? rand(70, 200) : 1e9; }
function headOf(pl) { return V(pl.pos.x, pl.pos.y + 1.3, pl.pos.z); }
// дрон летает только там, где есть проход: двор, открытые двери, лестницы, люк. Сквозь стены — нет.
function allowDrone(f, x, z, ch) {
  if (ch === null || ch === undefined) return false;
  if ('#fqW Y'.includes(ch)) return false;
  if (ch === 'H') return furn.secret.open;
  if (ch === 'G') return G.esc.gateOpen;
  if (ch === 'D' || ch === 'L') { const d = doorAt(f, x, z); return !!d && (!d.locked || d.open); }
  if (f > 1 && !indoor(f, x, z) && zoneOf(f, x, z) !== 'balcony') return false;
  return true;
}
const droneCell = () => { const [x, z] = cellOf(DR.pos); return [DR.f, x, z]; };
function droneAlt(f, x, z) { return f === 1 && !insideHouse(x, z) ? 2.4 : FLOOR_Y[f] + (f === 3 ? 1.3 : 1.6); }
// ИВЕНТ «ДРОН»: всех переносит на второй этаж, дрон летит следом. Беги к выходу (зелёный свет у входной двери),
// по пути можно нырять в шкафы — но шкаф спасает лишь на несколько секунд. Добежал до выхода — ты в безопасности.
const RUN_STARTS = [[2, 3, 5], [2, 15, 5], [2, 15, 12], [2, 9, 5]];
const RUN_EXIT = { f: 1, x: 9, z: 4 };
function startDrone() {
  if (G.houseGone) return;
  DR.active = true; DR.phase = 'chase'; DR.t = 0; DR.t2 = 0; DR.path = []; DR.repath = 0; DR.ramT = 0; DR.f = 1; DR.wait = 2.5; DR.arena = true;
  // всех, кто на ногах, переносит в отдельный коридор
  for (const pl of players()) { pl.safe = false; pl.runBack = { f: pl.f, p: pl.pos.clone() }; }
  standing().forEach((pl, i) => teleportPlayer(pl, 1, AR.x0 + 2.5, AR.z + (i % 2 ? -0.8 : 0.8) * (i ? 1 : 0)));
  DR.pos.set(AR.x0 + 0.8, 2.2, AR.z); DR.vel.set(0, 0, 0);
  alltoast('ДРОН! Тебя затянуло в длинный коридор. Беги к зелёному ВЫХОДУ в конце! Шкафы спасают лишь на несколько секунд', 5);
  G.danceLeft = 0;
}
function teleportPlayer(pl, f, x, z) {
  if (pl.hidden) unhideFor(pl);
  pl.f = f; pl.pos.set(x, FLOOR_Y[f], z); pl.tgt.copy(pl.pos); pl.trapped = null; pl.emote = null;
  pl.teleTo = pl.pos.clone(); pl.teleAt = performance.now();   // пока клиент не подтвердил телепорт — его старые координаты не принимаем
  if (pl.local) { P.hidden = null; P.hideAnim = null; document.body.classList.remove('hiding'); stopEmote(); P.hideT = 0; $('flash').style.opacity = 0.7; setTimeout(() => $('flash').style.opacity = 0, 150); sfx.whisper(null); }
  else Net.send({ t: 'tele', f, p: [r2(x), r2(FLOOR_Y[f]), r2(z)] }, true, pl.id);
}
const exitPos = () => V(cc(RUN_EXIT.x), FLOOR_Y[RUN_EXIT.f], cc(RUN_EXIT.z) + 0.3);
function endArena(msg) {
  // кто остался в коридоре (лежит или призрак) — тоже домой
  for (const pl of players()) if (zoneAt(pl.pos.x, pl.pos.z) === 'arena') { const b = exitPos(); if (pl.dead && pl.local) { P.pos.set(b.x, 0, b.z); } else teleportPlayer(pl, 1, b.x, b.z + 1); }
  DR.arena = false; endRun(msg);
}
function endRun(msg) { if (DR.phase !== 'chase') return; DR.phase = 'leave'; DR.t2 = 0; for (const pl of players()) pl.safe = false; alltoast(msg, 3); }
function updateDrone(dt) {
  if (!DR.active) { if (G.mode === 'play') { G.droneT -= dt; if (G.droneT <= 0) { G.droneT = 1e9; startDrone(); } } return; }
  DR.t += dt;
  if (DR.phase === 'leave') {
    DR.t2 += dt; DR.vel.y += dt * 5; DR.vel.x *= 0.98; DR.vel.z *= 0.98; DR.pos.addScaledVector(DR.vel, dt);
    if (DR.t2 > 3) DR.active = false;
    return;
  }
  // кто добежал до выхода — в безопасности и возвращается в дом
  for (const pl of players()) if (!pl.safe && targetable(pl) && pl.pos.x > AR.x1 - 3.2 && zoneAt(pl.pos.x, pl.pos.z) === 'arena') {
    pl.safe = true; sfx.revive();
    const back = exitPos(); teleportPlayer(pl, 1, back.x, back.z);
    if (pl.local) toast('Ты выбрался из коридора!', 3); else Net.send({ t: 'toast', text: 'Ты выбрался из коридора!', dur: 3 }, true, pl.id);
  }
  const runners = standing().filter(p => !p.safe && zoneAt(p.pos.x, p.pos.z) === 'arena');
  if ((!runners.length && DR.t > 2.5) || DR.t > 120) { endArena(standing().length && !runners.length ? 'Все выбрались! Дрон улетел' : 'Дрон улетел…'); return; }
  if (DR.wait > 0) { DR.wait -= dt; return; }
  if (DR.arena) { arenaMove(dt); return; }
  // цель — ближайший бегущий игрок (по пути, а не по прямой)
  let tp = null, bd = 1e9;
  for (const pl of runners) if (targetable(pl)) { const d = DR.pos.distanceTo(headOf(pl)) + (pl.f !== DR.f ? 6 : 0); if (d < bd) { bd = d; tp = pl; } }
  const [cf, cx, cz] = droneCell();
  DR.repath -= dt;
  if (tp && DR.repath <= 0) {
    DR.repath = 0.5;
    const [tx, tz] = cellOf(tp.pos);
    const from = NID(cf, cx, cz), goal = nearestAllowed(tp.f, tx, tz, allowDrone);
    DR.path = (goal !== null && bfs(from, goal, allowDrone)) || [];
  }
  let goalPos;
  const direct = tp && tp.f === DR.f && DR.pos.distanceTo(headOf(tp)) < 7 && los(DR.f, DR.pos, tp.pos);
  if (direct) goalPos = headOf(tp);
  else if (DR.path.length) {
    const id = DR.path[0], nf = NF(id), nx = NX(id), nz = NZ(id);
    const ch = cell(nf, nx, nz);
    if ((ch === 'D' || ch === 'L') && Math.hypot(cc(nx) - DR.pos.x, cc(nz) - DR.pos.z) < 1.6) {
      const d = doorAt(nf, nx, nz);
      if (d && !d.open) { DR.ramT += dt; DR.vel.multiplyScalar(0.9); if (DR.ramT > 0.9) { DR.ramT = 0; setDoor(d, true); fx.impact(V(cc(nx), FLOOR_Y[nf] + 1.4, cc(nz)), 9); } DR.pos.addScaledVector(DR.vel, dt); return; }
    }
    goalPos = V(cc(nx), droneAlt(nf, nx, nz), cc(nz));
    if (Math.hypot(goalPos.x - DR.pos.x, goalPos.z - DR.pos.z) < 0.45 && Math.abs(goalPos.y - DR.pos.y) < 1.2) { DR.f = nf; DR.path.shift(); }
  } else goalPos = V(DR.pos.x + Math.sin(DR.t * 1.3) * 1.5, droneAlt(cf, cx, cz), DR.pos.z + Math.cos(DR.t * 1.3) * 1.5);
  const want = goalPos.clone().sub(DR.pos); const dist = want.length();
  want.normalize().multiplyScalar(D.droneSp * Math.min(1, 0.3 + dist / 1.5));
  DR.vel.lerp(want, Math.min(1, dt * 3.2));
  const np = DR.pos.clone().addScaledVector(DR.vel, dt);
  const [nx2, nz2] = cellOf(np), [ox2, oz2] = cellOf(DR.pos);
  if (allowDrone(DR.f, nx2, nz2, cell(DR.f, nx2, nz2)) || !allowDrone(DR.f, ox2, oz2, cell(DR.f, ox2, oz2))) DR.pos.copy(np);
  else DR.vel.multiplyScalar(-0.2);
  if (tp && tp.f === DR.f && DR.pos.distanceTo(headOf(tp)) < 0.9) droneHit(tp);
}
// шкаф во время ивента спасает ненадолго: дрон кружит рядом, и шкаф начинает трястись
function updateRunHide(dt) {
  if (!(DR.active && DR.phase === 'chase') || !P.hidden || P.hideAnim) { P.hideT = 0; return; }
  P.hideT = (P.hideT || 0) + dt;
  if (P.hideT > 3.5 && !P.hideWarn) { P.hideWarn = true; toast('Дрон кружит у шкафа… Беги дальше!', 2.5); sfx.wardrobe(null); }
  if (P.hideT > 6) { P.hideT = 0; P.hideWarn = false; toast('Шкаф трясётся — вылезай и беги!', 2); exitHide(); }
  if (P.hideT < 0.1) P.hideWarn = false;
}
// враги тоже боятся дрона: бегут прятаться и сидят тихо, пока он не улетит
function droneScare(e, dt) {
  const on = DR.active && DR.phase === 'chase';
  if (!on) {
    if (e.state === 'dronehide' || e.state === 'indrone') {
      e.mesh.visible = true; e.state = e === watchman ? 'walk' : e === thing ? 'wander' : 'patrol'; e.timer = 25; e.path = [];
      if (e.hideAt) { e.hideAt.enemy = null; e.hideAt = null; }
    }
    return false;
  }
  if (e.state === 'off') return false;
  if (e.state === 'indrone') { e.mesh.visible = false; return true; }
  if (e.state !== 'dronehide') {
    if (e === yard) yardDrop();
    e.state = 'dronehide'; e.path = []; e.tp = null; e.witness = null; e.stun = 0;
    sayW(whoOf(e), 'drone', e.pos);
    if (e === thing) { let far = THING_WP[0], fd = -1; for (const w of THING_WP) { const d = Math.hypot(cc(w[1]) - e.pos.x, cc(w[2]) - e.pos.z); if (d > fd) { fd = d; far = w; } } e.goToCell(...far); }
    else if (e === yard) e.goToCell(1, 25, 6);
    else {
      let best = null, bd = 1e9;
      for (const h of furn.hides) {
        if ((h.f !== 1 && h.f !== 2) || h.enemy || players().some(p => p.hidden === h)) continue;
        const d = Math.hypot(cc(h.x) - e.pos.x, cc(h.z) - e.pos.z) + Math.abs(h.f - e.f) * 8;
        if (d < bd) { bd = d; best = h; }
      }
      if (best) { best.enemy = e; e.hideAt = best; e.goToCell(best.f, best.x + best.face[0], best.z + best.face[1]); }
    }
  }
  const scared = DR.pos.distanceTo(e.pos) < 8 ? 1.35 : 1;
  if (e.step((e === thing ? 2.4 : 3.0) * D.speed * scared, dt)) {
    e.state = 'indrone'; e.mesh.visible = false;
    if (e.hideAt) fx[e.hideAt.type === 'wardrobe' ? 'wardrobe' : 'door'](e.hideAt.pos, true);
  }
  return true;
}
function droneHit(pl) {
  const p = DR.pos.clone();
  DR.active = false; DR.phase = '';
  explodeAt(p, pl.f, null);
  caught(null, pl);
}
function animDrone(dt) {
  if (!DR.mesh) { DR.mesh = makeDrone(T); scene.add(DR.mesh); }
  const m = DR.mesh;
  m.visible = DR.active && G.mode !== 'menu';
  if (G.exitMark) { G.exitMark.visible = false; G.exitMark.children[0].material.opacity = 0.45 + Math.sin(now() * 6) * 0.25; }
  if (!m.visible) return;
  const sp = Math.hypot(DR.vel.x, DR.vel.z);
  if (sp > 0.3) { const ny = Math.atan2(DR.vel.x, DR.vel.z); const turn = ((ny - DR.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; DR.roll = THREE.MathUtils.lerp(DR.roll, -turn * 1.5, Math.min(1, dt * 3)); DR.yaw = lerpAngle(DR.yaw, ny, Math.min(1, dt * 4)); }
  m.position.copy(DR.pos); m.position.y += Math.sin(now() * 3) * 0.05;
  m.rotation.set(0, 0, 0); m.rotation.order = 'YXZ'; m.rotation.y = DR.yaw; m.rotation.z = Math.max(-0.7, Math.min(0.7, DR.roll)); m.rotation.x = -DR.vel.y * 0.08;
  m.userData.rotor.rotation.z += dt * 60;
  m.userData.led.visible = Math.floor(now() * 3) % 2 === 0;
}

// ================= ТРУ АДАМ И АУРА-БАТТЛ =================
// В случайный момент в дом заходит Тру Адам — идеальная челюсть, модельная внешность. Он «могает» всех вокруг.
// Подойдёт к тебе — начинается аура-баттл: жми «МОГ!», когда бегунок в золотой зоне. Победишь — он уронит шахед.
const allowAdam = (f, x, z, ch) => allowUpper(f, x, z, ch) || allowYard(f, x, z, ch);
const AD = { active: false, t: 0, fight: null, beaten: false };
function scheduleAdam() { G.adamT = AD.beaten ? 1e9 : rand(90, 220); }
function startAdam() {
  if (!adam || AD.beaten) return;
  AD.active = true; AD.t = 0; AD.fight = null;
  adam.place(1, 9, 5); adam.state = 'walk'; adam.mesh.visible = true; adam.path = [];
  fx.sparkle(adam.pos);
  alltoast('В дом зашёл ТРУ АДАМ. Он могает всех вокруг… Победи его в аура-баттле!', 4.5);
}
function updateAdam(dt) {
  if (!adam) return;
  if (!AD.active) { adam.mesh.visible = false; if (G.mode === 'play' && !(G.practice && G.practice.noAdam)) { G.adamT -= dt; if (G.adamT <= 0) { G.adamT = 1e9; startAdam(); } } return; }
  AD.t += dt;
  const e = adam;
  if (updateRag(e, dt)) { ragPose(e); e.sync(); return; }
  if (AD.fight) { e.state = 'pose'; const pl = PL.get(AD.fight); if (pl) e.face(pl.pos, dt); animAdam(); e.sync(); if (!pl || !pl.aura) AD.fight = null; return; }
  if (AD.t > 75) { adamLeave('Тру Адам ушёл могать кого-то другого'); return; }
  // идёт к ближайшему игроку
  let tp = null, bd = 1e9;
  for (const pl of players()) if (targetable(pl) && (pl.f === 1 || pl.f === 2)) { const d = distTo(e, pl); if (d < bd) { bd = d; tp = pl; } }
  e.repath = (e.repath || 0) - dt;
  if (tp && e.repath <= 0) { e.repath = 0.6; const [x, z] = cellOf(tp.pos); e.goToCell(tp.f, x, z); }
  e.state = 'walk'; e.step(1.9 * D.speed, dt);
  e.sp2 = (e.sp2 || 0) - dt; if (e.sp2 <= 0) { e.sp2 = 1.4; fx.sparkle(V(e.pos.x, e.pos.y + 1.6, e.pos.z)); }
  if (tp && distTo(e, tp) < 2.2 && tp.f === e.f) {
    AD.fight = tp.id; tp.aura = true;
    sayW('adam', 'mog', e.pos);
    if (tp.local) startAura(); else Net.send({ t: 'aura' }, true, tp.id);
  }
  animAdam(); e.sync();
}
function adamLeave(msg) { AD.active = false; AD.fight = null; adam.mesh.visible = false; scheduleAdam(); if (msg) alltoast(msg, 3); }
function animAdam() {
  const e = adam, U = e.mesh.userData, t = now() + mt;
  if (e.rag) { ragPose(e); return; }
  if (e.state === 'pose') {
    U.hips.position.y = 1.06; U.spine.rotation.x = -0.08; U.spine.rotation.z = 0;
    U.legs.forEach((l, i) => { l.a.rotation.x = 0; l.b.rotation.x = 0; l.a.rotation.z = (i ? -1 : 1) * 0.12; });
    const flex = Math.sin(t * 2) > 0;
    U.arms.forEach((a, i) => { a.a.rotation.x = flex ? -0.2 : -1.2; a.a.rotation.z = (i ? 1 : -1) * (flex ? 1.3 : 0.4); a.b.rotation.x = flex ? -2.2 : -1.6; });
    U.neck.rotation.x = -0.15; U.head.rotation.y = Math.sin(t * 0.8) * 0.3; U.jaw.scale.setScalar(1 + Math.max(0, Math.sin(t * 4)) * 0.06);
    U.aura.material.opacity = 0.7 + Math.sin(t * 5) * 0.3; return;
  }
  const { s, run } = walkPose(U, e, 0.5, 0.5);
  U.hips.position.y = 1.06 + Math.abs(s) * 0.04 * run; U.spine.rotation.x = -0.05; U.spine.rotation.z = s * 0.06;
  U.arms.forEach((a, i) => { a.a.rotation.x = (i ? s : -s) * 0.45; a.a.rotation.z = (i ? 1 : -1) * 0.25; a.b.rotation.x = -0.3; });
  U.neck.rotation.x = -0.12; U.head.rotation.y = 0; U.aura.material.opacity = 0.6;
}
// аура-баттл (только у того, на кого вышел Адам)
const AB = { on: false, round: 0, hits: 0, miss: 0, pos: 0, dir: 1, zone: [0.4, 0.55], speed: 0.9, lock: 0 };
function newAuraRound() {
  const w = Math.max(0.09, 0.2 - AB.round * 0.015);
  const c = rand(0.15, 0.85 - w); AB.zone = [c, c + w]; AB.pos = Math.random() < 0.5 ? 0 : 1; AB.dir = AB.pos ? -1 : 1;
  $('abZone').style.left = (AB.zone[0] * 100) + '%'; $('abZone').style.width = (w * 100) + '%';
  $('abRound').textContent = 'Раунд ' + (AB.round + 1) + ' из 7 · попаданий ' + AB.hits + ' (нужно 5)';
}
function auraTap() {
  if (!AB.on || AB.lock > 0) return;
  const ok = AB.pos >= AB.zone[0] && AB.pos <= AB.zone[1];
  if (ok) AB.hits++; else AB.miss++;
  sfx.aura(ok); AB.lock = 0.45;
  $('abMsg').textContent = ok ? ['МОГ!', 'ЧЕЛЮСТЬ!', 'АУРА +100', 'СИГМА!'][(Math.random() * 4) | 0] : 'тебя могнули…';
  $('abMsg').className = ok ? 'ok' : 'no';
  const share = 50 + (AB.hits - AB.miss) * 9; $('abMeter').style.width = Math.max(4, Math.min(96, share)) + '%';
  AB.round++;
  if (AB.hits >= 5 || AB.miss >= 3 || AB.round >= 7) { setTimeout(() => endAura(AB.hits >= 5), 500); return; }
  setTimeout(newAuraRound, 400);
}
function endAura(win) {
  AB.on = false; P.ui = false; $('auraGame').classList.add('hidden');
  if (win) { toast('ТЫ МОГНУЛ ТРУ АДАМА! Он уронил шахед', 4); sfx.aura(true); }
  else { const el = $('mogged'); el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2600); }
  if (Net.role === 'client') Net.send({ t: 'r', a: 'aura', win }, true); else auraResult(P, win);
}
function auraResult(pl, win) {
  pl.aura = false;
  if (!AD.active) return;
  const at = adam.pos.clone();
  if (win) {
    AD.beaten = true; sayW('adam', 'lose', adam.pos);
    const o = addObject('shahed', 1, Math.floor(at.x / CS), Math.floor(at.z / CS), 'item'); o.f = adam.f; o.pos.set(at.x, FLOOR_Y[adam.f] + 1.2, at.z); o.rest = false; o.vel.set(0, 1, 0); o.home = { f: adam.f, pos: V(at.x, FLOOR_Y[adam.f], at.z) }; announceObject(o);
    adamLeave(pl.name && MP() ? pl.name + ' могнул Тру Адама! Он уронил шахед' : null);
  } else {
    sayW('adam', 'win', adam.pos); G.mogReason = true;
    adamLeave(null);
    caught(adam, pl);
  }
}

// ---------- мини-игра с Томом Перлом: накорми его шоколадом ----------
const TG = { on: false, t: 0, score: 0, pieces: [], mouth: 0, spawnT: 0, goal: 18, time: 20 };
function startTom() {
  TG.on = true; TG.t = 0; TG.score = 0; TG.pieces = []; TG.mouth = 0; TG.spawnT = 0;
  P.ui = true; if (!MP()) { G.prevMode = G.mode; G.mode = 'minigame'; }
  $('tomGame').classList.remove('hidden'); sfx.click();
  if (!TG.face) { TG.face = T.tomPearl.image; }
}
function endTom(byUser) {
  TG.on = false; P.ui = false; $('tomGame').classList.add('hidden');
  if (!MP() && G.mode === 'minigame') G.mode = G.prevMode || 'play';
  if (byUser) return;
  if (TG.score >= TG.goal) {
    sfx.gulp();
    P.known[0] = G.code.slice(0, 2) + '··'; P.known[1] = '··' + G.code.slice(2); P.known.word = (G.word || '').toUpperCase();
    P.symKnown = { 0: G.sym[0], 1: G.sym[1], 2: G.sym[2] };
    toast('Том Перл наелся и шепнул тебе все секреты дома: код сейфа ' + G.code + ', пароль «' + (G.word || '').toUpperCase() + '», картинки сарая: ' + G.sym.map(k => SYM_NAMES[k]).join(' — '), 7);
  } else toast('Том Перл остался голодным (' + TG.score + ' из ' + TG.goal + ')', 3);
}
function updateTom(dt) {
  if (!TG.on) return;
  TG.t += dt; TG.mouth = Math.max(0, TG.mouth - dt * 3);
  TG.spawnT -= dt;
  if (TG.spawnT <= 0) { TG.spawnT = Math.max(0.35, 0.8 - TG.t * 0.02); TG.pieces.push({ x: rand(0.08, 0.92), y: rand(0.42, 0.9), life: 1.5, max: 1.5, r: rand(-0.4, 0.4) }); }
  for (const p of TG.pieces) p.life -= dt;
  TG.pieces = TG.pieces.filter(p => p.life > 0);
  drawTom();
  if (TG.t >= TG.time) endTom(false);
}
function drawTom() {
  const c = $('tomCanvas'), g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#1a120c'; g.fillRect(0, 0, w, h);
  const fw = 150, fh = 200;
  if (TG.face) g.drawImage(TG.face, 0, 0, TG.face.width, TG.face.height - 60, w / 2 - fw / 2, 6, fw, fh * 0.9);
  // рот, который жуёт
  const mo = 4 + TG.mouth * 16;
  g.fillStyle = '#3a0a08'; g.beginPath(); g.ellipse(w / 2, 6 + fh * 0.9 * 0.52, 16, mo, 0, 0, 7); g.fill();
  for (const p of TG.pieces) {
    const x = p.x * w, y = p.y * h, k = p.life / p.max;
    g.save(); g.translate(x, y); g.rotate(p.r); g.globalAlpha = Math.min(1, k * 2);
    g.fillStyle = '#4a2a14'; g.fillRect(-24, -14, 48, 28); g.fillStyle = '#5e3a1e';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.fillRect(-21 + i * 15, -11 + j * 12, 12, 10);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-21, -11, 12, 3);
    g.restore();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#f0e0c0'; g.font = '600 18px Osw, Arial'; g.textAlign = 'left';
  g.fillText('Съедено: ' + TG.score + ' / ' + TG.goal, 10, h - 12);
  g.textAlign = 'right'; g.fillText(Math.max(0, TG.time - TG.t).toFixed(1) + ' с', w - 10, h - 12);
}
function tomTap(ev) {
  if (!TG.on) return;
  const c = $('tomCanvas'), r = c.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
  const i = TG.pieces.findIndex(p => Math.abs(p.x - x) < 0.09 && Math.abs(p.y - y) < 0.09);
  if (i >= 0) { TG.pieces.splice(i, 1); TG.score++; TG.mouth = 1; sfx.smack(); if (TG.score % 5 === 0) setTimeout(() => sfx.gulp(), 150); }
}

// ================= ШАХЕД ПРОТИВ ВОРОТ, ФУРГОН =================
let road = null, van = null, SUR = null;
function buildRoad() {
  if (road) return;
  road = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#26262a'; g.fillRect(0, 0, 64, 256); for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.06 + ')'; g.fillRect(Math.random() * 64, Math.random() * 256, 2, 2); }
  g.fillStyle = '#c8c0a0'; g.fillRect(29, 0, 6, 120);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 30); t.colorSpace = THREE.SRGBColorSpace;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(6, 200), new THREE.MeshLambertMaterial({ map: t }));
  strip.rotation.x = -Math.PI / 2; strip.rotation.z = Math.PI / 2; strip.position.set(cc(9), 0.01, -4.5); road.add(strip);
  scene.add(road);
  van = makeVan(T); van.position.set(cc(9) + 4.5, 0, -4.5); van.rotation.y = -Math.PI / 2; scene.add(van);
}
function launchShahedAtGate(pl) {
  const g = V(cc(9), 1.2, CS * 0.5);
  explodeAt(g, 1, pl);
  G.esc.gateOpen = true; G.esc.gateBlown = true; maps[1][0][9] = '.';
  if (gateM) gateM.visible = false;
  alltoast('ШАХЕД разнёс ворота! За ними дорога — у ворот лежит карта', 4);
}

// ================= БУНКЕР: пульт, с которого можно запустить шахед и управлять им =================
// ---- за воротами: дорога, поле, бункер, фургон ----
const OUT = { x0: -40, x1: 100, z0: -44 };
const OUT_COLS = [];
const BUNKER = { x: -24, z: -11 };
const MAPPOS = V(cc(9) + 1.6, 0.03, -1.8);
const zoneAt = (x, z) => x > 650 ? 'banya' : x > 350 ? 'arena' : x < -250 ? 'club' : z < 0 ? 'out' : null;
const hitBoxes = (list, x, z, r = 0.28) => list.some(c => x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1);
function zoneSolid(zone, x, z) {
  if (zone === 'out') return x < OUT.x0 || x > OUT.x1 || z < OUT.z0 || hitBoxes(OUT_COLS, x, z, 0);
  if (zone === 'banya') return banyaSolid(x, z);
  if (zone === 'arena') return x < AR.x0 + 0.4 || x > AR.x1 - 0.4 || Math.abs(z - AR.z) > 1.7 || hitBoxes(AR_COLS, x, z, 0);
  return true;
}
function buildOutside() {
  const trunk = LM({ map: T.wood, color: 0x4a3a2a }), leaf = LM({ color: 0x1e3420 });
  const g = new THREE.Group();
  const spots = [[-34, -6], [-30, -14], [-17, -15], [-12, -7], [-20, -4], [-8, -13], [4, -14], [44, -12], [56, -8], [70, -14], [84, -6], [92, -12], [-36, -12], [-27, -2]];
  for (const [x, z] of spots) {
    g.add(box(0.35, 2.6, 0.35, trunk, x, 1.3, z));
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 8), leaf); c1.position.set(x, 3.6, z); g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 8), leaf); c2.position.set(x, 5.0, z); g.add(c2);
    OUT_COLS.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 });
  }
  // кусты по краю поля — чтобы бункер не было видно с дороги
  for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), leaf); b.scale.set(1.4, 0.8, 1.1); b.position.set(-38 + Math.random() * 30, 0.5, -9 + Math.random() * 7); g.add(b); }
  scene.add(g);
  buildHamlet();
  OUT_COLS.push({ x0: van.position.x - 2.5, x1: van.position.x + 2.5, z0: van.position.z - 1.1, z1: van.position.z + 1.1 });
  // карта у ворот
  const mc = document.createElement('canvas'); mc.width = 128; mc.height = 96; const mg = mc.getContext('2d');
  mg.fillStyle = '#d8c89c'; mg.fillRect(0, 0, 128, 96); mg.strokeStyle = '#6a4a2a'; mg.lineWidth = 3; mg.strokeRect(4, 4, 120, 88);
  mg.strokeStyle = '#a02020'; mg.lineWidth = 4; mg.beginPath(); mg.moveTo(90, 30); mg.lineTo(30, 70); mg.stroke(); mg.font = 'bold 28px Georgia'; mg.fillStyle = '#a02020'; mg.fillText('X', 18, 80);
  const mt2 = new THREE.CanvasTexture(mc); mt2.colorSpace = THREE.SRGBColorSpace;
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), new THREE.MeshLambertMaterial({ map: mt2, side: THREE.DoubleSide, emissive: 0x201808 }));
  mapMesh.rotation.x = -Math.PI / 2; mapMesh.rotation.z = 0.4; mapMesh.position.copy(MAPPOS); scene.add(mapMesh); G.mapMesh = mapMesh;
}
// ================= ЗАБРОШЕННАЯ ДЕРЕВНЯ ЗА ДОРОГОЙ =================
// дома с заколоченными окнами, столбы с проводами, остановка, фонарь, колодец, стога, ржавая машина, водонапорная башня
const HAMLET_HOUSES = [[6, -29, 0.05, 0xe0d0b8], [25, -31, -0.04, 0xb8d0d0], [45, -28, 0.08, 0xe0c0a8], [65, -32, 0, 0xd8d0c0], [85, -29, -0.06, 0xc0c0d8]];
function buildHamlet() {
  const g = new THREE.Group();
  const wood = LM({ map: T.wood, color: 0x6a5a48 }), woodD = LM({ map: T.wood, color: 0x3a2c20 }), roofM = LM({ map: T.roof, color: 0x6a5a5a });
  const dark = LM({ color: 0x080606 }), metal = LM({ map: T.metal }), rust = LM({ map: T.metal, color: 0x8a5030 });
  const col = (x0, x1, z0, z1, h) => OUT_COLS.push({ x0, x1, z0, z1, h });
  // крашеная вагонка, облезлая — светлее, чем у нашего дома, чтобы под луной было видно
  const vag = tex(256, 256, (cg, w, h, R) => {
    for (let y = 0; y < h; y += 21) { const v = 150 + R() * 30; cg.fillStyle = `rgb(${v | 0},${v - 8 | 0},${v - 20 | 0})`; cg.fillRect(0, y, w, 21); cg.fillStyle = 'rgba(0,0,0,0.35)'; cg.fillRect(0, y + 18, w, 3); }
    for (let i = 0; i < 26; i++) { cg.fillStyle = 'rgba(70,50,30,' + (0.3 + R() * 0.4) + ')'; cg.fillRect(R() * w, R() * h, 8 + R() * 40, 4 + R() * 14); }
    grime(cg, w, h, 77, 0.25);
  }, 77);
  // ---- дома ----
  HAMLET_HOUSES.forEach(([x, z, ry, tint], i) => {
    const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = ry;
    const wm = LM({ map: vag, color: tint });
    h.add(box(7, 3.2, 6, wm, 0, 1.6, 0));
    h.add(box(7.4, 0.35, 6.4, LM({ map: T.stone, color: 0x5a5a56 }), 0, 0.17, 0));   // цоколь
    // двускатная крыша
    for (const s of [-1, 1]) { const r = box(7.8, 0.14, 3.75, roofM, 0, 4.25, s * 1.55); r.rotation.x = s * 0.62; h.add(r); }
    const gable = new THREE.Shape(); gable.moveTo(-3, 0); gable.lineTo(3, 0); gable.lineTo(0, 2.2); gable.closePath();
    for (const s of [-1, 1]) { const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), wm); gm.rotation.y = Math.PI / 2 * s; gm.position.set(3.5 * s + 0.005 * s, 3.2, 0); h.add(gm); }
    // дверь и окна (заколочены)
    h.add(box(1.0, 2.0, 0.06, dark, 0.8, 1.35, 3.01));
    h.add(box(1.4, 0.14, 0.4, woodD, 0.8, 0.42, 3.25));   // крылечко
    for (const wx of [-2.2, 2.6]) {
      const lit = i === 2 && wx < 0;
      h.add(box(1.1, 0.9, 0.06, lit ? new THREE.MeshBasicMaterial({ color: 0x8a5a20 }) : dark, wx === 2.6 ? -1.2 : wx, 1.8, 3.01));
      if (!lit) for (const a of [0.5, -0.5]) { const b = box(1.4, 0.12, 0.05, woodD, wx === 2.6 ? -1.2 : wx, 1.8, 3.06); b.rotation.z = a; h.add(b); }
    }
    for (const sx of [-1, 1]) { h.add(box(0.06, 0.9, 1.1, dark, 3.51 * sx, 1.8, 0)); const b = box(0.05, 0.12, 1.4, woodD, 3.56 * sx, 1.8, 0); b.rotation.x = 0.5; h.add(b); }
    // труба
    h.add(box(0.5, 1.6, 0.5, LM({ map: T.brick }), -2, 4.6, -1));
    g.add(h);
    // коллайдер (дом повёрнут чуть-чуть — берём с запасом)
    col(x - 3.9, x + 3.9, z - 3.4, z + 3.6, 6.4);
    // заборчик перед домом с калиткой
    for (let k = -4; k <= 4; k++) { if (k === 1 || k === 2) continue; const p = box(0.08, 0.9, 0.08, woodD, x + k * 0.9, 0.45, z + 5.6); p.rotation.z = (Math.sin(i * 7 + k) * 0.08); g.add(p); }
    g.add(box(2.6, 0.06, 0.05, woodD, x - 2.3, 0.7, z + 5.6)); g.add(box(1.8, 0.06, 0.05, woodD, x + 3.1, 0.7, z + 5.6));
    col(x - 3.8, x + 0.6, z + 5.5, z + 5.7, 1); col(x + 2.3, x + 3.9, z + 5.5, z + 5.7, 1);
    // тропинка к дороге
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.4, Math.abs(z + 5.6 + 8)), new THREE.MeshLambertMaterial({ map: T.dirt, color: 0x6a5a40, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    path.rotation.x = -Math.PI / 2; path.position.set(x + 1.45, 0.015, (z + 5.6 - 8) / 2); g.add(path);
  });
  // ---- столбы с проводами вдоль дороги ----
  const poles = [];
  for (let px = -36; px <= 98; px += 15) {
    const p = new THREE.Group(); p.position.set(px, 0, -9.6);
    p.add(box(0.22, 7.2, 0.22, woodD, 0, 3.6, 0)); p.add(box(1.8, 0.14, 0.14, woodD, 0, 6.8, 0));
    for (const ix of [-0.75, 0, 0.75]) p.add(box(0.07, 0.16, 0.07, LM({ color: 0x8aa0a0 }), ix, 6.95, 0));
    g.add(p); poles.push(px); col(px - 0.2, px + 0.2, -9.8, -9.4, 7.2);
  }
  const wireM = new THREE.LineBasicMaterial({ color: 0x0a0a0a });
  for (let i = 0; i + 1 < poles.length; i++) for (const ix of [-0.75, 0, 0.75]) {
    const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(poles[i] + (poles[i + 1] - poles[i]) * t + ix, 7.0 - Math.sin(t * Math.PI) * 0.8, -9.6)); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
  }
  // ---- остановка ----
  const st = new THREE.Group(); st.position.set(34, 0, -11.2);
  st.add(box(4, 0.12, 1.8, metal, 0, 2.5, 0)); st.add(box(4, 2.4, 0.08, LM({ map: T.metal, color: 0x6a7a8a }), 0, 1.25, -0.85));
  for (const sx of [-1.9, 1.9]) st.add(box(0.1, 2.5, 0.1, metal, sx, 1.25, 0.8));
  st.add(box(3, 0.08, 0.45, woodD, 0, 0.5, -0.5)); st.add(box(0.5, 0.7, 0.05, LM({ color: 0xc0b080 }), -1.5, 1.6, -0.8));
  g.add(st); col(31.9, 36.1, -12.2, -11.9, 2.6); col(31.9, 32.1, -12.2, -10.3, 2.6); col(35.9, 36.1, -12.2, -10.3, 2.6);
  // ---- фонарь у остановки (настоящий свет, мигает) ----
  g.add(box(0.12, 4.6, 0.12, metal, 38.5, 2.3, -10.2)); g.add(box(0.9, 0.08, 0.08, metal, 38.1, 4.55, -10.2));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd890 })); bulb.position.set(37.7, 4.4, -10.2); g.add(bulb);
  LAMPS.push({ f: 1, x: 0, z: 0, col: 0xffc070, i: 10, d: 16, flick: true, noOff: true, pos: V(37.7, 4.3, -10.2), bulb, onMat: bulb.material, offMat: bulb.material, on: true });
  col(38.3, 38.7, -10.4, -10.0, 4.6);
  // ---- колодец ----
  const wl = new THREE.Group(); wl.position.set(55, 0, -23);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.8, 14, 1, true), LM({ map: T.stone, color: 0x6a6a64, side: THREE.DoubleSide })); ring.position.y = 0.4; wl.add(ring);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.85, 14), dark); water.rotation.x = -Math.PI / 2; water.position.y = 0.3; wl.add(water);
  for (const sx of [-0.85, 0.85]) wl.add(box(0.1, 1.9, 0.1, woodD, sx, 0.95, 0));
  for (const s of [-1, 1]) { const r = box(2.1, 0.08, 0.9, roofM, 0, 2.0, s * 0.35); r.rotation.x = s * 0.6; wl.add(r); }
  g.add(wl); col(54, 56, -24, -22, 2.2);
  // ---- стога сена ----
  const hay = LM({ color: 0x8a7440 });
  [[74, -38], [80, -40], [88, -37], [93, -41], [70, -42]].forEach(([x, z], i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), hay); s.scale.set(1, 1.15 - (i % 2) * 0.2, 1); s.position.set(x, 1.0, z); g.add(s); col(x - 1.4, x + 1.4, z - 1.4, z + 1.4, 2.6); });
  // ---- ржавая машина без колёс ----
  const car = new THREE.Group(); car.position.set(14, 0, -20.5); car.rotation.y = 0.35;
  car.add(box(3.8, 0.8, 1.7, rust, 0, 0.55, 0)); car.add(box(2.0, 0.6, 1.5, rust, -0.2, 1.25, 0));
  car.add(box(1.9, 0.5, 1.52, dark, -0.2, 1.25, 0)); for (const [wx, wz] of [[-1.3, 0.8], [1.3, 0.8], [-1.3, -0.8], [1.3, -0.8]]) car.add(box(0.5, 0.3, 0.2, dark, wx, 0.15, wz));
  g.add(car); col(11.8, 16.2, -21.8, -19.2, 1.6);
  // ---- водонапорная башня ----
  const wt = new THREE.Group(); wt.position.set(94, 0, -40);
  for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { const l = box(0.18, 9, 0.18, metal, lx, 4.5, lz); wt.add(l); }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.2, 14), rust); tank.position.y = 10.6; wt.add(tank);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 14), metal); cone.position.y = 12.8; wt.add(cone);
  g.add(wt); col(92.6, 95.4, -41.4, -38.6, 13);
  // ---- качели ----
  const sw = new THREE.Group(); sw.position.set(30, 0, -38);
  for (const sx of [-1.4, 1.4]) { const a = box(0.1, 2.6, 0.1, metal, sx, 1.25, -0.5); a.rotation.x = 0.2; sw.add(a); const b = box(0.1, 2.6, 0.1, metal, sx, 1.25, 0.5); b.rotation.x = -0.2; sw.add(b); }
  sw.add(box(3, 0.1, 0.1, metal, 0, 2.5, 0)); const seat = new THREE.Group(); seat.position.set(0, 2.5, 0); seat.add(box(0.02, 1.9, 0.02, metal, -0.3, -0.95, 0)); seat.add(box(0.02, 1.9, 0.02, metal, 0.3, -0.95, 0)); seat.add(box(0.7, 0.06, 0.3, woodD, 0, -1.9, 0)); sw.add(seat); G.swing = seat;
  g.add(sw); col(28.4, 31.6, -38.8, -37.2, 2.6);
  // ---- указатель ----
  const sg = new THREE.Group(); sg.position.set(-2, 0, -10.4); sg.add(box(0.1, 2.2, 0.1, woodD, 0, 1.1, 0));
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 64; const sx2 = sc.getContext('2d'); sx2.fillStyle = '#d8d0b0'; sx2.fillRect(0, 0, 256, 64); sx2.fillStyle = '#2a2018'; sx2.font = 'bold 34px Osw, Arial'; sx2.textAlign = 'center'; sx2.fillText('Глухово  2 км', 128, 44);
  const stx = new THREE.CanvasTexture(sc); stx.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshLambertMaterial({ map: stx, side: THREE.DoubleSide })); plate.position.set(0, 1.95, 0.06); sg.add(plate); g.add(sg);
  scene.add(g);
}
// карта лежит в инвентаре, а не в руке; открывается кнопкой 🗺
function drawMap() {
  const c = $('mapCanvas'), g = c.getContext('2d'), w = c.width, h = c.height;
  const X = (x) => (x - OUT.x0) / (OUT.x1 - OUT.x0) * w, Z = (z) => (z - OUT.z0) / (H * CS + 2 - OUT.z0) * h;
  g.fillStyle = '#d8c89c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(120,90,40,' + Math.random() * 0.12 + ')'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  g.fillStyle = 'rgba(40,40,40,0.55)'; g.fillRect(0, Z(-7.5), w, Z(-1.5) - Z(-7.5));
  g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; g.strokeRect(X(0), Z(0), X(W * CS) - X(0), Z(H * CS) - Z(0));
  if (!G.houseGone) { g.fillStyle = 'rgba(90,60,40,0.6)'; g.fillRect(X(4), Z(6), X(36) - X(4), Z(30) - Z(6)); }
  g.fillStyle = '#2a1a0a'; g.font = '600 14px Osw, Arial'; g.fillText(G.houseGone ? 'руины' : 'ДОМ', X(14), Z(19));
  g.fillStyle = '#2a5a2a'; for (const t of OUT_COLS.slice(0, 14).filter(t => !t.h)) { g.beginPath(); g.arc(X((t.x0 + t.x1) / 2), Z((t.z0 + t.z1) / 2), 4, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(80,55,35,0.75)'; for (const [hx, hz] of HAMLET_HOUSES) g.fillRect(X(hx - 3.5), Z(hz - 3), X(hx + 3.5) - X(hx - 3.5), Z(hz + 3) - Z(hz - 3));
  g.fillStyle = '#2a1a0a'; g.fillText('заброшенная деревня', X(30), Z(-36));
  g.fillStyle = '#3a3a3a'; g.fillRect(X(cc(9)) - 4, Z(0) - 4, 8, 8); g.fillText('ворота', X(cc(9)) + 6, Z(1));
  g.fillText('фургон', X(van.position.x) - 16, Z(van.position.z) - 6);
  g.strokeStyle = '#a02020'; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(X(cc(9)), Z(-1)); g.lineTo(X(cc(9)), Z(-4.5)); g.lineTo(X(BUNKER.x + 6), Z(-4.5)); g.lineTo(X(BUNKER.x), Z(BUNKER.z)); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#a02020'; g.font = 'bold 26px Georgia'; g.fillText('X', X(BUNKER.x) - 9, Z(BUNKER.z) + 9); g.font = '600 13px Osw, Arial'; g.fillText('бункер', X(BUNKER.x) + 12, Z(BUNKER.z) + 4);
  g.fillStyle = '#2050c0'; g.beginPath(); g.arc(X(P.pos.x), Z(P.pos.z), 6, 0, 7); g.fill(); g.fillText('ты', X(P.pos.x) - 6, Z(P.pos.z) + 20);
}
function openMap() { if (!P.inv || !P.inv.map) return; if (!$('pMap').classList.contains('hidden')) { $('pMap').classList.add('hidden'); return; } drawMap(); $('pMap').classList.remove('hidden'); sfx.paper(); }

let bunkerMesh = null;
function buildBunker() {
  if (bunkerMesh) return;
  const g = new THREE.Group(); g.position.set(BUNKER.x, 0, BUNKER.z); g.rotation.y = Math.PI;   // вход смотрит на дорогу
  const conc = LM({ map: T.stone, color: 0x8a8a84 }), dark = LM({ color: 0x0a0a0a }), sand = LM({ map: T.fabric ? T.fabric('#8a7a5a', 121) : null, color: 0x9a8a6a }), metal = LM({ map: T.metal });
  g.add(box(3.4, 1.1, 3.0, conc, 0, 0.55, 0.2));
  const roof = box(3.6, 0.25, 3.3, conc, 0, 1.2, 0.2); roof.rotation.x = 0.06; g.add(roof);
  g.add(box(1.1, 0.95, 0.06, dark, 0, 0.5, -1.33));   // вход
  for (let i = 0; i < 3; i++) g.add(box(1.0, 0.08, 0.3, conc, 0, 0.12 + i * 0.12, -1.55 + i * 0.12));
  g.add(box(0.06, 2.4, 0.06, metal, 1.3, 2.4, 0.9)); g.add(box(0.5, 0.04, 0.04, metal, 1.3, 3.4, 0.9));
  for (let i = 0; i < 9; i++) { const sb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), sand); sb.scale.set(1.4, 0.55, 0.8); sb.position.set(-1.6 + (i % 5) * 0.8, 0.18 + Math.floor(i / 5) * 0.32, -1.75 - (i % 2) * 0.05); g.add(sb); }
  const lampM = new THREE.MeshBasicMaterial({ color: 0xff3020 }); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lampM); lamp.position.set(0, 1.12, -1.36); g.add(lamp);
  scene.add(g); bunkerMesh = g;
  OUT_COLS.push({ x0: BUNKER.x - 1.8, x1: BUNKER.x + 1.8, z0: BUNKER.z - 1.8, z1: BUNKER.z + 1.4 });
}
function enterBunker() {
  P.inBunker = true; P.ui = true; P.emote = null; stopEmote();
  $('bunker').classList.remove('hidden'); sfx.hatch(null);
  if (Net.role === 'client') Net.send({ t: 'r', a: 'bunker', on: true }, true);
  refreshBunker();
}
function refreshBunker() {
  const ready = !G.houseGone && !PILOT.cool && G.bunkerShahed;
  $('bkStatus').textContent = G.houseGone ? 'Дом уничтожен. Фургон ждёт на дороге — уезжай!' : !G.bunkerShahed ? 'Пусковая пустая. Нужен шахед — его роняет Тру Адам, если победить его в аура-батле. Принеси шахед сюда.' : ready ? 'На пусковой — шахед Тру Адама. Цель: дом. Управлять будешь с камеры (ночное зрение).' : 'Перезарядка пусковой…';
  $('bkLaunch').disabled = !ready;
}
function leaveBunker() {
  P.inBunker = false; P.ui = false; $('bunker').classList.add('hidden');
  P.pos.set(BUNKER.x, 0, BUNKER.z + 2.4); P.f = 1;
  if (Net.role === 'client') Net.send({ t: 'r', a: 'bunker', on: false }, true);
}
// управление шахедом: летит сам, джойстик — быстрее/медленнее и поворот, обзор — куда лететь. «БАХ!» — взорвать
const PILOT = { on: false, pos: V(), t: 0, yaw0: 0, pitch0: 0, mesh: null };
function launchPilot() {
  if (G.houseGone || PILOT.cool || !G.bunkerShahed) return;
  G.bunkerShahed = false;   // шахед улетел; промахнёшься — нужен новый от Адама
  if (Net.role === 'client') Net.send({ t: 'r', a: 'plaunch' }, true);
  $('bunker').classList.add('hidden'); P.ui = false;
  PILOT.on = true; PILOT.t = 0; PILOT.pos.set(BUNKER.x, 2.2, BUNKER.z + 1.8); PILOT.yaw0 = P.yaw; PILOT.pitch0 = P.pitch;
  P.yaw = Math.atan2(-(20 - BUNKER.x), -(18 - BUNKER.z)); P.pitch = 0.12;   // носом на дом
  document.body.classList.add('piloting');
  sfx.carStart(PILOT.pos);
  toast('Ты управляешь шахедом! Обзор — куда лететь, джойстик — скорость. Лети к дому и врежься в него!', 5);
}
function pilotBlocked(p) {
  if (p.y > 13 || p.y < 0.25) return true;
  if (p.z < 0) return p.x < OUT.x0 || p.x > OUT.x1 || p.z < OUT.z0 || OUT_COLS.some(c => c.h && p.x > c.x0 && p.x < c.x1 && p.z > c.z0 && p.z < c.z1 && p.y < c.h);
  if (p.x < 1 || p.x > W * CS - 1 || p.z > H * CS - 1) return p.x < OUT.x0 || p.x > OUT.x1 || p.z > H * CS + 20;   // лес вокруг двора
  const cx = Math.floor(p.x / CS), cz = Math.floor(p.z / CS);
  if (p.y > 10.2) return false;   // над крышей дома — свободно
  if (!insideHouse(cx, cz)) {
    if (p.y < 0.25) return true;
    if (p.y > 3.4) return false;   // высоко над двором — свободно
    const ch = cell(1, cx, cz); if (ch === null) return true;
    if (ch === 'Y') return p.y < 4.5;
    if (ch === 'f') return p.y < 1.3;
    if (ch === 'G') return !G.esc.gateOpen && p.y < 2.4;
    return '#qW'.includes(ch);
  }
  const f = floorAtY(p.y), ch = cell(f, cx, cz);
  if (!ch || ch === ' ') return true;
  if (p.y < heightAt(f, p.x, p.z) + 0.25) return true;
  return !allowDrone(f, cx, cz, ch);
}
function updatePilot(dt) {
  if (!PILOT.on) return;
  PILOT.t += dt;
  const sp = 7.5 + (-joy.y - (keys.KeyW ? 1 : 0) * -1 + (keys.KeyS ? -1 : 0)) * 3.5;
  P.yaw -= joy.x * dt * 1.6;
  const cp = Math.cos(P.pitch), dir = V(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp);
  PILOT.pos.addScaledVector(dir, Math.max(3, sp) * dt);
  camera.position.copy(PILOT.pos); camera.rotation.set(P.pitch, P.yaw, Math.sin(PILOT.t * 3) * 0.04, 'YXZ');
  const hitE = [hostess, watchman, yard, adam, thing].some(e => e && e.mesh.visible && e.state !== 'off' && e.pos.distanceTo(PILOT.pos) < 1.6 + (e.pos.y < PILOT.pos.y - 2 ? -9 : 0));
  if (pilotBlocked(PILOT.pos) || hitE || PILOT.t > 40) pilotBoom();
  PILOT.humT = (PILOT.humT || 0) - dt; if (PILOT.humT <= 0) { PILOT.humT = 0.2; sfx.carHum(PILOT.pos, 12); }
  $('pilotHud').textContent = 'ШАХЕД · ' + Math.max(0, 40 - PILOT.t).toFixed(0) + ' с · высота ' + PILOT.pos.y.toFixed(1) + ' м';
}
function pilotBoom() {
  if (!PILOT.on) return;
  PILOT.on = false; document.body.classList.remove('piloting');
  const p = PILOT.pos.clone(); const [pcx, pcz] = cellOf(p); const f = insideHouse(pcx, pcz) ? floorAtY(Math.max(-3, p.y - 0.5)) : 1;
  const atHouse = !G.houseGone && p.x > 3.4 && p.x < 36.6 && p.z > 5.4 && p.z < 30.6;
  PILOT.cool = true; setTimeout(() => { PILOT.cool = false; }, 4000);
  if (Net.role === 'client') Net.send({ t: 'r', a: 'pboom', p: pv(p), f, house: atHouse }, true); else if (atHouse) houseBoom(p); else { explodeAt(p, f, P, { shahed: true }); shahedMissed(); }
  P.yaw = PILOT.yaw0; P.pitch = PILOT.pitch0;
  setTimeout(() => { if (P.inBunker && G.mode === 'play') { $('bunker').classList.remove('hidden'); P.ui = true; refreshBunker(); } }, 1600);
}
// лазерная сигнализация на воротах: подошёл слишком близко — воет сирена, и все враги бегут к воротам
function updateGateLasers(dt) {
  G.laserCD = Math.max(0, (G.laserCD || 0) - dt);
  if (!gateM || !gateM.userData.lasers.visible || G.esc.gateOpen || G.laserCD > 0) return;
  for (const pl of standing()) {
    if (pl.f !== 1 || pl.hidden) continue;
    if (Math.abs(pl.pos.x - cc(9)) < 1.3 && pl.pos.z < 2.55) {
      G.laserCD = 8; const p = V(cc(9), 1.2, 1.4);
      fx.alarm(p); noise(1, p, 60, pl);
      alltoast('Лазерная сигнализация! Все слышали. Нужен пульт от лазеров', 3.5);
      break;
    }
  }
}
function shahedMissed() {   // промах: нужен новый шахед — Тру Адам вернётся за реваншем
  AD.beaten = false; G.adamT = Math.min(G.adamT || 60, 45);
  setTimeout(() => alltoast('Шахед не попал в дом! Нужен новый — Тру Адам скоро придёт за реваншем', 4.5), 1200);
}
function updatePilotMesh(dt) {
  if (!PILOT.mesh) { PILOT.mesh = makeDrone(T); PILOT.mesh.scale.setScalar(0.45); scene.add(PILOT.mesh); }
  const m = PILOT.mesh;
  if (PILOT.on) { m.visible = false; G.pilotOther = null; return; }   // своим глазам корпус не мешает
  const o = G.pilotOther;
  m.visible = !!o && G.mode === 'play';
  if (o) { m.position.lerp(V(o[0], o[1], o[2]), Math.min(1, dt * 10)); m.rotation.set(0, o[3], 0); m.userData.rotor.rotation.z += dt * 60; }
}

// ================= ДОМ ВЗРЫВАЕТСЯ (шахед из бункера) =================
function houseBoom(hit) {
  if (G.houseGone || G.houseBooming) return;
  G.houseBooming = true;
  if (Net.role === 'host') Net.send({ t: 'housegone', p: pv(hit) }, true);
  houseBoomFx(hit);
  setTimeout(() => { destroyHouse(); G.houseBooming = false; }, 1400);
}
function houseBoomFx(hit) {
  explodeAt(hit, 1, null, { shahed: true });
  for (let i = 0; i < 9; i++) setTimeout(() => { const p = V(rand(6, 34), rand(1, 8), rand(8, 28)); spawnBoom(p); sfx.boom(p); shakeFrom(p); }, 150 + i * 140);
  alltoast('ШАХЕД ПОПАЛ! ДОМ ВЗРЫВАЕТСЯ!', 3);
}
function destroyHouse() {
  if (G.houseGone) return;
  G.houseGone = true;
  if (!G.practice) try { localStorage.setItem('hushwood.boom', '1'); } catch (e) { }   // для главы 2: газета о взрыве
  setHouseGone(true);
  // кто остался в доме — взрывом выкидывает за ворота на дорогу
  if (Net.role !== 'client') { let k = 0; for (const pl of players()) { if (pl.inBunker || pl.dead || pl.sacked) continue; const inH = pl.f !== 1 || (pl.pos.x > 3.4 && pl.pos.x < 36.6 && pl.pos.z > 5.4 && pl.pos.z < 30.6); if (inH) { teleportPlayer(pl, 1, cc(9) - 2 + (k++ % 4) * 1.2, -2.6); } } }
  // дом исчезает: на его месте пепелище
  for (let z = 3; z <= 14; z++) for (let x = 2; x <= 17; x++) { maps[1][z][x] = 'g'; maps[2][z][x] = ' '; maps[3][z][x] = ' '; }
  rebuildWorld();
  furn.root.visible = false;
  for (const d of G.doors.values()) d.piv.visible = false;
  G.dyn.traverse(o => { if (o.isMesh && o.position && o.parent === G.dyn && o.position.x > 3 && o.position.x < 37 && o.position.z > 5 && o.position.z < 31 && o.position.y > 0.5) o.visible = false; });
  for (const l of LAMPS) if (l.pos.x > 3 && l.pos.x < 37 && l.pos.z > 5 && l.pos.z < 31) { l.on = false; (l.meshes || []).forEach(m => m.visible = false); }
  for (const e of [hostess, watchman, thing]) { e.state = 'off'; e.mesh.visible = false; e.pos.set(-60, -60, -60); }
  doll.off = true; doll.mesh.visible = false; if (G.dollRail) G.dollRail.visible = false;
  for (const o of G.objects) if (!o.broken && o.f !== 1 || (o.pos.x > 3 && o.pos.x < 37 && o.pos.z > 5 && o.pos.z < 31)) { if (o.mesh) o.mesh.visible = false; o.broken = true; }
  // завалы и огонь
  const brick = LM({ map: T.brick }), wood = LM({ map: T.wood, color: 0x3a2a1a }), char = LM({ color: 0x1a1410 });
  const g = new THREE.Group();
  for (let i = 0; i < 70; i++) {
    const m = [brick, wood, char][i % 3]; const b = box(rand(0.4, 2.2), rand(0.2, 0.9), rand(0.3, 1.4), m, rand(5, 35), rand(0, 1.2), rand(7, 29));
    b.rotation.set(rand(-0.6, 0.6), rand(0, 6), rand(-0.6, 0.6)); g.add(b);
  }
  scene.add(g); G.ruins = g;
  if (!BOOM) spawnBoom(V(0, -50, 0));
  G.fires = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: BOOM.fireT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(rand(6, 34), rand(0.6, 1.6), rand(8, 28)); s.scale.setScalar(rand(1.5, 3)); g.add(s); G.fires.push({ s, b: s.scale.x, ph: Math.random() * 6 });
  }
  toast('Дом взорван! Иди к фургону на дороге и уезжай', 5);
  if (P.inBunker) refreshBunker();
}
function updateFires(dt) {
  if (!G.fires) return;
  const t = now() + mt;
  for (const f of G.fires) { const k = 0.8 + Math.sin(t * 9 + f.ph) * 0.15 + Math.random() * 0.1; f.s.scale.set(f.b * k, f.b * k * 1.3, 1); f.s.material.opacity = 0.75 + Math.sin(t * 13 + f.ph) * 0.2; }
  G.smokeT = (G.smokeT || 0) - dt; if (G.smokeT <= 0) { G.smokeT = 0.35; puffSmoke(V(rand(8, 32), 2, rand(9, 27))); }
}

// ================= ДРОН: отдельная локация-коридор =================
const AR = { x0: 400, x1: 470, z: 0 };
const AR_COLS = [];
function buildArena() {
  const g = new THREE.Group();
  const wallM = LM({ map: T.wall1 }), ceilM = LM({ map: T.ceil });
  const len = AR.x1 - AR.x0, cx = (AR.x0 + AR.x1) / 2;
  // своя копия материала: общий (из кэша) трогать нельзя — иначе доски в доме становятся мелкой рябью
  const flMap = T.planks.clone(); flMap.repeat.set(len / 2, 2); flMap.needsUpdate = true;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(len, 4.1), new THREE.MeshLambertMaterial({ map: flMap })); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0, AR.z); g.add(fl);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(len, 4.1), ceilM); ce.rotation.x = Math.PI / 2; ce.position.set(cx, 3, AR.z); g.add(ce);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(len, 3), wallM.clone()); w.material.map = w.material.map.clone(); w.material.map.repeat.set(len / 2, 1.5); w.material.map.needsUpdate = true;
    w.position.set(cx, 1.5, AR.z + 2.05 * s); w.rotation.y = s > 0 ? Math.PI : 0; g.add(w);
  }
  for (const x of [AR.x0, AR.x1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 3), wallM); w.position.set(x, 1.5, AR.z); w.rotation.y = x === AR.x0 ? Math.PI / 2 : -Math.PI / 2; g.add(w); }
  scene.add(g);
  // шкафы вдоль коридора, по очереди у разных стен
  const wood = LM({ map: T.wood }), woodD = LM({ map: T.wood, color: 0x5a4030 });
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? -1 : 1, cellX = (AR.x0 >> 1) + 3 + k * 4, cellZ = side > 0 ? 0 : -1;
    const wx = (cellX + 0.5) * CS, wz = (cellZ + 0.5) * CS + side * 0.35;
    const grp = new THREE.Group(); grp.position.set(wx, 0, wz); grp.rotation.y = side > 0 ? Math.PI : 0;
    const h2 = 2.3;
    grp.add(box(1.5, h2, 0.04, wood, 0, h2 / 2, -0.98)); grp.add(box(0.04, h2, 0.8, wood, -0.73, h2 / 2, -0.6)); grp.add(box(0.04, h2, 0.8, wood, 0.73, h2 / 2, -0.6));
    grp.add(box(1.62, 0.1, 0.9, woodD, 0, h2 + 0.07, -0.58)); grp.add(box(1.55, 0.1, 0.85, woodD, 0, 0.05, -0.58));
    const doors = [];
    for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(0.74 * s, h2 / 2, -0.2); grp.add(piv); const leaf = box(0.7, h2 - 0.1, 0.04, wood); leaf.position.x = -0.355 * s; piv.add(leaf); piv.userData.s = s; doors.push(piv); }
    scene.add(grp);
    const zA = side > 0 ? wz + 0.18 : wz - 1.0, zB = side > 0 ? wz + 1.0 : wz - 0.18;
    AR_COLS.push({ x0: wx - 0.8, x1: wx + 0.8, z0: Math.min(zA, zB), z1: Math.max(zA, zB) });
    furn.hides.push({ f: 1, x: cellX, z: cellZ, type: 'wardrobe', face: [0, -side], pos: V(wx, 0, wz), group: grp, doors, h2, arena: true });
    // лампа над каждым шкафом
    const lamp = { f: 1, x: cellX, z: cellZ, col: 0xffc080, i: 5, d: 9, flick: k % 3 === 0, noOff: true };
    lamp.pos = V(wx, 2.7, AR.z); const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd890 })); b.position.copy(lamp.pos); scene.add(b);
    lamp.bulb = b; lamp.onMat = b.material; lamp.offMat = b.material; lamp.on = true; LAMPS.push(lamp);
  }
  // выход — зелёный круг в конце коридора
  const ex = new THREE.Group(); ex.position.set(AR.x1 - 2, 0, AR.z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0x40ff60, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ex.add(ring);
  const door = box(1.4, 2.4, 0.1, new THREE.MeshBasicMaterial({ color: 0x103018 })); door.position.set(1.9, 1.2, 0); door.rotation.y = Math.PI / 2; ex.add(door);
  scene.add(ex); G.arenaExit = ex;
}
function arenaMove(dt) {
  // дрон в коридоре: летит прямо на ближайшего бегущего
  let tp = null, bd = 1e9;
  for (const pl of standing()) if (!pl.safe && targetable(pl) && zoneAt(pl.pos.x, pl.pos.z) === 'arena') { const d = DR.pos.distanceTo(headOf(pl)); if (d < bd) { bd = d; tp = pl; } }
  const goal = tp ? headOf(tp) : V(DR.pos.x + Math.sin(DR.t) * 1.5, 2, AR.z + Math.cos(DR.t * 1.3) * 1.2);
  const want = goal.sub(DR.pos); const dist = want.length();
  want.normalize().multiplyScalar(D.droneSp * Math.min(1, 0.3 + dist / 1.5));
  DR.vel.lerp(want, Math.min(1, dt * 3.2));
  DR.pos.addScaledVector(DR.vel, dt);
  DR.pos.x = Math.max(AR.x0 + 0.5, Math.min(AR.x1 - 0.5, DR.pos.x)); DR.pos.z = Math.max(AR.z - 1.6, Math.min(AR.z + 1.6, DR.pos.z)); DR.pos.y = Math.max(0.8, Math.min(2.6, DR.pos.y));
  if (tp && DR.pos.distanceTo(headOf(tp)) < 0.9) droneHit(tp);
}

// ================= АУРА-КЛУБ: ритм-баттл с Тру Адамом =================
// Тебя переносит в неоновый клуб за картой. Адам поёт фразу — ты повторяешь: жми стрелки, когда они доходят до рамок.
// Попадания поднимают ауру, промахи — роняют. Аура кончилась — тебя могнули. Дотянул до конца с аурой от 50 — ты победил.
const CLUB = { x: -400, z: 0 };
let clubAdam = null, clubGroup = null, clubBall = null, clubFloorTex = null, clubCrowd = [];
const LANE_COL = ['#ffb020', '#20d0c0', '#a0e040', '#ff4fa0'];
function micProp() {
  const g = new THREE.Group();
  g.add(box(0.035, 0.18, 0.035, LM({ color: 0x1a1a1a }), 0, -0.02, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), LM({ color: 0x9a9a9a, emissive: 0x202020 })); head.position.y = 0.09; g.add(head);
  return g;
}
function buildClub() {
  const g = new THREE.Group(); g.position.set(CLUB.x, 0, CLUB.z);
  // танцпол из светящихся плиток
  const fc = document.createElement('canvas'); fc.width = fc.height = 256; const fg = fc.getContext('2d');
  const cols = ['#3a0a4a', '#0a2a4a', '#4a0a2a', '#0a3a3a', '#2a0a5a', '#4a2a0a'];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { fg.fillStyle = cols[(x * 3 + y * 5) % cols.length]; fg.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
  clubFloorTex = new THREE.CanvasTexture(fc); clubFloorTex.wrapS = clubFloorTex.wrapT = THREE.RepeatWrapping; clubFloorTex.repeat.set(3, 2); clubFloorTex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshBasicMaterial({ map: clubFloorTex })); floor.rotation.x = -Math.PI / 2; g.add(floor);
  const wallM = LM({ color: 0x140a1e });
  const back = box(20, 7, 0.2, wallM, 0, 3.5, -5); g.add(back);
  for (const s of [-1, 1]) g.add(box(0.2, 7, 14, wallM, 10 * s, 3.5, 2));
  g.add(box(20, 0.2, 14, LM({ color: 0x0a0610 }), 0, 7, 2));
  // сцена
  g.add(box(9, 0.4, 3.2, LM({ color: 0x1a1020 }), 0, 0.2, -1.2));
  g.add(box(9.1, 0.06, 0.06, new THREE.MeshBasicMaterial({ color: 0xff40c0 }), 0, 0.42, 0.42));
  // неоновая вывеска
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128; const sg = sc.getContext('2d');
  sg.fillStyle = 'rgba(0,0,0,0)'; sg.clearRect(0, 0, 512, 128); sg.font = 'bold 84px Osw, Arial'; sg.textAlign = 'center';
  sg.shadowColor = '#ff40c0'; sg.shadowBlur = 24; sg.fillStyle = '#ffd0f0'; sg.fillText('АУРА-КЛУБ', 256, 96);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: st, transparent: true })); sign.position.set(0, 4.8, -4.85); g.add(sign);
  // неоновые трубки
  const tubeCols = [0x20f0ff, 0xff30a0, 0xa040ff, 0xffd040];
  for (let i = 0; i < 6; i++) { const t = box(0.08, 3.6, 0.08, new THREE.MeshBasicMaterial({ color: tubeCols[i % 4] }), -8 + i * 3.2, 2.8, -4.85); t.rotation.z = (i % 2 ? 0.35 : -0.35); g.add(t); }
  // колонки
  for (const s of [-1, 1]) { g.add(box(1.3, 2.4, 1.0, LM({ color: 0x101010 }), 5.6 * s, 1.6, -1.8)); for (const y of [0.9, 1.9]) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 16), LM({ color: 0x2a2a2a })); sp.rotation.x = Math.PI / 2; sp.position.set(5.6 * s, y + 0.4, -1.28); g.add(sp); } }
  // зеркальный шар
  const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bg = bc.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 120 + Math.random() * 135; bg.fillStyle = `rgb(${v},${v},${v + 20})`; bg.fillRect(x * 8, y * 8, 7, 7); }
  clubBall = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) })); clubBall.position.set(0, 6.2, 0); g.add(clubBall);
  // толпа — тёмные силуэты
  const crowdM = LM({ color: 0x0a0a12, emissive: 0x06020a });
  for (let i = 0; i < 16; i++) { const c = new THREE.Group(); const side = i % 2 ? 1 : -1; c.position.set(side * (4.2 + (i >> 1) % 4 * 1.2), 0, 0.8 + ((i >> 3) * 1.1) + (i % 3) * 0.3); c.add(box(0.5, 1.1, 0.3, crowdM, 0, 0.8, 0)); const h = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), crowdM); h.position.y = 1.55; c.add(h); g.add(c); clubCrowd.push(c); }
  scene.add(g); clubGroup = g;
  // Адам на сцене (своя копия)
  clubAdam = makeAdam(T); clubAdam.position.set(CLUB.x + 2.4, 0.4, CLUB.z - 1.0); clubAdam.rotation.y = -0.35; scene.add(clubAdam);
  clubAdam.userData.arms[1].end.add(micProp());
  // цветной свет клуба — через общий пул ламп
  [[-4, 0xff30a0], [4, 0x20f0ff], [0, 0xa040ff]].forEach(([x, col], i) => {
    const l = { f: 1, x: 0, z: 0, col, i: 14, d: 16, flick: false, noOff: true, club: true, pos: V(CLUB.x + x, 4.5, CLUB.z + 1) };
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: col })); b.position.copy(l.pos); scene.add(b);
    l.bulb = b; l.onMat = b.material; l.offMat = b.material; l.on = true; LAMPS.push(l);
  });
}
const BT = { on: false, notes: [], len: 0, aura: 50, combo: 0, pose: [-1, -1], poseT: [0, 0], rating: '', ratingT: 0, press: [0, 0, 0, 0], ft: 0, bpm: 130, ph: 0.069, back: null, song: false };
// карта нот снята с присланной песни: [шестнадцатая, сила удара 0..99, стрелка] — темп 130, первая доля на 0.069 с
const ADAM_CHART = [0,99,3,8,44,3,16,66,0,18,37,0,20,20,0,22,28,2,24,39,3,28,27,0,32,32,1,34,17,2,36,38,3,39,35,0,41,25,0,42,64,3,48,45,0,52,34,1,56,22,1,58,52,3,64,99,0,66,26,0,67,27,3,70,69,0,72,26,3,74,99,0,76,17,0,80,85,2,83,36,1,86,63,0,88,52,3,90,85,3,92,20,0,96,44,1,98,27,0,99,26,3,102,63,0,104,27,3,106,99,0,108,19,0,112,84,2,115,36,1,118,65,0,120,53,3,122,89,3,128,70,0,131,33,0,134,59,0,136,35,3,138,51,3,140,40,2,144,98,0,146,18,3,147,28,1,150,65,0,152,43,3,154,26,0,156,22,0,160,71,1,163,34,3,166,59,0,168,32,3,170,72,0,172,41,0,176,59,1,178,19,3,179,28,1,182,66,0,184,43,3,186,87,0,188,26,0,192,92,1,194,28,3,198,27,0,200,62,3,204,19,2,208,88,0,210,37,3,212,18,0,214,32,2,216,49,2,220,26,1,224,43,1,226,18,3,228,43,0,231,31,0,233,22,0,234,70,3,240,39,0,244,36,2,248,23,1,250,53,2,256,92,2,258,19,3,259,26,0,262,65,0,264,27,3,266,96,3,268,18,0,272,93,2,275,35,1,278,66,0,280,54,0,282,91,3,288,92,2,290,21,3,291,26,0,294,68,0,296,26,3,298,97,3,304,94,2,307,36,1,310,63,0,312,31,0,314,92,3,318,37,0,320,57,3,323,31,0,326,58,0,328,36,3,330,51,3,332,35,2,336,99,0,338,19,3,339,27,1,342,66,0,344,43,3,346,25,0,348,21,0,352,70,2,355,34,3,358,60,0,360,35,3,362,64,0,364,39,0,368,55,1,370,20,3,371,29,1,374,66,0,376,43,3,378,90,0,380,19,0,384,99,3,388,32,0,390,31,0,392,48,3,394,21,2,396,46,0,398,49,2,400,52,0,402,31,2,403,17,3,406,49,0,414,52,0,418,34,3,419,22,0,424,31,1,426,49,3,428,64,1,432,51,1,434,21,2,435,26,1,436,45,0,438,42,2,440,32,3,444,59,0,448,21,1,451,31,0,454,44,2,456,37,2,458,24,3,464,24,1,467,30,3,470,43,0,472,36,2,474,21,1,476,18,1,480,49,2,483,33,3,486,42,2,488,38,2,490,24,3,496,23,1,499,30,0,502,42,3,504,37,2,506,22,1,510,54,2,512,45,3,515,32,0,518,42,2,520,38,3,522,24,3,528,22,1,531,31,0,534,42,3,536,37,2,538,21,2,542,25,3,544,52,1,547,32,0,550,43,2,552,38,3,554,23,3,560,24,1,563,32,0,566,45,3,568,36,2,570,24,3,572,18,2,574,20,1,576,27,0];
const SEC_BEATS = 8, N_SEC = 18;   // куплеты по 2 такта: Адам, ты, Адам, ты…
const secLen = () => SEC_BEATS * 60 / BT.bpm;
function secAt(t) { return Math.floor((t - BT.ph) / secLen()); }
function genChart() {
  const s16 = 60 / BT.bpm / 4, di = Math.max(0, DIFF_ORDER.indexOf(diffKey));
  const cap = [6, 9, 12, 32][di], gapMin = [4, 2, 2, 1][di], grid = [2, 2, 1, 1][di];
  const notes = [];
  for (let sec = 0; sec < N_SEC; sec++) {
    const who = sec % 2 === 0 ? 'adam' : 'you';
    const c = [];
    for (let i = 0; i < ADAM_CHART.length; i += 3) { const k = ADAM_CHART[i]; if (k >= sec * 32 && k < sec * 32 + 32 && k % grid === 0) c.push([k, ADAM_CHART[i + 1], ADAM_CHART[i + 2]]); }
    // самые сильные удары, но не чаще, чем позволяет сложность
    c.sort((x, y) => y[1] - x[1]);
    const pick = [];
    for (const n of c) { if (pick.length >= cap) break; if (pick.every(p => Math.abs(p[0] - n[0]) >= gapMin)) pick.push(n); }
    pick.sort((x, y) => x[0] - y[0]);
    for (const [k, , lane] of pick) notes.push({ t: BT.ph + k * s16, lane, who, hit: false, miss: false });
  }
  BT.len = BT.ph + N_SEC * secLen() + 0.8;
  return notes;
}
function startAura() {
  if (BT.on) return;
  BT.on = true; BT.aura = 50; BT.combo = 0; BT.rating = ''; BT.ratingT = 0; BT.ft = -0.6; BT.notes = genChart();
  BT.back = { f: P.f, p: P.pos.clone(), yaw: P.yaw, pitch: P.pitch };
  P.ui = true; P.emote = null; stopEmote(); if (P.hidden) { P.hidden = null; P.hideAnim = null; document.body.classList.remove('hiding'); }
  P.pos.set(CLUB.x - 2.4, 0, CLUB.z + 0.5); P.f = 1;
  if (!P.selfAv) { P.selfAv = makeKid(T, P.color, 'Ты'); scene.add(P.selfAv); P.selfAv.userData.tag.visible = false; P.selfAv.userData.help.visible = false; P.selfAv.userData.beam.visible = false; }
  if (!P.selfAv.userData.mic) { P.selfAv.userData.mic = micProp(); P.selfAv.userData.arms[1].end.add(P.selfAv.userData.mic); }
  P.selfAv.visible = true; P.selfAv.position.set(CLUB.x - 2.4, 0.4, CLUB.z - 1.0); P.selfAv.rotation.y = 0.35;
  stopTracks(); setMusic('off');
  BT.song = trackReady('adam') && playTrack('adam', true, 0, false);
  if (BT.song) trackVol('adam', null, 1, 34, 1.0); else startPhonk(BT.bpm);
  document.body.classList.add('club'); $('clubUI').classList.remove('hidden');
  $('flash').style.opacity = 0.8; setTimeout(() => $('flash').style.opacity = 0, 200);
  sfx.sparkle(null);
}
function songTime() { if (BT.song) { const t = trackTime('adam'); if (t !== -1) return t; } const t = phonkTime(); return t > -0.9 && t !== -1 ? t : BT.ft; }
function clubPress(lane) {
  if (!BT.on) return;
  BT.press[lane] = 0.12; const hb = document.querySelector('#clubBtns [data-l="' + lane + '"]'); if (hb) { hb.classList.add('on'); clearTimeout(hb._t); hb._t = setTimeout(() => hb.classList.remove('on'), 110); }
  const t = songTime();
  let best = null, bd = 1;
  for (const n of BT.notes) if (n.who === 'you' && !n.hit && !n.miss && n.lane === lane) { const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = n; } }
  if (best && bd < 0.15) {
    best.hit = true; BT.combo++;
    const q = bd < 0.055 ? 0 : bd < 0.1 ? 1 : 2;
    BT.aura = Math.min(100, BT.aura + [2.6, 1.8, 1.0][q]);
    BT.rating = ['МОГ!', 'СИГМА', 'норм'][q]; BT.ratingT = 0.6;
    BT.pose[0] = lane; BT.poseT[0] = 0.3; if (!BT.song) sfx.sing(lane, false);
  }
}
function updateClub(dt) {
  if (!BT.on) return;
  BT.ft += dt;
  const t = songTime();
  for (const n of BT.notes) {
    if (n.hit || n.miss) continue;
    if (n.who === 'adam' && t >= n.t) { n.hit = true; BT.pose[1] = n.lane; BT.poseT[1] = 0.3; if (!BT.song) sfx.sing(n.lane, true); BT.aura = Math.max(1, BT.aura - 0.35); }
    else if (n.who === 'you' && t > n.t + 0.15) { n.miss = true; BT.combo = 0; BT.aura -= 6; BT.rating = 'ПРОМАХ'; BT.ratingT = 0.6; sfx.miss(); }
  }
  for (let i = 0; i < 4; i++) BT.press[i] = Math.max(0, BT.press[i] - dt);
  BT.poseT[0] -= dt; BT.poseT[1] -= dt; BT.ratingT -= dt;
  drawClub(t);
  if (BT.aura <= 0) { endClub(false); return; }
  if (t > BT.len) endClub(BT.aura >= 50);
}
function arrow(g, x, y, lane, size, fill, col) {
  g.save(); g.translate(x, y); g.rotate([-Math.PI / 2, Math.PI, 0, Math.PI / 2][lane]);
  g.beginPath(); g.moveTo(0, -size); g.lineTo(size * 0.85, size * 0.15); g.lineTo(size * 0.35, size * 0.15); g.lineTo(size * 0.35, size * 0.85); g.lineTo(-size * 0.35, size * 0.85); g.lineTo(-size * 0.35, size * 0.15); g.lineTo(-size * 0.85, size * 0.15); g.closePath();
  if (fill) { g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.stroke(); } else { g.strokeStyle = col; g.lineWidth = 4; g.stroke(); }
  g.restore();
}
function drawClub(t) {
  const c = $('clubCanvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W2 = c.clientWidth, H2 = c.clientHeight;
  if (c.width !== Math.round(W2 * dpr)) { c.width = Math.round(W2 * dpr); c.height = Math.round(H2 * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W2, H2);
  // твои стрелки: большие, цветные, падают сверху прямо на большие кнопки внизу
  const btns = [...document.querySelectorAll('#clubBtns button')];
  const cr = c.getBoundingClientRect();
  const col = btns.map(b => { const r = b.getBoundingClientRect(); return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2, s: r.width }; });
  if (!col.length || !col[0].s) return;
  const big = col[0].s * 0.36, ry = col[0].y, speed = H2 * 0.85;
  for (let l = 0; l < 4; l++) arrow(g, col[l].x, ry, l, big, false, BT.press[l] > 0 ? '#fff' : 'rgba(255,255,255,0.8)');
  for (const n of BT.notes) {
    if (n.who !== 'you' || n.hit) continue;
    const y = ry - (n.t - t) * speed; if (y > H2 + big || y < -big) continue;
    g.globalAlpha = n.miss ? 0.25 : 1;
    g.shadowColor = LANE_COL[n.lane]; g.shadowBlur = 14;
    arrow(g, col[n.lane].x, y, n.lane, big, true, LANE_COL[n.lane]);
    g.shadowBlur = 0; g.globalAlpha = 1;
  }
  // стрелки Тру Адама — маленькие, сверху слева, просто показывают, что он поёт
  const ms = Math.min(13, H2 * 0.026), mg = ms * 2.5, mx0 = 18 + ms, my = 62;
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(mx0 - ms * 1.8, my - ms * 1.8, mg * 3 + ms * 3.6, ms * 3.6 + 70);
  g.font = '600 12px Osw, Arial'; g.fillStyle = '#d8b040'; g.textAlign = 'left'; g.fillText('ТРУ АДАМ', mx0 - ms, my - ms * 1.9 + 2);
  for (let l = 0; l < 4; l++) { const lit = BT.pose[1] === l && BT.poseT[1] > 0.12; arrow(g, mx0 + l * mg, my, l, ms * (lit ? 1.2 : 1), lit, lit ? LANE_COL[l] : 'rgba(255,255,255,0.5)'); }
  for (const n of BT.notes) {
    if (n.who !== 'adam' || n.hit) continue;
    const y = my + (n.t - t) * speed * 0.35; if (y > my + 70 || y < my) continue;
    arrow(g, mx0 + n.lane * mg, y, n.lane, ms, true, LANE_COL[n.lane]);
  }
  // полоса ауры сверху по центру
  const bw = W2 * 0.4, bx = (W2 - bw) / 2, by = 40;
  g.fillStyle = '#d8b040'; g.fillRect(bx, by, bw, 14); g.fillStyle = '#9fe8ff'; const k = Math.max(0, BT.aura) / 100; g.fillRect(bx + bw * (1 - k), by, bw * k, 14);
  g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(bx, by, bw, 14);
  g.fillStyle = '#fff'; g.font = '600 15px Osw, Arial'; g.textAlign = 'right'; g.fillText('ТЫ · аура ' + Math.round(BT.aura), bx + bw, by + 32);
  g.textAlign = 'left'; g.fillText('комбо ' + BT.combo, bx, by + 32);
  if (BT.ratingT > 0) { g.textAlign = 'center'; g.font = '48px Wet, Arial'; g.fillStyle = BT.rating === 'ПРОМАХ' ? '#ff4040' : '#ffd860'; g.globalAlpha = Math.min(1, BT.ratingT * 2); g.fillText(BT.rating, W2 / 2, H2 * 0.42 - (0.6 - BT.ratingT) * 30); g.globalAlpha = 1; }
  const sec = secAt(t);
  g.textAlign = 'center'; g.font = '600 18px Osw, Arial'; g.fillStyle = sec % 2 === 0 || t < BT.ph ? '#d8d0e8' : '#7fff90';
  g.fillText(t < BT.ph ? 'Приготовься…' : sec % 2 === 0 ? 'Поёт Тру Адам — слушай ритм' : 'ТВОЙ ЧЕРЁД! Жми кнопку, когда стрелка на ней', W2 / 2, 26);
}
function singPose(U, lane, base, t) {
  const bounce = Math.abs(Math.sin(t * BT.bpm / 60 * Math.PI)) * 0.04;
  U.hips.position.y = base + bounce; U.spine.rotation.set(0.05, 0, 0); U.neck.rotation.x = 0; U.head.rotation.set(0, 0, 0);
  U.legs.forEach((l, i) => { l.a.rotation.set(0, 0, (i ? -1 : 1) * 0.1); l.b.rotation.x = 0.05; });
  U.arms[0].a.rotation.set(0.2, 0, -0.25); U.arms[0].b.rotation.x = -0.4;
  U.arms[1].a.rotation.set(-2.0, 0, 0.35); U.arms[1].b.rotation.x = -1.7;   // микрофон у рта
  if (lane === 0) { U.spine.rotation.z = 0.25; U.arms[0].a.rotation.set(-1.4, 0, -1.2); U.arms[0].b.rotation.x = 0; }
  if (lane === 1) { U.hips.position.y = base - 0.22; U.legs.forEach(l => { l.a.rotation.x = -0.7; l.b.rotation.x = 1.3; }); U.spine.rotation.x = 0.35; }
  if (lane === 2) { U.arms[0].a.rotation.set(-2.9, 0, -0.2); U.arms[0].b.rotation.x = -0.2; U.head.rotation.x = -0.3; }
  if (lane === 3) { U.spine.rotation.z = -0.25; U.arms[0].a.rotation.set(-1.2, 0, 0.6); U.arms[0].b.rotation.x = -0.3; }
}
function animClub(t) {
  const beatK = 1 - (((t - BT.ph) * BT.bpm / 60 % 1) + 1) % 1;
  if (P.selfAv) singPose(P.selfAv.userData, BT.poseT[0] > 0 ? BT.pose[0] : -1, 0.82, t);
  if (clubAdam) { const U = clubAdam.userData; singPose(U, BT.poseT[1] > 0 ? BT.pose[1] : -1, 1.06, t); U.aura.material.opacity = 0.4 + beatK * 0.5; }
  if (clubBall) clubBall.rotation.y += 0.02;
  if (clubFloorTex) clubFloorTex.offset.x = Math.floor((t - BT.ph) * BT.bpm / 60) * 0.125;
  clubCrowd.forEach((c, i) => { c.position.y = Math.abs(Math.sin(t * BT.bpm / 60 * Math.PI + i)) * 0.15; });
  // камера переезжает к тому, кто поёт, и «пружинит» в такт
  const adamTurn = secAt(t) % 2 === 0;
  const tx = CLUB.x + (adamTurn ? 1.2 : -1.2);
  BT.camX = BT.camX === undefined ? tx : BT.camX + (tx - BT.camX) * 0.05;
  camera.position.set(BT.camX, 2.0, CLUB.z + 5.6 - beatK * 0.12);
  camera.lookAt(BT.camX, 1.4, CLUB.z - 1);
  camera.fov = 60 - beatK * 1.5; camera.updateProjectionMatrix();
}
function endClub(win) {
  if (!BT.on) return;
  BT.on = false; stopPhonk(); playTrack('adam', false); camera.fov = 72; camera.updateProjectionMatrix();
  document.body.classList.remove('club'); $('clubUI').classList.add('hidden');
  if (P.selfAv) P.selfAv.visible = false;
  const b = BT.back; if (b) { P.f = b.f; P.pos.copy(b.p); P.yaw = b.yaw; P.pitch = b.pitch; }
  setMusic('ambient');
  endAura(win);
}

function updateAura(dt) { updateClub(dt); }

// ================= БАНЬКА КОЧ БРАТАНА =================
// Во дворе стоит обычная с виду банька. В полу — люк, запертый на ключ. Ключ закопан в теплице под растением «кочедор»:
// найди лопату и выкопай. Под люком — огромная подземная баня, где хозяйничает Коч Братан. Там, в парилке, лежит пульт от лазеров ворот.
// Механики бани: ЖАР растёт (в парилке и в пару быстрее), охлаждает только купель; присел в купели — нырнул (Коч не видит, но воздух кончается);
// Коч поддаёт пару (всё в тумане, он видит хуже, а жар растёт быстрее) и делает рывок с веником.
const BANYA_HATCH = V(cc(16), 0, cc(19.2));
const KOCHEDOR = V(cc(25), 0, cc(15));
const BN = { x: 700, z: 0 };   // подземная баня (отдельная локация)
// План подземной бани — сетка 40×18 клеток по 1 м (строка r ↔ z = r − 9).
// '#' стена, '.' пол, 't' плитка, 'p' купель, L шкафчик, B лавка, C колонна, S каменка, P полок, T столик, K кадка
const BNW = 40, BNH = 18;
const BNG = (() => {
  const g = Array.from({ length: BNH }, () => Array(BNW).fill('#'));
  const rect = (x0, z0, x1, z1, ch) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z][x] = ch; };
  rect(1, 4, 9, 13, '.');                       // предбанник
  rect(10, 8, 10, 9, '.');                      // проём в мыльню
  rect(11, 1, 25, 16, 't');                     // мыльня
  rect(16, 7, 20, 10, 'p');                     // купель
  for (const [x, z] of [[13, 4], [13, 13], [23, 4], [23, 13]]) g[z][x] = 'C';
  rect(26, 8, 26, 9, '.'); rect(26, 12, 26, 13, '.');   // два проёма в парилку
  rect(27, 3, 38, 14, '.');                     // парилка
  rect(36, 3, 38, 14, 'P');                     // полки ступенями
  rect(28, 12, 29, 13, 'S');                    // каменка
  g[8][33] = 'T'; g[9][33] = 'T';               // столик (на нём пульт)
  g[13][31] = 'K';                              // кадка с водой
  for (const x of [3, 5, 7]) { g[4][x] = 'L'; g[13][x] = 'L'; }
  rect(3, 6, 6, 6, 'B'); rect(3, 11, 6, 11, 'B');
  return g;
})();
const bnCellAt = (gx, gz) => (gx < 0 || gz < 0 || gx >= BNW || gz >= BNH) ? '#' : BNG[gz][gx];
const bnFreeCh = (ch) => ch === '.' || ch === 't' || ch === 'p';
const BN_POOL = { x0: 16, x1: 21, z0: -2, z1: 2 };   // купель
const BN_STOVE = [29, 4];   // каменка
const BN_LADDER = [1.2, 0];
const KB = { steamT: 0, steamCD: 20, mode: 'relax', timer: 0, dashT: 0, restT: 0, last: null, wander: null, seeT: 0, sayT: 0, path: [], pathKey: '', repathT: 0 };
const bnLocal = (x, z) => [x - BN.x, z - BN.z];
const bnG = (x, z) => { const [lx, lz] = bnLocal(x, z); return [Math.floor(lx), Math.floor(lz + 9)]; };
const inBanya = (pl) => zoneAt(pl.pos.x, pl.pos.z) === 'banya';
function banyaWall(x, z) { const [gx, gz] = bnG(x, z); return bnCellAt(gx, gz) === '#'; }   // только стены (мебель взгляду не мешает)
function banyaSolid(x, z) { const [gx, gz] = bnG(x, z); return !bnFreeCh(bnCellAt(gx, gz)); }
const bnRoom = (lx) => lx < 10 ? 'A' : lx < 26 ? 'B' : 'C';
const inPool = (pl) => { const [lx, lz] = bnLocal(pl.pos.x, pl.pos.z); return lx > BN_POOL.x0 && lx < BN_POOL.x1 && lz > BN_POOL.z0 && lz < BN_POOL.z1; };
const submerged = (pl) => inBanya(pl) && inPool(pl) && pl.crouch;
// путь по сетке бани (поиск в ширину, 8 направлений без срезания углов)
function bnPath(sx, sz, tx, tz) {
  const key = (x, z) => z * BNW + x, prev = new Map(), q = [[sx, sz]]; prev.set(key(sx, sz), -1);
  while (q.length) {
    const [x, z] = q.shift();
    if (x === tx && z === tz) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz);
      if (prev.has(k) || !bnFreeCh(bnCellAt(nx, nz))) continue;
      if (dx && dz && (!bnFreeCh(bnCellAt(x + dx, z)) || !bnFreeCh(bnCellAt(x, z + dz)))) continue;
      prev.set(k, key(x, z)); q.push([nx, nz]);
    }
  }
  if (!prev.has(key(tx, tz))) return [];
  const out = []; let k = key(tx, tz);
  while (k !== -1 && k !== key(sx, sz)) { out.push([k % BNW, (k / BNW) | 0]); k = prev.get(k); }
  return out.reverse();
}
function bnNearestFree(gx, gz) {
  for (let r = 0; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (bnFreeCh(bnCellAt(gx + dx, gz + dz))) return [gx + dx, gz + dz];
  return [2, 9];
}
// прямая видимость по сетке с запасом на ширину тела
function bnClear(ax, az, bx, bz, rad) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25);
  for (let i = 1; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; for (const [ox, oz] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad]]) if (banyaSolid(x + ox, z + oz)) return false; }
  return true;
}
// ---- банька во дворе ----
let banyaOut = null, kochedorM = null, bnHatchM = null;
function buildBanyaOutside() {
  const g = new THREE.Group();
  const logM = LM({ map: T.wood, color: 0xb08a60 }), logD = LM({ map: T.wood, color: 0x6a4a2a }), roofM = LM({ map: T.roof, color: 0x7a6a5a }), dark = LM({ color: 0x0a0806 });
  const X0 = 14 * CS, X1 = 19 * CS, Z0 = 17 * CS, Z1 = 21 * CS;   // 10 × 8 м
  // стены из брёвен (толщиной в клетку — внутри уютная комната 6×4 м)
  // сруб: текстура из круглых брёвен
  const logT = tex(256, 256, (cg, w, h, R) => {
    for (let y = 0; y < h; y += 32) { const v = 150 + R() * 30; const gr = cg.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, `rgb(${v * 0.55 | 0},${v * 0.38 | 0},${v * 0.22 | 0})`); gr.addColorStop(0.45, `rgb(${v | 0},${v * 0.72 | 0},${v * 0.45 | 0})`); gr.addColorStop(1, `rgb(${v * 0.45 | 0},${v * 0.3 | 0},${v * 0.18 | 0})`); cg.fillStyle = gr; cg.fillRect(0, y, w, 32); cg.fillStyle = 'rgba(40,20,8,0.7)'; cg.fillRect(0, y + 30, w, 2); }
    grime(cg, w, h, 61, 0.3);
  }, 61);
  const logW = LM({ map: logT });
  const wall = (x0, x1, z0, z1) => g.add(box(x1 - x0, 3.0, z1 - z0, logW, (x0 + x1) / 2, 1.5, (z0 + z1) / 2));
  wall(X0, 16 * CS - 0.4, Z0, Z0 + CS); wall(17 * CS + 0.4, X1, Z0, Z0 + CS);   // северная стена с проёмом
  wall(X0, X1, Z1 - CS, Z1); wall(X0, X0 + CS, Z0 + CS, Z1 - CS); wall(X1 - CS, X1, Z0 + CS, Z1 - CS);
  g.add(box(2.8, 0.6, CS, logW, cc(16), 2.7, Z0 + CS / 2));   // над проёмом
  { const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb060 })); bulb.position.set(cc(16), 2.75, cc(18.6)); g.add(bulb);
    LAMPS.push({ f: 1, x: 16, z: 18, col: 0xffa860, i: 7, d: 9, flick: true, noOff: true, pos: V(cc(16), 2.6, cc(18.6)), bulb, onMat: bulb.material, offMat: bulb.material, on: true }); }
  { const ce = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.2), LM({ map: logT, color: 0x8a6a50 })); ce.rotation.x = Math.PI / 2; ce.position.set(33, 2.98, 37.1); g.add(ce); }   // потолок комнаты
  // двускатная крыша: два ската, конёк вдоль бани, фронтоны с обеих сторон (без щелей — сквозь крышу ничего не видно)
  const RY0 = 2.95, RY1 = 4.6, RZM = (Z0 + Z1) / 2, ang = Math.atan2(RY1 - RY0, RZM - (Z0 - 0.4)), slab = Math.hypot(RY1 - RY0, RZM - (Z0 - 0.4)) + 0.15;
  for (const sd of [-1, 1]) { const r = box(X1 - X0 + 1, 0.16, slab, roofM, (X0 + X1) / 2, (RY0 + RY1) / 2 + 0.05, RZM + sd * (RZM - Z0 + 0.4) / 2); r.rotation.x = sd < 0 ? -ang : ang; g.add(r); }
  { const pos = []; for (const gx of [X0 + 0.02, X1 - 0.02]) pos.push(gx, 3.0, Z0, gx, 3.0, Z1, gx, RY1, RZM);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 4, 0, 2, 0.8, 0, 0, 4, 0, 2, 0.8], 2)); gg.computeVertexNormals();
    g.add(new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ map: logT, side: THREE.DoubleSide }))); }
  // труба с дымком, тёплое окошко
  g.add(box(0.5, 1.8, 0.5, LM({ map: T.brick }), X1 - 2.5, 3.9, Z1 - 2.5));
  g.add(box(0.7, 0.5, 0.06, new THREE.MeshBasicMaterial({ color: 0xc87a30 }), X0 + 3, 1.6, Z0 - 0.02));
  // табличка
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 80; const sg = sc.getContext('2d'); sg.fillStyle = '#5a3a1a'; sg.fillRect(0, 0, 256, 80); sg.fillStyle = '#f0d8a0'; sg.font = 'bold 40px Georgia'; sg.textAlign = 'center'; sg.fillText('БАНЬКА', 128, 54);
  const stx = new THREE.CanvasTexture(sc); stx.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), LM({ map: stx })); plate.position.set(cc(16), 2.55, Z0 - 0.05); plate.rotation.y = Math.PI; g.add(plate);
  // внутри: каменка, полок, тазы
  const SX = 35, SZ = 36.9;
  g.add(box(0.9, 0.9, 0.9, LM({ map: T.metal, color: 0x3a3a3a }), SX, 0.45, SZ));
  for (let i = 0; i < 6; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), LM({ color: 0x5a5a56 })); st.position.set(SX + (i % 3 - 1) * 0.22, 0.97, SZ + ((i / 3) | 0) * 0.24 - 0.12); g.add(st); }
  g.add(box(0.7, 0.08, 3.2, logM, 30.45, 0.55, 38.2)); for (const sz of [-1.3, 1.3]) g.add(box(0.6, 0.55, 0.1, logD, 30.45, 0.27, 38.2 + sz));
  furn.colliders.push({ f: 1, x0: 30, x1: 30.85, z0: 36.6, z1: 39.8, y0: 0, y1: 0.6 });
  furn.colliders.push({ f: 1, x0: SX - 0.5, x1: SX + 0.5, z0: SZ - 0.5, z1: SZ + 0.5, y0: 0, y1: 1 });
  // люк в полу
  bnHatchM = new THREE.Group(); bnHatchM.position.copy(BANYA_HATCH);
  const lid = new THREE.Group(); lid.position.set(-0.55, 0.03, 0); bnHatchM.add(lid);
  lid.add(box(1.1, 0.06, 1.0, logD, 0.55, 0, 0)); lid.add(box(0.12, 0.08, 0.12, LM({ color: 0xb09030, emissive: 0x201000 }), 0.95, 0.05, 0)); bnHatchM.userData.lid = lid;
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), dark); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.012; bnHatchM.add(hole);
  g.add(bnHatchM);
  scene.add(g); banyaOut = g;
  // грядка с кочедором в теплице
  const k = new THREE.Group(); k.position.copy(KOCHEDOR);
  k.add(box(1.3, 0.25, 1.0, LM({ map: T.wood, color: 0x6a4a2a }), 0, 0.12, 0)); k.add(box(1.2, 0.06, 0.9, LM({ map: T.dirt, color: 0x5a3a20 }), 0, 0.27, 0));
  const plant = new THREE.Group(); plant.position.y = 0.3; k.add(plant);
  const lm = LM({ color: 0x5a2a6a, emissive: 0x120418, side: THREE.DoubleSide });
  plant.add(box(0.04, 0.5, 0.04, LM({ color: 0x3a5a2a }), 0, 0.25, 0));
  for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), lm); l.position.set(Math.cos(i) * 0.1, 0.15 + i * 0.06, Math.sin(i) * 0.1); l.rotation.set(1.1, i * 0.9, 0.4); plant.add(l); }
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), LM({ color: 0xd8b030, emissive: 0x302000 })); bud.position.y = 0.55; plant.add(bud);
  const kc = document.createElement('canvas'); kc.width = 256; kc.height = 64; const kg = kc.getContext('2d'); kg.fillStyle = '#e8dcc0'; kg.fillRect(0, 0, 256, 64); kg.fillStyle = '#3a2410'; kg.font = 'bold 36px Georgia'; kg.textAlign = 'center'; kg.fillText('КОЧЕДОР', 128, 46);
  const ktx = new THREE.CanvasTexture(kc); ktx.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.11), LM({ map: ktx, side: THREE.DoubleSide })); tag.position.set(0.45, 0.42, -0.42); tag.rotation.y = 0.3; k.add(tag);
  k.add(box(0.02, 0.3, 0.02, LM({ color: 0x6a4a2a }), 0.45, 0.3, -0.42));
  const hole2 = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), dark); hole2.rotation.x = -Math.PI / 2; hole2.position.y = 0.305; hole2.visible = false; k.add(hole2);
  k.userData = { plant, hole: hole2 };
  scene.add(k); kochedorM = k;
}
function applyBanyaVisual() {
  if (kochedorM) { kochedorM.userData.plant.visible = !G.kochDug; kochedorM.userData.hole.visible = !!G.kochDug; }
  if (bnHatchM) bnHatchM.userData.lid.rotation.z = G.banyaOpen ? 1.9 : 0;
}
// ---- подземная баня ----
let bnGroup = null, bnSteam = [];
function buildUnderBanya() {
  const g = new THREE.Group(); g.position.set(BN.x, 0, BN.z - 9);   // в группе — координаты сетки
  const tileT = tex(256, 256, (cg, w, h, R) => { cg.fillStyle = '#5a6a68'; cg.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 170 + R() * 30; cg.fillStyle = `rgb(${v - 25},${v},${v - 8})`; cg.fillRect(x * 64 + 3, y * 64 + 3, 58, 58); } grime(cg, w, h, 51, 0.3); }, 51);
  const boardT = tex(256, 256, (cg, w, h, R) => { for (let y = 0; y < h; y += 64) { const v = 175 + R() * 35; cg.fillStyle = `rgb(${v},${v * 0.7 | 0},${v * 0.44 | 0})`; cg.fillRect(0, y, w, 64); for (let k = 0; k < 5; k++) { cg.strokeStyle = 'rgba(90,50,20,0.25)'; cg.beginPath(); const yy = y + 8 + R() * 48; cg.moveTo(0, yy); cg.bezierCurveTo(80, yy + 4, 170, yy - 4, 256, yy); cg.stroke(); } cg.fillStyle = 'rgba(60,30,10,0.55)'; cg.fillRect(0, y + 61, w, 3); } grime(cg, w, h, 52, 0.2); }, 52);
  const rep = (t, x, y) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; };
  const dark = LM({ color: 0x0a0806 });
  // ---- стены: по коробке на каждую клетку стены, что смотрит в комнату (три вида: предбанник, мыльня, парилка) ----
  const wallG = new THREE.BoxGeometry(1, 3.4, 1); { const uv = wallG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 1.7); }
  const wallMats = [new THREE.MeshLambertMaterial({ map: boardT, color: 0x9a7050 }), new THREE.MeshLambertMaterial({ map: tileT }), new THREE.MeshLambertMaterial({ map: boardT })];
  const cells = [[], [], []];
  for (let z = 0; z < BNH; z++) for (let x = 0; x < BNW; x++) {
    if (BNG[z][x] !== '#') continue;
    let edge = false; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (bnCellAt(x + dx, z + dz) !== '#') edge = true;
    if (edge) cells[x <= 10 ? 0 : x <= 26 ? 1 : 2].push([x, z]);
  }
  cells.forEach((list, i) => { const im = new THREE.InstancedMesh(wallG, wallMats[i], list.length); const m4 = new THREE.Matrix4(); list.forEach(([x, z], k) => { m4.makeTranslation(x + 0.5, 1.7, z + 0.5); im.setMatrixAt(k, m4); }); g.add(im); });
  // перемычки над проёмами
  for (const [x, z] of [[10, 8], [10, 9], [26, 8], [26, 9], [26, 12], [26, 13]]) g.add(box(1, 1.0, 1, wallMats[x === 10 ? 0 : 2], x + 0.5, 2.9, z + 0.5));
  // ---- полы и потолок ----
  const plane = (x0, z0, x1, z1, mat, y, down) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat); p.rotation.x = down ? Math.PI / 2 : -Math.PI / 2; p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); g.add(p); return p; };
  plane(1, 4, 11, 14, new THREE.MeshLambertMaterial({ map: rep(boardT, 5, 5), color: 0x8a6448 }), 0);
  plane(11, 1, 26, 17, new THREE.MeshLambertMaterial({ map: rep(tileT, 7.5, 8) }), 0);
  plane(26, 3, 39, 15, new THREE.MeshLambertMaterial({ map: rep(boardT, 6.5, 6) }), 0);
  plane(0, 0, BNW, BNH, new THREE.MeshLambertMaterial({ map: rep(boardT, 20, 9), color: 0x6a5040 }), 3.4, true);
  // ---- предбанник: лестница наверх, шкафчики, лавки, вешалка ----
  for (const s of [-0.35, 0.35]) g.add(box(0.08, 3.4, 0.08, wallMats[0], 1.15, 1.7, 9 + s));
  for (let y = 0.3; y < 3.3; y += 0.35) g.add(box(0.06, 0.06, 0.7, wallMats[0], 1.15, y, 9));
  { const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x5a4a38 })); hl.rotation.x = Math.PI / 2; hl.position.set(1.4, 3.39, 9); g.add(hl); }
  const lockCols = [0x3a5a6a, 0x6a3a3a, 0x4a5a3a];
  for (let z = 0; z < BNH; z++) for (let x = 0; x < BNW; x++) {
    const ch = BNG[z][x], cx = x + 0.5, cz = z + 0.5;
    if (ch === 'L') { const lk = new THREE.Group(); lk.position.set(cx, 0, cz); lk.add(box(0.9, 2.0, 0.9, LM({ map: T.metal, color: lockCols[x % 3] }), 0, 1.0, 0)); lk.add(box(0.04, 0.2, 0.06, LM({ color: 0xc0c0c0 }), 0.3, 1.1, z < 9 ? 0.47 : -0.47)); for (let i = 0; i < 3; i++) lk.add(box(0.5, 0.03, 0.02, dark, 0, 1.7 - i * 0.06, z < 9 ? 0.46 : -0.46)); g.add(lk); }
    if (ch === 'B') { g.add(box(1, 0.08, 0.6, wallMats[2], cx, 0.45, cz)); g.add(box(0.08, 0.45, 0.5, wallMats[0], cx - 0.42, 0.22, cz)); }
    if (ch === 'C') g.add(box(0.9, 3.4, 0.9, wallMats[1], cx, 1.7, cz));
  }
  for (let i = 0; i < 4; i++) { const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), wallMats[0]); t2.rotation.z = Math.PI / 2; t2.position.set(8.8, 1.9, 4.7 + i * 0.7); g.add(t2); const tw = box(0.05, 0.7, 0.35, LM({ color: [0xe8e0d0, 0x8ab0d0, 0xd08a8a, 0xe8e0d0][i] }), 8.65, 1.55, 4.7 + i * 0.7); g.add(tw); }
  // ---- мыльня: купель с бортиком, души, тазы, табличка ----
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), new THREE.MeshLambertMaterial({ map: T.water || null, color: 0x5aa8c8, emissive: 0x0a2a3a, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(18.5, 0.03, 9); g.add(pool);
  const rim = LM({ map: tileT, color: 0x9ac0d0 });
  g.add(box(5.2, 0.14, 0.12, rim, 18.5, 0.07, 6.98)); g.add(box(5.2, 0.14, 0.12, rim, 18.5, 0.07, 11.02)); g.add(box(0.12, 0.14, 4, rim, 15.98, 0.07, 9)); g.add(box(0.12, 0.14, 4, rim, 21.02, 0.07, 9));
  { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const q = c.getContext('2d'); q.fillStyle = '#2a5a8a'; q.fillRect(0, 0, 256, 64); q.fillStyle = '#fff'; q.font = 'bold 34px Osw, Arial'; q.textAlign = 'center'; q.fillText('КУПЕЛЬ · +4°', 128, 44);
    const t3 = new THREE.CanvasTexture(c); t3.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: t3 })); m.position.set(18.5, 2.6, 1.02); g.add(m); }
  for (let i = 0; i < 4; i++) { const x = 12.5 + i * 4; g.add(box(0.06, 2.4, 0.06, LM({ map: T.metal }), x, 1.2, 1.05)); g.add(box(0.06, 0.06, 0.4, LM({ map: T.metal }), x, 2.4, 1.25)); g.add(box(0.3, 0.05, 0.3, LM({ map: T.metal }), x, 2.36, 1.45)); }
  for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.18, 12), LM({ color: 0x9a7a4a })); b.position.set(12 + (i % 4) * 4, 0.09, i < 4 ? 1.6 : 16.4); g.add(b); }
  // ---- парилка: каменка, полки ступенями, столик с пультом, кадка ----
  const stove = new THREE.Group(); stove.position.set(29, 0, 13);
  stove.add(box(1.7, 1.0, 1.7, LM({ map: T.metal, color: 0x3a3a3a }), 0, 0.5, 0)); stove.add(box(1.8, 0.1, 1.8, LM({ color: 0x1a1a1a }), 0, 1.02, 0));
  for (let i = 0; i < 16; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), LM({ color: 0x6a5a50, emissive: 0x200800 })); st.position.set((i % 4 - 1.5) * 0.36, 1.15 + ((i / 8) | 0) * 0.12, (((i / 4) | 0) % 4 - 1.5) * 0.36); stove.add(st); }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshBasicMaterial({ color: 0xff6a20 })); glow.position.set(0, 0.4, -0.86); glow.rotation.y = Math.PI; stove.add(glow);
  stove.add(box(0.25, 2.4, 0.25, LM({ map: T.metal, color: 0x2a2a2a }), 0.5, 2.2, 0.5));
  g.add(stove);
  for (let t = 0; t < 3; t++) { const x = 36.5 + t; g.add(box(1.02, 0.12, 12, wallMats[2], x, 0.55 + t * 0.6, 9)); g.add(box(1.02, 0.55 + t * 0.6, 0.1, wallMats[0], x, (0.55 + t * 0.6) / 2, 3.05)); g.add(box(0.1, 0.55 + t * 0.6, 12, wallMats[0], x - 0.48, (0.55 + t * 0.6) / 2, 9)); }
  const tbl = new THREE.Group(); tbl.position.set(33.5, 0, 9); tbl.add(box(0.85, 0.06, 1.7, wallMats[2], 0, 0.8, 0)); for (const [a, b] of [[-0.35, -0.75], [0.35, -0.75], [-0.35, 0.75], [0.35, 0.75]]) tbl.add(box(0.06, 0.8, 0.06, wallMats[0], a, 0.4, b)); g.add(tbl);
  const kad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.65, 14), wallMats[0]); kad.position.set(31.5, 0.33, 13.5); g.add(kad);
  const kw = new THREE.Mesh(new THREE.CircleGeometry(0.34, 14), new THREE.MeshLambertMaterial({ color: 0x3a6a80 })); kw.rotation.x = -Math.PI / 2; kw.position.set(31.5, 0.62, 13.5); g.add(kw);
  { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const q = c.getContext('2d'); q.fillStyle = '#4a2a10'; q.fillRect(0, 0, 256, 64); q.fillStyle = '#ffd8a0'; q.font = 'bold 34px Georgia'; q.textAlign = 'center'; q.fillText('ПАРИЛКА', 128, 44);
    const t3 = new THREE.CanvasTexture(c); t3.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.36), new THREE.MeshBasicMaterial({ map: t3 })); m.position.set(25.98, 2.75, 7.4); m.rotation.y = -Math.PI / 2; g.add(m); }
  // ---- свет ----
  [[5, 9, 0xffd0a0], [14, 4, 0xfff0d8], [22, 13, 0xfff0d8], [18.5, 9, 0xd8f0ff], [31, 6, 0xff9050], [31, 12, 0xff8040]].forEach(([lx, lz, col], i) => {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: col })); bulb.position.set(lx, 3.15, lz); g.add(bulb);
    g.add(box(0.3, 0.02, 0.3, dark, lx, 3.38, lz));
    LAMPS.push({ f: 1, x: 0, z: 0, col, i: 9, d: 13, flick: i === 2, noOff: true, pos: V(BN.x + lx, 3.0, BN.z - 9 + lz), bulb, onMat: bulb.material, offMat: bulb.material, on: true });
  });
  // ---- клубы пара ----
  const pc = document.createElement('canvas'); pc.width = pc.height = 64; const pg = pc.getContext('2d'); const gr = pg.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); pg.fillStyle = gr; pg.fillRect(0, 0, 64, 64);
  const ptx = new THREE.CanvasTexture(pc);
  for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptx, transparent: true, depthWrite: false, opacity: 0 })); sp.position.set(12 + Math.random() * 24, 0.6 + Math.random() * 2.4, 2 + Math.random() * 14); sp.scale.setScalar(3 + Math.random() * 3); sp.userData.ph = Math.random() * 6; g.add(sp); bnSteam.push(sp); }
  scene.add(g); bnGroup = g;
}
function placeRemote() {
  const o = addObject('remote', 1, 0, 0, 'item');
  o.pos.set(BN.x + 33.5, 0.86, BN.z); o.mesh.position.copy(o.pos); o.home.pos.copy(o.pos); o.rest = true;
}
// ---- Коч Братан ----
function kochStart() {
  koch.f = 1; koch.pos.set(BN.x + 32.5, 0, BN.z + 3.5); koch.yaw = -Math.PI / 2; KB.path = []; KB.pathKey = ''; koch.tgt.copy(koch.pos); koch.state = 'relax'; koch.stun = 0;
  KB.mode = 'relax'; KB.timer = rand(6, 12); KB.steamT = 0; KB.steamCD = rand(16, 24); KB.last = null; KB.dashT = 0; KB.restT = 0; KB.wander = null; koch.mesh.visible = !(G.practice && G.practice.noKoch); koch.sync();
}
function kochCanSee(pl) {
  if (submerged(pl) || !targetable(pl)) return false;
  const dx = pl.pos.x - koch.pos.x, dz = pl.pos.z - koch.pos.z, d = Math.hypot(dx, dz);
  const range = KB.steamT > 0 ? 3.2 : 15;
  if (d > range) return false;
  if (d > 2.2) { let a = Math.atan2(dx, dz) - koch.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > 1.15) return false; }
  for (let i = 1; i < 12; i++) { const t = i / 12; const [gx, gz] = bnG(koch.pos.x + dx * t, koch.pos.z + dz * t); const ch = bnCellAt(gx, gz); if (ch === '#' || ch === 'C' || ch === 'L') return false; }
  return true;
}
function kochGo(tx, tz, speed, dt) {   // идти к точке (координаты бани) по сетке, срезая путь, когда видно напрямую
  const [lx, lz] = bnLocal(koch.pos.x, koch.pos.z);
  koch.moving = false; koch.speedNow = 0;
  if (Math.hypot(tx - lx, tz - lz) < 0.3) return true;
  let gx, gz;
  if (bnClear(koch.pos.x, koch.pos.z, BN.x + tx, BN.z + tz, 0.32)) { gx = tx; gz = tz; KB.path = []; }
  else {
    const goal = bnNearestFree(Math.floor(tx), Math.floor(tz + 9)), gk = goal.join(',');
    KB.repathT -= dt;
    if (KB.pathKey !== gk || KB.repathT <= 0 || !KB.path.length) { const st = bnNearestFree(Math.floor(lx), Math.floor(lz + 9)); KB.path = bnPath(st[0], st[1], goal[0], goal[1]); KB.pathKey = gk; KB.repathT = 0.6; }
    while (KB.path.length && Math.hypot(KB.path[0][0] + 0.5 - lx, KB.path[0][1] - 8.5 - lz) < 0.3) KB.path.shift();
    // сглаживание: если следующая клетка видна напрямую — идём к ней
    while (KB.path.length > 1 && bnClear(koch.pos.x, koch.pos.z, BN.x + KB.path[1][0] + 0.5, BN.z + KB.path[1][1] - 8.5, 0.32)) KB.path.shift();
    if (!KB.path.length) { gx = tx; gz = tz; } else { gx = KB.path[0][0] + 0.5; gz = KB.path[0][1] - 8.5; }
  }
  const dx = gx - lx, dz = gz - lz, d = Math.hypot(dx, dz);
  if (d < 0.01) return !KB.path.length;
  const mv = Math.min(d, speed * dt);
  const nx = koch.pos.x + dx / d * mv, nz = koch.pos.z + dz / d * mv;
  const ok = (x, z) => !banyaSolid(x - 0.3, z - 0.3) && !banyaSolid(x + 0.3, z - 0.3) && !banyaSolid(x - 0.3, z + 0.3) && !banyaSolid(x + 0.3, z + 0.3);
  if (ok(nx, nz)) { koch.pos.x = nx; koch.pos.z = nz; } else if (ok(nx, koch.pos.z)) koch.pos.x = nx; else if (ok(koch.pos.x, nz)) koch.pos.z = nz; else { koch.pos.x = nx; koch.pos.z = nz; }   // по центрам клеток пути — всегда свободно
  koch.yaw = lerpAngle(koch.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
  koch.moving = true; koch.speedNow = speed; koch.anim += mv * 2.4;
  return false;
}
function kochPour() {
  KB.steamT = 9; KB.steamCD = rand(18, 26);
  const p = V(BN.x + BN_STOVE[0], 1.4, BN.z + BN_STOVE[1]); fx.steam(p); sayW('koch', 'steam', koch.pos);
  for (const pl of players()) if (inBanya(pl)) ptoast(pl, 'Коч поддал пару! В пару жар растёт быстрее, а он видит хуже', 3);
}
function updateKoch(dt) {
  if (!koch) return;
  const anyone = players().some(pl => inBanya(pl) && !pl.dead);
  KB.steamT = Math.max(0, KB.steamT - dt);
  if (!anyone) { if (KB.mode !== 'relax') kochStart(); koch.moving = false; animKoch(dt); koch.sync(); return; }
  if (koch.stun > 0) { koch.stun -= dt; koch.moving = false; if (updateRag(koch, dt)) { animKoch(dt); koch.sync(); return; } animKoch(dt); koch.sync(); return; }
  const sp = D.speed * 2.15;
  // кого видит / слышит
  let seen = null, sd = 1e9;
  for (const pl of standing()) if (inBanya(pl) && kochCanSee(pl)) { const d = distTo(koch, pl); if (d < sd) { sd = d; seen = pl; } }
  if (!seen) for (const pl of standing()) if (inBanya(pl) && !submerged(pl) && pl.sprint && pl.moving > 0.1 && distTo(koch, pl) < 14 * D.hear) { KB.last = [...bnLocal(pl.pos.x, pl.pos.z)]; if (KB.mode === 'relax' || KB.mode === 'patrol') { KB.mode = 'search'; sayW('koch', 'hear', koch.pos); } }
  if (seen) { KB.last = [...bnLocal(seen.pos.x, seen.pos.z)]; if (KB.mode !== 'chase' && KB.mode !== 'dash' && KB.mode !== 'rest') { KB.mode = 'chase'; sayW('koch', 'chase', koch.pos); } KB.tp = seen; }
  KB.sayT -= dt;
  switch (KB.mode) {
    case 'relax':   // сидит у каменки, парится
      koch.moving = false; KB.timer -= dt;
      if (KB.timer <= 0) { KB.mode = 'patrol'; KB.wander = null; }
      break;
    case 'patrol': {
      if (!KB.wander) { let c; for (let i = 0; i < 40; i++) { c = [11 + ((Math.random() * 25) | 0), 1 + ((Math.random() * 15) | 0)]; if (bnFreeCh(bnCellAt(...c))) break; } KB.wander = [c[0] + 0.5, c[1] - 8.5]; }
      if (kochGo(KB.wander[0], KB.wander[1], sp * 0.5, dt)) KB.wander = null;
      KB.steamCD -= dt; if (KB.steamCD <= 0) KB.mode = 'steam';
      break;
    }
    case 'steam': {   // идёт к каменке и поддаёт пару
      if (kochGo(BN_STOVE[0] - 1.5, BN_STOVE[1] - 0.5, sp * 0.8, dt)) { koch.face(V(BN.x + BN_STOVE[0], 0, BN.z + BN_STOVE[1]), dt); KB.timer = (KB.timer > 0 ? KB.timer : 1.4) - dt; if (KB.timer <= 0.05) { kochPour(); KB.mode = KB.last ? 'search' : 'patrol'; KB.timer = 0; } }
      break;
    }
    case 'chase': {
      const t = KB.tp && PL.get(KB.tp.id) === KB.tp ? KB.tp : null;
      if (!t || !targetable(t) || !inBanya(t)) { KB.mode = KB.last ? 'search' : 'patrol'; break; }
      if (!seen) { KB.mode = 'search'; KB.timer = 6; break; }
      const d = distTo(koch, t);
      if (d < 1.05) { caught(koch, t); KB.mode = 'patrol'; break; }
      if (d < 6 && d > 2.2 && KB.dashCD <= 0) { KB.mode = 'dash'; KB.dashT = 0.75; KB.dashCD = 4; fx.venik(koch.pos); sayW('koch', 'dash', koch.pos); break; }
      kochGo(...bnLocal(t.pos.x, t.pos.z), sp, dt);
      if (KB.sayT <= 0) { KB.sayT = 6; sayW('koch', 'chase', koch.pos); }
      break;
    }
    case 'dash': {   // рывок с веником
      KB.dashT -= dt;
      const t = KB.tp && PL.get(KB.tp.id) === KB.tp ? KB.tp : null;
      if (t && targetable(t) && inBanya(t)) { kochGo(...bnLocal(t.pos.x, t.pos.z), sp * 2.3, dt); if (distTo(koch, t) < 1.2) { caught(koch, t); KB.mode = 'patrol'; break; } }
      if (KB.dashT <= 0) { KB.mode = 'rest'; KB.restT = 1.6; }
      break;
    }
    case 'rest': KB.restT -= dt; koch.moving = false; if (KB.restT <= 0) KB.mode = seen ? 'chase' : 'search'; break;
    case 'search': {
      if (!KB.last) { KB.mode = 'patrol'; break; }
      KB.timer -= dt;
      if (kochGo(KB.last[0], KB.last[1], sp * 0.8, dt) || KB.timer < -8) {
        KB.last = null; KB.timer = 0; sayW('koch', 'lost', koch.pos);
        KB.mode = KB.steamCD < 8 ? 'steam' : 'patrol';
      }
      break;
    }
  }
  KB.dashCD = Math.max(0, (KB.dashCD || 0) - dt);
  koch.state = KB.mode;
  animKoch(dt); koch.sync();
}
function animKoch(dt) {
  const U = koch.mesh.userData, t = now() + mt;
  if (koch.rag) { ragPose(koch); return; }
  koch.mesh.rotation.x = 0; koch.mesh.rotation.z = 0;
  const { s, aa } = walkPose(U, koch, 0.55, 0.5);
  U.hips.position.y = 1.0 + (koch.moving ? Math.abs(Math.cos(koch.anim)) * 0.04 : 0);
  U.spine.rotation.set(0.05, 0, 0); U.head.rotation.set(0, 0, 0); U.neck.rotation.set(0, 0, 0);
  U.arms[0].a.rotation.set(s * aa, 0, -0.35); U.arms[0].b.rotation.x = -0.3;
  U.arms[1].a.rotation.set(-s * aa - 0.2, 0, 0.35); U.arms[1].b.rotation.x = -0.5;
  if (KB.mode === 'relax') { U.hips.position.y = 0.62; U.legs.forEach(l => { l.a.rotation.x = -1.4; l.b.rotation.x = 1.4; }); U.arms[1].a.rotation.set(-1.6 + Math.sin(t * 6) * 0.6, 0, 0.2); U.arms[1].b.rotation.x = -0.8; U.head.rotation.x = -0.2; }   // хлещет себя веником
  if (KB.mode === 'steam' && KB.timer > 0) { U.arms[1].a.rotation.set(-1.3, 0, 0.1); U.arms[1].b.rotation.x = -0.2 - Math.max(0, 1.4 - KB.timer); }
  if (KB.mode === 'dash') { U.spine.rotation.x = 0.35; U.arms[1].a.rotation.set(-2.6 + Math.sin(t * 30) * 0.8, 0, 0.3); }
  if (KB.mode === 'rest') { U.spine.rotation.x = 0.55; U.arms.forEach(a => { a.a.rotation.set(0.4, 0, 0); a.b.rotation.x = -0.2; }); U.hips.position.y = 0.95 + Math.sin(t * 9) * 0.02; }
  if (KB.mode === 'chase') { U.arms[1].a.rotation.set(-2.2 + Math.sin(koch.anim * 2) * 0.6, 0, 0.3); }
}
// ---- жар, купель, нырок (у каждого игрока свой, считается у него) ----
function updateHeat(dt) {
  const el = $('heatBox');
  if (!inBanya(P) || P.dead || G.mode !== 'play') { P.heat = Math.max(0, (P.heat || 0) - dt * 20); P.breath = 7; el.classList.add('hidden'); document.body.classList.remove('underwater'); return; }
  el.classList.remove('hidden');
  const [lx] = bnLocal(P.pos.x, P.pos.z), room = bnRoom(lx);
  const pool = inPool(P);
  let rate = room === 'A' ? -5 : room === 'B' ? 1.4 : 3.6;
  if (KB.steamT > 0 && room !== 'A') rate += 4;
  if (pool) rate = -28;
  if (P.sprint && P.moving > 0.1) rate += 1;
  P.heat = Math.max(0, Math.min(100, (P.heat || 0) + rate * dt * (D.speed || 1)));
  // нырок: присел в купели — под водой, Коч не видит, но воздух кончается
  const under = pool && P.crouch;
  document.body.classList.toggle('underwater', under);
  if (under) { P.breath = (P.breath === undefined ? 7 : P.breath) - dt; if (P.breath <= 0) { P.crouch = false; $('bCrouch').classList.remove('on'); toast('Воздух кончился — пришлось вынырнуть!', 2.2); sfx.dip(null); } }
  else P.breath = Math.min(7, (P.breath === undefined ? 7 : P.breath) + dt * 2);
  if (under !== !!P.wasUnder) { sfx.dip(null); P.wasUnder = under; }
  $('heatFill').style.width = P.heat.toFixed(1) + '%';
  $('heatFill').style.background = P.heat > 75 ? '#ff3020' : P.heat > 45 ? '#ff9020' : '#ffd060';
  $('heatTxt').textContent = under ? 'ПОД ВОДОЙ · воздух ' + Math.max(0, P.breath).toFixed(0) + ' с' : pool ? 'КУПЕЛЬ — остываешь. Присядь, чтобы нырнуть' : 'ЖАР ' + Math.round(P.heat) + '%' + (P.heat > 75 ? ' — беги в купель!' : '');
  if (P.heat >= 100 && !P.fainting) {
    P.fainting = true; setTimeout(() => { P.fainting = false; }, 3000);
    toast('Тебя запарило — ты упал без сил…', 2.5);
    if (Net.role === 'client') Net.send({ t: 'r', a: 'faint' }, true); else caught(koch, P);
    P.heat = 40;
  }
}
// пар: белый туман и клубы
function steamFx(dt) {
  const k = KB.steamT > 0 ? Math.min(1, KB.steamT / 2, (9 - KB.steamT) * 1.5 + 0.2) : 0;
  const t = now() + mt;
  for (const sp of bnSteam) { sp.material.opacity = k * (0.55 + Math.sin(t * 0.8 + sp.userData.ph) * 0.2); sp.position.y += Math.sin(t + sp.userData.ph) * dt * 0.1; }
  if (inBanya(P) && !G.nv) { scene.fog.color.setRGB(0.05 + k * 0.55, 0.05 + k * 0.55, 0.06 + k * 0.55); scene.fog.density = 0.02 + k * 0.16; G.fogMod = true; }
  else if (G.fogMod) { G.fogMod = false; scene.fog.color.setHex(D.dark ? 0x000000 : 0x05060a); }
}
// ---- вход и выход ----
function enterBanya(pl) {
  teleportPlayer(pl, 1, BN.x + BN_LADDER[0] + 1.2, BN.z);
  if (pl.local) { P.yaw = -Math.PI / 2; toast('Подземная баня! Где-то в парилке лежит пульт от лазеров. Следи за жаром — остужайся в купели', 5); }
  else ptoast(pl, 'Подземная баня! Где-то в парилке лежит пульт от лазеров. Следи за жаром — остужайся в купели', 5);
  if (KB.mode === 'relax' && Math.random() < 0.5) { KB.mode = 'search'; KB.last = [5, 0]; }
}
function leaveBanya(pl) { teleportPlayer(pl, 1, cc(16), cc(18.3)); if (pl.local) P.yaw = Math.PI; }

// ================= МАШИНА ДЕДА =================
const CAR = { pos: V(cc(12), 0, cc(17)), yaw: Math.PI / 2, sp: 0, dead: false, driver: null, unlocked: false, radio: 0, radioT: 0, humT: 0, noiseT: 0, mesh: null, smokeT: 0 };
const CAR_START = { x: cc(12), z: cc(17), yaw: Math.PI / 2 };
function resetCar() {
  CAR.pos.set(CAR_START.x, 0, CAR_START.z); CAR.yaw = CAR_START.yaw; CAR.sp = 0; CAR.dead = false; CAR.driver = null; CAR.radio = 0; CAR.radioT = 0;
  if (CAR.mesh) { CAR.mesh.position.copy(CAR.pos); CAR.mesh.rotation.y = CAR.yaw; }
}
const carSolid = (x, z) => {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), ch = cell(1, cx, cz);
  if (ch === null) return 'edge';
  if (ch === 'G') return G.esc.gateOpen ? null : 'gate';
  if (ch === 'f') return 'fence';
  if ('#qWTBYoRL'.includes(ch)) return ch === '#' && insideHouse(cx, cz) ? 'house' : 'hard';
  if (ch === 'D') { const d = doorAt(1, cx, cz); return d && d.open ? null : insideHouse(cx, cz) ? 'house' : 'hard'; }
  return null;
};
function carCorners(x, z, yaw) {
  const fx2 = Math.sin(yaw), fz2 = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), out = [];
  for (const [a, b] of [[1.95, 0.85], [1.95, -0.85], [-1.95, 0.85], [-1.95, -0.85], [2.0, 0]]) out.push([x + fx2 * a + rx * b, z + fz2 * a + rz * b]);
  return out;
}
function driveCar(dt, mx, mz) {
  const thr = -mz, steer = mx;
  if (!CAR.dead) {
    CAR.sp += thr * (thr * CAR.sp < 0 ? 14 : 6.5) * dt;
    if (Math.abs(thr) < 0.05) CAR.sp *= Math.pow(0.35, dt);
    CAR.sp = Math.max(-4, Math.min(13, CAR.sp));
  } else CAR.sp *= Math.pow(0.05, dt);
  CAR.yaw -= steer * CAR.sp * 0.16 * dt;
  const nx = CAR.pos.x + Math.sin(CAR.yaw) * CAR.sp * dt, nz = CAR.pos.z + Math.cos(CAR.yaw) * CAR.sp * dt;
  let hit = null, hx = 0, hz = 0;
  for (const [x, z] of carCorners(nx, nz, CAR.yaw)) { const r = carSolid(x, z); if (r) { hit = r; hx = x; hz = z; break; } }
  if (!hit) { CAR.pos.x = nx; CAR.pos.z = nz; }
  else {
    const impact = Math.abs(CAR.sp);
    if (impact > 6) carCrash(hit, hx, hz, impact);
    else { if (impact > 1.5) { sfx.impact(CAR.pos, impact * 2); myNoise(1, CAR.pos.clone(), 8); } }
    CAR.sp = -CAR.sp * 0.25;
  }
  // сбивает врагов с ног
  if (Math.abs(CAR.sp) > 4) for (const e of [hostess, watchman, yard, adam]) if (e && e.state !== 'off' && e.f === 1 && e.stun <= 0 && Math.hypot(e.pos.x - CAR.pos.x, e.pos.z - CAR.pos.z) < 1.8) { if (Net.role === 'client') Net.send({ t: 'r', a: 'carhit', who: whoOf(e) }, true); else carHitEnemy(e); }
  P.pos.set(CAR.pos.x, 0, CAR.pos.z); P.f = 1;
  // звук и шум мотора
  CAR.humT -= dt; if (CAR.humT <= 0 && !CAR.dead) { CAR.humT = 0.18; sfx.carHum(CAR.pos, Math.abs(CAR.sp)); }
  CAR.noiseT -= dt; if (CAR.noiseT <= 0 && !CAR.dead) { CAR.noiseT = 1; myNoise(1, CAR.pos.clone(), CAR.radio ? 16 : 9 + Math.abs(CAR.sp)); }
  if (CAR.radio) CAR.radioT += dt;
}
function carHitEnemy(e) { e.stun = 8 * D.stun; fx.hurt(e.pos); sayW(whoOf(e), 'hurt', e.pos); if (e === yard) yardDrop(); }
function carCrash(kind, x, z, impact) {
  CAR.dead = true; CAR.radio = 0;
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
  const p = V(x, 1.0, z);
  if (Net.role === 'client') Net.send({ t: 'r', a: 'crash', kind, cx, cz, p: pv(p) }, true); else crashAt(kind, cx, cz, p);
  toast(kind === 'house' ? 'БАБАХ! Стена проломлена, машина заглохла' : kind === 'gate' ? 'Ворота не поддались. Машина заглохла' : 'Удар! Машина заглохла', 3.5);
  setTimeout(() => { if (P.driving) leaveCar(); }, 1200);
}
function crashAt(kind, cx, cz, p) {
  CAR.dead = true; CAR.radio = 0;
  fx.boom(p); spawnBoom(p); noise(1, p.clone(), 25, null);
  if (Net.role === 'host') Net.send({ t: 'boom', p: pv(p) });
  if (kind === 'house' && cell(1, cx, cz) === '#') breakWall(cx, cz);
}
// пролом в стене дома: клетка становится проходом, стены перестраиваются
function breakWall(cx, cz) {
  if (G.broken.some(([x, z]) => x === cx && z === cz)) return;
  G.broken.push([cx, cz]); maps[1][cz][cx] = '.';
  rebuildWorld();
}
function rebuildWorld() {
  const mm = buildMaps(); for (const [x, z] of G.broken) mm[1][z][x] = '.';
  if (G.houseGone) for (let z = 3; z <= 14; z++) for (let x = 2; x <= 17; x++) { mm[1][z][x] = 'g'; mm[2][z][x] = ' '; mm[3][z][x] = ' '; }
  scene.remove(world.group); world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  world = buildWorld(scene, mm, T); pbrify(world.group);
  if (SHADOWS) world.group.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
}
function enterCar(pl) {
  if (CAR.dead || CAR.driver) return;
  CAR.driver = pl.id;
  if (pl.local) startDriving(); else Net.send({ t: 'drive' }, true, pl.id);
}
function startDriving() {
  P.driving = true; P.emote = null; stopEmote(); if (P.held) { /* предмет остаётся в руках */ }
  document.body.classList.add('driving'); sfx.carStart(CAR.pos);
  toast('Джойстик: газ/тормоз и руль. «Радио» — музыка, «Выйти» — выйти. Сильный удар — машина заглохнет', 4);
}
function leaveCar() {
  P.driving = false; document.body.classList.remove('driving');
  const side = V(Math.cos(CAR.yaw), 0, -Math.sin(CAR.yaw));
  let ex = CAR.pos.clone().addScaledVector(side, 1.6);
  if (solidCell(1, Math.floor(ex.x / CS), Math.floor(ex.z / CS))) ex = CAR.pos.clone().addScaledVector(side, -1.6);
  P.pos.set(ex.x, 0, ex.z); P.f = 1;
  if (Net.role === 'client') Net.send({ t: 'r', a: 'carout', car: [r2(CAR.pos.x), r2(CAR.pos.z), r2(CAR.yaw), CAR.dead ? 1 : 0] }, true); else CAR.driver = null;
}
function toggleRadio() { CAR.radio = (CAR.radio + 1) % 3; CAR.radioT = 0; sfx.radio(); toast(['Радио выключено', 'Радио: танцевальная волна', 'Радио: волна дрона'][CAR.radio], 1.8); }
function updateCarVisual(dt) {
  if (!CAR.mesh) return;
  const m = CAR.mesh;
  if (!P.driving) { m.position.lerp(CAR.pos, Math.min(1, dt * 10)); m.rotation.y = lerpAngle(m.rotation.y, CAR.yaw, Math.min(1, dt * 10)); }
  else { m.position.copy(CAR.pos); m.rotation.y = CAR.yaw; }
  m.userData.wheels.forEach(w => w.children[0].rotation.x += CAR.sp * dt * 3);
  m.userData.beams.forEach(b => b.visible = !!CAR.driver && !CAR.dead);
  if (CAR.dead) { CAR.smokeT -= dt; if (CAR.smokeT <= 0) { CAR.smokeT = 0.5; puffSmoke(V(CAR.pos.x + Math.sin(CAR.yaw) * 1.6, 1.0, CAR.pos.z + Math.cos(CAR.yaw) * 1.6)); } }
}
function puffSmoke(pos) {
  if (!BOOM) spawnBoom(V(0, -50, 0));
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: BOOM.smokeT, transparent: true, depthWrite: false })); m.position.copy(pos); m.scale.setScalar(0.6); G.dyn.add(m);
  G.fxs.push({ m, t: 0, life: 2.5, upd: (e, k, dt) => { e.m.position.y += dt * 0.8; e.m.scale.setScalar(0.6 + k * 2.2); e.m.material.opacity = 0.5 * (1 - k); } });
}
// камера сзади машины
function carCamera() {
  const back = V(-Math.sin(CAR.yaw), 0, -Math.cos(CAR.yaw));
  const want = CAR.pos.clone().addScaledVector(back, 7.2); want.y = 3.4;
  if (!G.carCam || G.carCam.distanceTo(want) > 12) G.carCam = want.clone(); else G.carCam.lerp(want, 0.15);
  camera.position.copy(G.carCam);
  camera.lookAt(CAR.pos.x + Math.sin(CAR.yaw) * 5, 1.3, CAR.pos.z + Math.cos(CAR.yaw) * 5);
}

// ================= ВЗРЫВЫ (ракетница, дрон) =================
let BOOM = null;
function softTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  // клочья, чтобы не было идеального круга
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = 20 + Math.random() * 34; g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 6 + Math.random() * 10, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function spawnBoom(pos) {
  if (!BOOM) BOOM = {
    fireT: softTex([[0, 'rgba(255,250,210,1)'], [0.25, 'rgba(255,190,80,0.95)'], [0.55, 'rgba(230,80,20,0.6)'], [1, 'rgba(120,20,0,0)']]),
    smokeT: softTex([[0, 'rgba(90,85,80,0.85)'], [0.5, 'rgba(60,56,52,0.5)'], [1, 'rgba(40,38,36,0)']]),
    chip: new THREE.BoxGeometry(0.08, 0.03, 0.12), chipM: new THREE.MeshLambertMaterial({ color: 0x3a2618 }),
    ember: new THREE.SpriteMaterial({ color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false }),
    scorch: new THREE.MeshBasicMaterial({ map: softTex([[0, 'rgba(0,0,0,0.9)'], [0.6, 'rgba(10,6,4,0.6)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }),
  };
  const sprite = (tex, add, life, upd, sc = 1) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); m.position.copy(pos); m.scale.setScalar(sc); G.dyn.add(m); G.fxs.push({ m, t: 0, life, upd }); return m; };
  const mesh = (geo, mat, life, upd) => { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); G.dyn.add(m); G.fxs.push({ m, t: 0, life, upd, keepMat: true }); return m; };
  for (let i = 0; i < 6; i++) { const off = V(rand(-0.5, 0.5), rand(-0.2, 0.6), rand(-0.5, 0.5)); const delay = i * 0.04; sprite(BOOM.fireT, true, 0.9, (e, k) => { const kk = Math.max(0, k - delay); e.m.position.copy(pos).addScaledVector(off, 1 + kk * 2); e.m.scale.setScalar(0.5 + kk * 4.2); e.m.material.opacity = Math.max(0, 1 - kk * 1.2); e.m.material.rotation = i + kk; }); }
  for (let i = 0; i < 10; i++) {
    const v = V(rand(-0.9, 0.9), rand(0.5, 1.6), rand(-0.9, 0.9));
    sprite(BOOM.smokeT, false, rand(3, 5), (e, k, dt) => { e.m.position.addScaledVector(v, dt * (1 - k * 0.7)); e.m.scale.setScalar(1.2 + k * 4); e.m.material.opacity = Math.min(1, k * 6) * 0.55 * (1 - k); e.m.material.rotation += dt * 0.3; });
  }
  for (let i = 0; i < 14; i++) {
    const v = V(rand(-5, 5), rand(2, 6), rand(-5, 5)); const floorY = pos.y - 1.2;
    sprite(null, true, rand(0.6, 1.4), (e, k, dt) => { v.y -= 9 * dt; e.m.position.addScaledVector(v, dt); e.m.material.opacity = 1 - k; }, 0.08).material = BOOM.ember.clone();
  }
  for (let i = 0; i < 18; i++) {
    const v = V(rand(-6, 6), rand(2, 7), rand(-6, 6)); const floorY = pos.y - 1.4;
    mesh(BOOM.chip, BOOM.chipM, rand(3, 6), (e, k, dt) => { v.y -= 12 * dt; e.m.position.addScaledVector(v, dt); if (e.m.position.y < floorY) { e.m.position.y = floorY; v.multiplyScalar(0.3); } e.m.rotation.x += dt * 9; e.m.rotation.z += dt * 5; });
  }
  // копоть на полу
  const [cx, cz] = cellOf(pos); let fy = FLOOR_Y[0]; for (let f = 3; f >= 0; f--) if (FLOOR_Y[f] <= pos.y + 0.2) { fy = heightAt(f, pos.x, pos.z); break; }
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), BOOM.scorch); sc.rotation.x = -Math.PI / 2; sc.position.set(pos.x, fy + 0.02, pos.z); G.dyn.add(sc);
  G.boomLight = { pos: pos.clone(), t: 0.7 };
  shakeFrom(pos);
}
function shakeFrom(pos) { const d = pos.distanceTo(camera.position); G.shake = Math.max(G.shake, Math.max(0, 1 - d / 22)); }
function updateFx(dt) {
  for (let i = G.fxs.length - 1; i >= 0; i--) {
    const e = G.fxs[i]; e.t += dt; const k = Math.min(1, e.t / e.life);
    e.upd(e, k, dt);
    if (k >= 1) { G.dyn.remove(e.m); if (!e.keepMat && e.m.material.dispose) e.m.material.dispose(); G.fxs.splice(i, 1); }
  }
  if (G.boomLight) { G.boomLight.t -= dt; if (G.boomLight.t <= 0) G.boomLight = null; }
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.25; camera.position.y += (Math.random() - 0.5) * G.shake * 0.25; G.shake = Math.max(0, G.shake - dt * 1.2); }
}
function blowDoor(d) {
  if (d.blown) return;
  d.blown = true; d.locked = false; d.open = true; maps[d.f][d.z][d.x] = '.'; d.piv.visible = false;
}
function explodeAt(pos, f, by, opts) {
  if (opts && opts.shahed && !G.esc.gateOpen && Math.hypot(pos.x - cc(9), pos.z - CS * 0.5) < 4.5 && f === 1) { G.esc.gateOpen = true; G.esc.gateBlown = true; maps[1][0][9] = '.'; if (gateM) gateM.visible = false; setTimeout(() => alltoast('ШАХЕД разнёс ворота! За ними дорога — у ворот лежит карта', 4), 300); }
  fx.boom(pos); noise(f, pos.clone(), 30, by || null);
  spawnBoom(pos);
  if (Net.role === 'host') Net.send({ t: 'boom', p: pv(pos) });
  for (const e of [hostess, watchman, thing, yard, adam]) {
    if (!e || e.state === 'off' || (e === adam && !AD.active) || e.pos.distanceTo(pos) > 4.5) continue;
    if (e === adam && AD.fight) { const pl = PL.get(AD.fight); if (pl) pl.aura = false; AD.fight = null; if (AB.on) { AB.on = false; P.ui = false; $('auraGame').classList.add('hidden'); } }
    startRag(e, pos); fx.hurt(e.pos);
    if (e === thing) thingFlee(pos); else sayW(whoOf(e), 'hurt', e.pos);
    if (e === yard) yardDrop();
    if (busy(e) || e.state === 'todance') { e.state = e === hostess ? 'investigate' : 'walk'; G.danceLeft = 0; }
  }
  if (!doll.off && doll.stun <= 0 && f === 1 && Math.hypot(doll.x - pos.x, DOLL_Z - pos.z) < 3.5) stunDoll(60, by);
  for (const o of G.objects) {
    if (o.broken || o.heldBy || o.locked || o.kind === 'proj' || o.f !== f || o.pos.distanceTo(pos) > 3.2) continue;
    if (o.breaks) { breakObj(o); continue; }
    const dir = o.pos.clone().sub(pos); dir.y = 0.5; dir.normalize();
    o.vel.copy(dir.multiplyScalar(6)); o.rest = false; o.dirty = true; o.thrown = false;
  }
  for (const d of G.doors.values()) if (d.f === f && Math.hypot(cc(d.x) - pos.x, cc(d.z) - pos.z) < 3 && !d.blown) blowDoor(d);
  for (const t of G.traps) if (t.armed && t.f === f && t.pos.distanceTo(pos) < 3) springTrap(t, null);
  if (by) ptoast(by, 'БА-БАХ!', 1.5);
}

// ================= РЭГДОЛЛ: взрыв отшвыривает персонажа, он валяется 30 секунд =================
const RAG_TIME = 30;
function startRag(e, from, time = RAG_TIME, power0) {
  const dir = e.pos.clone().sub(from); dir.y = 0; const d = dir.length() || 1; dir.divideScalar(d);
  const power = power0 !== undefined ? power0 : 4 + Math.max(0, 4.5 - d) * 2.2;
  const soft = power0 !== undefined;   // попадание предметом/выстрелом: просто валится навзничь, без кувырков
  e.rag = soft ? { vel: V(dir.x * power * 0.5, 1.6, dir.z * power * 0.5), spinX: -3.4, spinZ: (Math.random() - 0.5) * 0.8, air: true, seed: Math.random() * 10 }
    : { vel: V(dir.x * power, 4.5 + power * 0.3, dir.z * power), spinX: -(5 + Math.random() * 4), spinZ: (Math.random() - 0.5) * 6, air: true, seed: Math.random() * 10 };
  e.stun = time; e.path = []; e.tp = null; e.witness = null; e.wait = 0;
  e.yaw = Math.atan2(-dir.x, -dir.z);   // летит спиной вперёд
}
function updateRag(e, dt) {
  const r = e.rag; if (!r) return false;
  e.stun -= dt;
  if (r.air) {
    r.vel.y -= 14 * dt;
    const nx = e.pos.x + r.vel.x * dt, nz = e.pos.z + r.vel.z * dt;
    if (!solidCell(e.f, Math.floor(nx / CS), Math.floor(e.pos.z / CS))) e.pos.x = nx; else r.vel.x *= -0.3;
    if (!solidCell(e.f, Math.floor(e.pos.x / CS), Math.floor(nz / CS))) e.pos.z = nz; else r.vel.z *= -0.3;
    e.pos.y += r.vel.y * dt;
    e.tiltX = (e.tiltX || 0) + r.spinX * dt; e.tiltZ = (e.tiltZ || 0) + r.spinZ * dt;
    const fl = heightAt(e.f, e.pos.x, e.pos.z);
    if (e.pos.y <= fl) {
      e.pos.y = fl;
      if (Math.abs(r.vel.y) > 3) { r.vel.y = -r.vel.y * 0.3; r.vel.x *= 0.5; r.vel.z *= 0.5; fx.impact(e.pos, 6); }
      else { r.air = false; r.vel.set(0, 0, 0); const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v)); e.tiltX = wrap(e.tiltX); e.tiltZ = wrap(e.tiltZ); }
    }
  } else {
    // лежит на спине, руки-ноги раскиданы; под конец встаёт
    const up = e.stun < 1.5 ? 1 - e.stun / 1.5 : 0;
    e.tiltX = THREE.MathUtils.lerp(e.tiltX, -Math.PI / 2 * (1 - up), Math.min(1, dt * 8));
    e.tiltZ = THREE.MathUtils.lerp(e.tiltZ, (r.seed % 1 - 0.5) * 0.3 * (1 - up), Math.min(1, dt * 8));
    e.pos.y = heightAt(e.f, e.pos.x, e.pos.z);
  }
  if (e.stun <= 0) {
    e.rag = null; e.stun = 0; e.tiltX = 0; e.tiltZ = 0; e.path = [];
    e.state = e === watchman ? 'walk' : e === thing ? 'wander' : e === hostess ? 'investigate' : 'patrol';
    if (e === watchman) e.timer = 30;
    // если отлетел в стену — вернуть на ближайшую проходимую клетку
    const [cx, cz] = cellOf(e.pos); const id = nearestAllowed(e.f, cx, cz, e.allow);
    if (id !== null && (NX(id) !== cx || NZ(id) !== cz)) { e.pos.x = cc(NX(id)); e.pos.z = cc(NZ(id)); }
    return false;
  }
  return true;
}
function ragPose(e) {
  const U = e.mesh.userData; if (!U.legs) { if (U.core) U.core.scale.set(1.3, 0.6, 1.3); return; }
  const sd = (e.rag && e.rag.seed) || (e.pos.x * 3.1 % 10), t = now(), air = e.rag ? e.rag.air : false;
  const flop = air ? Math.sin(t * 18 + sd) * 0.5 : 0;
  U.hips.position.y = air ? (U.kind === 'hostess' ? 0.92 : 1.0) : 0.25;
  U.spine.rotation.x = 0.1; U.spine.rotation.z = (sd % 1 - 0.5) * 0.4;
  U.arms.forEach((a, i) => { const s = i ? 1 : -1; a.a.rotation.x = -1.4 + Math.sin(sd + i) * 0.6 + flop; a.a.rotation.z = s * (1.1 + Math.cos(sd * 2 + i) * 0.3); a.b.rotation.x = -0.3 - Math.abs(Math.sin(sd * 3 + i)) * 0.6; if (a.fingers) a.fingers.forEach(f => f.rotation.x = 0.8); });
  U.legs.forEach((l, i) => { const s = i ? -1 : 1; l.a.rotation.x = -0.2 + Math.sin(sd * 1.7 + i) * 0.4 - flop; l.a.rotation.z = s * (0.25 + Math.abs(Math.cos(sd + i)) * 0.3); l.b.rotation.x = 0.3 + Math.abs(Math.sin(sd * 2.3 + i)) * 0.8; });
  if (U.neck) U.neck.rotation.x = 0.4 + flop * 0.5; if (U.head) { U.head.rotation.z = (sd % 1 - 0.5) * 0.8; U.head.rotation.y = 0; }
  if (U.jaw && U.jaw.rotation) U.jaw.rotation.x = 0.35;
}

// ================= ПРИЗРАК =================
let GHOST_MAT = null;
function setGhostLook(av, on) {
  if (!GHOST_MAT) GHOST_MAT = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
  if (!!av.userData.ghostOn === on) return;
  av.userData.ghostOn = on;
  av.traverse(o => { if (o.isMesh && o !== av.userData.beam) { if (on) { o.userData.om = o.userData.om || o.material; o.material = GHOST_MAT; } else if (o.userData.om) o.material = o.userData.om; } });
}
const floorAtY = (y) => y >= 5.9 ? 3 : y >= 2.9 ? 2 : y >= -0.1 ? 1 : 0;
const doorLocked = (k) => { const d = G.doors.get(k); return d && d.locked; };
function ghostOK(x, y, z) {
  if (x < CS * 1.05 || z < CS * 1.05 || x > (W - 1.05) * CS || z > (H - 1.05) * CS) return false;
  if (y < FLOOR_Y[0] || y > 6.9) return false;
  const f = floorAtY(y), cx = Math.floor(x / CS), cz = Math.floor(z / CS), ch = cell(f, cx, cz);
  if (ch === null || ch === ' ' || ch === 'f') return false;
  if (ch === '#') { let open = false; for (let dz = -1; dz <= 1 && !open; dz++) for (let dx = -1; dx <= 1; dx++) { const n = cell(f, cx + dx, cz + dz); if (n && n !== '#' && n !== ' ') { open = true; break; } } if (!open) return false; }
  const zn = zoneOf(f, cx, cz);
  if (zn === 'basement' && doorLocked('1,15,10')) return false;
  if (zn === 'secret' && !furn.secret.open) return false;
  if (zn === 'attic' && !furn.hatch.open) return false;
  if (zn === 'shed' && doorLocked(SHED_DOOR) && !(G.doors.get(SHED_DOOR) || {}).open) return false;
  if (zn === 'balcony' && doorLocked('2,9,3')) return false;
  return true;
}
function ghostMove(dt, mx, mz) {
  const sp = 3.6, cp = Math.cos(P.pitch);
  const fwd = V(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp), right = V(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  const v = fwd.multiplyScalar(-mz).add(right.multiplyScalar(mx)).multiplyScalar(sp * dt);
  const o = P.pos.clone();
  if (ghostOK(P.pos.x + v.x, P.pos.y, P.pos.z)) P.pos.x += v.x;
  if (ghostOK(P.pos.x, P.pos.y, P.pos.z + v.z)) P.pos.z += v.z;
  if (ghostOK(P.pos.x, P.pos.y + v.y, P.pos.z)) P.pos.y += v.y;
  P.f = floorAtY(P.pos.y + 0.3); P.moving = o.distanceTo(P.pos) / Math.max(dt, 1e-4); P.eye = 1.3; P.idle = 0;
}

// ---------- Кукла ----------
const DOLL_Z = 9 * CS, DOLL_X0 = cc(3), DOLL_X1 = cc(16), DOLL_Y = 2.55;
function updateDoll(dt) {
  const d = doll;
  if (d.stun > 0) { d.stun -= dt; animDoll(dt); return; }
  if (d.wait > 0) { d.wait -= dt; } else {
    d.x += d.dir * 1.25 * D.speed * dt;
    if (d.x > DOLL_X1) { d.x = DOLL_X1; d.dir = -1; d.wait = 1.6; }
    if (d.x < DOLL_X0) { d.x = DOLL_X0; d.dir = 1; d.wait = 1.6; }
  }
  d.cool -= dt;
  animDoll(dt);
  if (d.cool > 0) return;
  for (const pl of players()) {
    if (pl.f !== 1 || !targetable(pl) || Math.abs(pl.pos.z - DOLL_Z) >= 3.4) continue;
    const dx = pl.pos.x - d.x;
    if (Math.sign(dx) === d.dir && Math.abs(dx) < (pl.crouch && !pl.light ? 3.5 : 7.5) && los(1, V(d.x, 0, DOLL_Z), pl.pos)) {
      const dp = V(d.x, DOLL_Y, DOLL_Z);
      fx.dollRing(dp); fx.giggle(dp); d.cool = 7; ptoast(pl, 'Кукла звенит!');
      sayW('doll', 'alarm', dp);
      noise(1, pl.pos.clone(), 60, pl);
      if (hostess.stun <= 0 && !busy(hostess)) startChase(hostess, pl);
      if (watchman.state === 'sleep') wakeWatch();
      if (watchman.state !== 'chase' && !busy(watchman)) { const [x, z] = cellOf(pl.pos); watchman.goToCell(1, x, z); }
      break;
    }
  }
}
function stunDoll(sec, pl) {
  const dp = V(doll.x, DOLL_Y, DOLL_Z);
  doll.stun = sec * D.stun; fx.giggle(dp); sayW('doll', 'hurt', dp);
  if (!G.dollKey) {
    G.dollKey = true;
    const o = addObject('smallkey', 1, Math.floor(doll.x / CS), 9, 'item');
    o.pos.set(doll.x, DOLL_Y - 0.4, DOLL_Z); o.rest = false; o.vel.set(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)); o.mesh.position.copy(o.pos);
    announceObject(o);
    if (pl) ptoast(pl, 'Из куклы что-то выпало!');
  } else if (pl) ptoast(pl, 'Кукла сбита');
}

// ---------- Нечто ----------
// Новое Нечто в подвале: живёт в решётках-отдушинах в полу и ползает под полом.
// · идёт на звук (бег, падения, двери) и на свет фонаря — фонарь издалека его притягивает;
// · но если светить ему прямо в «лицо» ~1 секунду — оно визжит и уходит под пол;
// · время от времени ныряет в отдушину и вылезает из той, что ближе к игроку (по полу слышно скрежет);
// · рядом с ним лампы в подвале мигают.
const THING_VENTS = [[0, 13, 15], [0, 9, 15], [0, 11, 10], [0, 7, 12], [0, 4, 13], [0, 11, 4], [0, 6, 9]];
function nearestVent(pos, far) {
  let best = THING_VENTS[0], bd = far ? -1 : 1e9;
  for (const v of THING_VENTS) { const d = Math.hypot(cc(v[1]) - pos.x, cc(v[2]) - pos.z); if (far ? d > bd : d < bd) { bd = d; best = v; } }
  return best;
}
function thingDive(t, toward, delay) {   // нырнуть в ближайшую отдушину и вылезти у другой
  const v = nearestVent(t.pos);
  t.state = 'sink'; t.timer = 0.8; t.diveVent = toward ? nearestVent(toward) : nearestVent(t.pos, true); t.diveT = delay; t.path = [];
  t.pos.x = cc(v[1]); t.pos.z = cc(v[2]); fx.roar(t.pos);
}
function thingHear(f, pos, radius, pl) {
  const t = thing;
  if (f !== 0 || !t || t.state === 'off' || t.stun > 0 || t.state === 'sink' || t.state === 'lurk' || t.state === 'rise' || t.state === 'recoil') return;
  if (t.pos.distanceTo(pos) > radius * 1.3 * D.hear) return;
  t.state = 'hunt'; t.tp = pl && targetable(pl) ? pl : null; t.heard = pos.clone(); t.repath = 0;
}
function thingInBeam(t, pl) {
  if (!pl.light || pl.f !== 0 || !targetable(pl)) return false;
  const eye = V(pl.pos.x, pl.pos.y + 1.5, pl.pos.z), c = V(t.pos.x, t.pos.y + 0.6, t.pos.z), v = c.clone().sub(eye), d = v.length();
  if (d > 9) return false;
  const dir = V(-Math.sin(pl.yaw) * Math.cos(pl.pitch), Math.sin(pl.pitch), -Math.cos(pl.yaw) * Math.cos(pl.pitch));
  return v.normalize().dot(dir) > 0.93 && los(0, eye, c);
}
function updateThing(dt) {
  const t = thing;
  animThing();
  t.mesh.visible = t.state !== 'lurk' && t.state !== 'off';
  if (updateRag(t, dt)) { ragPose(t); t.sync(); return; }
  if (droneScare(t, dt)) { t.sync(); return; }
  if (t.stun > 0) { t.stun -= dt; t.sync(); return; }
  const sp = D.speed;
  const inB = players().filter(p => p.f === 0 && targetable(p) && !inSecret(p));
  // свет фонаря: прямо в него — жжёт, просто включённый неподалёку — притягивает
  if (t.state !== 'lurk' && t.state !== 'sink' && t.state !== 'rise') {
    let burning = null;
    for (const pl of inB) if (thingInBeam(t, pl)) { burning = pl; break; }
    if (burning) {
      t.burn = (t.burn || 0) + dt; t.moving = false;
      if (t.state !== 'recoil') { t.state = 'recoil'; fx.roar(t.pos); }
      if (t.burn > 1.0) { t.burn = 0; fx.roar(t.pos); ptoast(burning, 'Нечто взвизгнуло от света и ушло под пол!', 2.5); thingDive(t, null, rand(10, 15)); }
      t.sync(); return;
    } else { t.burn = Math.max(0, (t.burn || 0) - dt * 0.5); if (t.state === 'recoil') t.state = 'hunt'; }
    if (t.state !== 'hunt' && t.state !== 'flee') {
      const lit = inB.find(p => p.light && distTo(t, p) < 14 && los(0, V(t.pos.x, 0.6 + FLOOR_Y[0], t.pos.z), V(p.pos.x, p.pos.y + 1.2, p.pos.z)));
      const close = inB.find(p => distTo(t, p) < 2.6);
      const pl = close || lit;
      if (pl) { t.state = 'hunt'; t.tp = pl; t.repath = 0; fx.roar(t.pos); if (!close) ptoast(pl, 'Свет фонаря что-то привлёк…'); }
    }
  }
  switch (t.state) {
    case 'idle': case 'wander':
      if (!t.path.length) { t.goToCell(...THING_VENTS[(Math.random() * THING_VENTS.length) | 0]); t.state = 'wander'; }
      if (t.step(1.1 * sp, dt)) { t.state = 'block'; t.timer = rand(3, 6); }
      // засада: ныряет в отдушину и вылезает ближе к тому, кто в подвале
      t.ambushT = (t.ambushT === undefined ? 20 : t.ambushT) - dt;
      if (t.ambushT <= 0 && inB.length) { t.ambushT = rand(22, 36); const tgt = inB[(Math.random() * inB.length) | 0]; thingDive(t, tgt.pos.clone(), rand(4, 6)); }
      break;
    case 'block': t.timer -= dt; if (t.timer <= 0) t.state = 'wander'; break;
    case 'flee': if (t.step(3.0, dt)) { t.state = 'block'; t.timer = 4; } break;
    case 'sink': t.timer -= dt; t.pos.y = FLOOR_Y[0] - (0.8 - Math.max(0, t.timer)) * 1.4; if (t.timer <= 0) { t.state = 'lurk'; t.scrapeT = 0; } break;
    case 'lurk': {   // ползёт под полом: скрежет слышно, а самого не видно
      t.diveT -= dt; t.scrapeT -= dt;
      const v = t.diveVent || THING_VENTS[0];
      const gx = cc(v[1]), gz = cc(v[2]), dx = gx - t.pos.x, dz = gz - t.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.1) { const mv = Math.min(d, 3.2 * dt); t.pos.x += dx / d * mv; t.pos.z += dz / d * mv; }
      if (t.scrapeT <= 0) { t.scrapeT = 0.55; fx.scrape(V(t.pos.x, FLOOR_Y[0], t.pos.z)); }
      if (t.diveT <= 0 && d < 0.2) { t.state = 'rise'; t.timer = 1.0; t.pos.x = gx; t.pos.z = gz; fx.roar(t.pos); }
      break;
    }
    case 'rise': t.timer -= dt; t.pos.y = FLOOR_Y[0] - Math.max(0, t.timer) * 1.1; if (t.timer <= 0) { t.pos.y = FLOOR_Y[0]; const pl = inB.sort((a, b) => distTo(t, a) - distTo(t, b))[0]; if (pl && distTo(t, pl) < 10) { t.state = 'hunt'; t.tp = pl; t.repath = 0; } else t.state = 'wander'; } break;
    case 'hunt': {
      const tp = getTp(t);
      t.repath -= dt;
      if (t.repath <= 0) { t.repath = 0.5; if (tp && tp.f === 0) { const [x, z] = cellOf(tp.pos); t.goToCell(0, x, z); } else if (t.heard) { const [x, z] = cellOf(t.heard); t.goToCell(0, x, z); t.heard = null; } }
      // в темноте быстрее, под лампой — медленнее
      t.step(2.4 * sp, dt);
      if (!tp || tp.f !== 0 || inSecret(tp) || !targetable(tp)) { t.lost = (t.lost || 0) + dt; if (t.lost > 3) { t.state = 'wander'; t.lost = 0; t.path = []; } } else t.lost = 0;
      break;
    }
  }
  t.g = (t.g || 0) - dt; if (t.g <= 0 && t.state !== 'lurk') { fx.gurgle(t.pos); t.g = t.state === 'hunt' ? 1.6 : 4; }
  G.thingNear = t.state === 'hunt' || t.state === 'rise' ? t.pos : null;
  if (t.state !== 'lurk' && t.state !== 'sink') for (const pl of players()) if (pl.f === 0 && targetable(pl) && distTo(t, pl) < (t.state === 'block' ? 1.4 : 1.15)) { caught(t, pl); break; }
  t.sync();
}
function thingFlee(from) {
  if (thing.state === 'off') return;
  let best = THING_WP[0], bd = -1;
  for (const w of THING_WP) { const d = Math.hypot(cc(w[1]) - from.x, cc(w[2]) - from.z); if (d > bd) { bd = d; best = w; } }
  thing.state = 'flee'; thing.goToCell(...best); fx.roar(thing.pos);
}

// ---------- двери ----------
function setDoor(d, open) {
  if (d.locked) return;
  if (!open) {
    const occ = [...players(), hostess, watchman].some(e => e.f === d.f && cellOf(e.pos)[0] === d.x && cellOf(e.pos)[1] === d.z);
    if (occ) return;
  }
  d.open = open; fx.door(V(cc(d.x), FLOOR_Y[d.f] + 1.2, cc(d.z)), open);
  noise(d.f, V(cc(d.x), FLOOR_Y[d.f], cc(d.z)), 3.5, null);
}
function buildDoors(group) {
  G.doors.clear();
  const wood = LM({ map: T.wood, color: 0x9a7a5a });
  const trim = LM({ map: T.wood, color: 0x5a4030 });
  const knob = LM({ color: 0xa08030, emissive: 0x201000 });
  const boardM = new THREE.MeshLambertMaterial({ map: T.wood, color: 0xb09070 });
  const wallM = [world.mats.wall1, world.mats.wall2];
  const lintels = new THREE.Group(); group.add(lintels);
  const isWall = (c) => c === '#' || c === 'q';
  for (let f = 1; f < 3; f++) for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = maps[f][z][x];
    const lr = isWall(cell(f, x - 1, z)) && isWall(cell(f, x + 1, z));
    const ud = isWall(cell(f, x, z - 1)) && isWall(cell(f, x, z + 1));
    if ((lr || ud) && '.cDL'.includes(ch) && insideHouse(x, z)) {
      const lint = lr ? box(CS, 0.56, CS * 0.98, wallM[f - 1]) : box(CS * 0.98, 0.56, CS, wallM[f - 1]);
      lint.position.set(cc(x), FLOOR_Y[f] + 2.69, cc(z)); lintels.add(lint);   // верх чуть ниже пола этажа выше — без мерцания
    }
    if (ch !== 'D' && ch !== 'L') continue;
    const piv = new THREE.Group();
    const panel = new THREE.Group();
    panel.add(box(CS - 0.12, 2.38, 0.07, wood, 0, 0, 0));
    for (const yy of [0.55, -0.45]) for (const zz of [0.04, -0.04]) panel.add(box(CS - 0.6, 0.75, 0.02, trim, 0, yy, zz));
    for (const zz of [0.06, -0.06]) panel.add(box(0.08, 0.08, 0.05, knob, CS / 2 - 0.25, 0, zz));
    const key = f + ',' + x + ',' + z;
    const lockMats = new Set();
    if (ch === 'L') {
      if (LOCKS[key] === 'screwdriver') { lockMats.add(boardM); for (const yy of [0.6, -0.1, -0.7]) { const b = box(CS - 0.05, 0.22, 0.06, boardM, 0, yy, -0.08); b.rotation.z = (Math.round(yy * 10) % 3 - 1) * 0.08; panel.add(b); } }
      else { const m1 = new THREE.MeshLambertMaterial({ color: LOCKS[key] === 'symlock' ? 0x8a7020 : 0x8a4a20 }), m2 = new THREE.MeshLambertMaterial({ color: 0x5a5a5a }); lockMats.add(m1); lockMats.add(m2); for (const zz of [0.08, -0.08]) { panel.add(box(0.2, 0.25, 0.1, m1, CS / 2 - 0.25, -0.2, zz)); panel.add(box(0.5, 0.05, 0.12, m2, CS / 2 - 0.3, 0.05, zz)); } }
    }
    panel.position.set(CS / 2, 1.2, 0); bakeRig(panel); piv.add(panel);
    if (lr) piv.position.set(x * CS + 0.06, FLOOR_Y[f], cc(z));
    else { piv.position.set(cc(x), FLOOR_Y[f], z * CS + 0.06); piv.rotation.y = -Math.PI / 2; }
    piv.userData.base = piv.rotation.y;
    group.add(piv);
    G.doors.set(key, { f, x, z, open: false, locked: ch === 'L', needs: LOCKS[key], t: 0, piv, panel, lockMats });
  }
  bakeRig(lintels);
}
function unlockDoor(d) {
  d.locked = false; maps[d.f][d.z][d.x] = 'D';
  d.panel.traverse(c => { if (c.isMesh && d.lockMats.has(c.material)) c.visible = false; });
}

// ---------- предметы и физика ----------
function surfaceUnder(f, x, z, y) {
  if (zoneAt(x, z)) return 0;
  let best = heightAt(f, x, z);
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), ch = cell(f, cx, cz);
  if (ch === ' ' && f > 0) best = -99;
  if (ch === 'w') best = FLOOR_Y[f] - 0.5;
  for (const s of SURF[f]) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && y >= s.top - 0.18 && s.top > best) best = s.top;
  return best;
}
function solidObj(f, x, z, y) {
  const zn = zoneAt(x, z); if (zn) return zoneSolid(zn, x, z);   // за воротами, в бане и т.п. — свои стены
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS), ch = cell(f, cx, cz);
  if (ch === null) return true;
  if ('#fq'.includes(ch)) return true;
  if (ch === 'H') return !furn.secret.open;
  if (ch === 'G') return !G.esc.gateOpen;
  if (ch === 'D' || ch === 'L') { const d = doorAt(f, cx, cz); return !d || d.t < 0.85; }
  for (const c of COLS[f]) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y < c.y1 - 0.03 && y > c.y0 - 0.1) return true;
  return false;
}
function regObject(o) { o.nid = o.nid || G.nidSeq++; G.objects.push(o); G.byNid.set(o.nid, o); o.tgt = o.pos.clone(); return o; }
function spotPos(f, x, z) {
  const cxw = cc(x), czw = cc(z);
  const surf = SURF[f].find(s => s.x1 > x * CS && s.x0 < (x + 1) * CS && s.z1 > z * CS && s.z0 < (z + 1) * CS);
  const pos = V(cxw, FLOOR_Y[f], czw);
  if (surf) { pos.set(rand(surf.x0 + 0.12, Math.max(surf.x0 + 0.13, surf.x1 - 0.12)), surf.top, rand(surf.z0 + 0.1, Math.max(surf.z0 + 0.11, surf.z1 - 0.1))); return pos; }
  for (let i = 0; i < 20; i++) {
    const px = cxw + rand(-0.6, 0.6), pz = czw + rand(-0.6, 0.6);
    if (!COLS[f].some(c => px > c.x0 - 0.15 && px < c.x1 + 0.15 && pz > c.z0 - 0.15 && pz < c.z1 + 0.15)) { pos.x = px; pos.z = pz; break; }
  }
  pos.y = surfaceUnder(f, pos.x, pos.z, pos.y + 2);
  if (pos.y < FLOOR_Y[f] - 1) pos.y = FLOOR_Y[f];
  return pos;
}
function addObject(id, f, x, z, kind) {
  const mesh = makeItemMesh(id, kind === 'item' && D.glow);
  const pos = spotPos(f, x, z);
  mesh.position.copy(pos); mesh.rotation.y = rand(0, 6.28);
  G.dyn.add(mesh);
  const def = ITEMS[id] || PROPS[id];
  return regObject({ id, kind, mesh, f, pos, vel: V(), rest: true, broken: false, home: { f, pos: pos.clone() }, name: def ? def.name : id, breaks: kind === 'prop' && PROPS[id] && PROPS[id].breaks, heldBy: null });
}
function removeObj(o) { o.broken = true; o.dirty = true; if (o.mesh.parent) o.mesh.parent.remove(o.mesh); }
const packFull = (o) => [o.nid, o.id, o.kind, o.f, r2(o.pos.x), r2(o.pos.y), r2(o.pos.z), r2(o.mesh.rotation.y), o.broken ? 1 : 0, o.locked ? 1 : 0, o.heldBy || ''];
const packObj = (o) => [o.nid, o.f, r2(o.pos.x), r2(o.pos.y), r2(o.pos.z), r2(o.mesh.rotation.y), o.broken ? 1 : 0, o.locked ? 1 : 0, o.heldBy || '', o.kind === 'ammo' ? 1 : 0];
function announceObject(o) { if (Net.role === 'host') Net.send({ t: 'o+', o: [packFull(o)] }, true); }
function objFromNet(a) {
  const [nid, id, kind, f, x, y, z, ry, broken, locked, heldBy] = a;
  if (G.byNid.has(nid)) return G.byNid.get(nid);
  const mesh = makeItemMesh(id, kind === 'item' && D.glow); mesh.position.set(x, y, z); mesh.rotation.y = ry;
  const def = ITEMS[id] || PROPS[id];
  const o = regObject({ nid, id, kind, mesh, f, pos: V(x, y, z), vel: V(), rest: true, broken: !!broken, locked: !!locked, home: { f, pos: V(x, y, z) }, name: def ? def.name : id, heldBy: heldBy || null });
  if (!o.broken) G.dyn.add(mesh);
  return o;
}
function applyObj(a) {
  const [nid, f, x, y, z, ry, broken, locked, heldBy, ammo] = a;
  const o = G.byNid.get(nid); if (!o) return;
  o.f = f; o.tgt.set(x, y, z); o.locked = !!locked; o.mesh.rotation.y = ry; if (ammo) o.kind = 'ammo';
  if (broken && !o.broken) { o.broken = true; if (o.mesh.parent) o.mesh.parent.remove(o.mesh); }
  o.heldBy = heldBy || null;
  const holder = o.heldBy ? PL.get(o.heldBy) : null;
  for (const pl of players()) if (!pl.local && pl.held === o && pl !== holder) pl.held = null;
  if (holder && !holder.local) holder.held = o;
  o.mesh.visible = !o.heldBy;
}
function physics(dt) {
  for (const o of G.objects) {
    if (o.rest || o.broken || o.heldBy) continue;
    o.dirty = true;
    o.vel.y -= (o.id === 'flare' ? 4 : 9.8) * dt;
    const r = 0.08;
    let nx = o.pos.x + o.vel.x * dt;
    if (solidObj(o.f, nx + Math.sign(o.vel.x) * r, o.pos.z, o.pos.y + 0.03)) { hitWall(o, Math.abs(o.vel.x)); o.vel.x *= -0.35; nx = o.pos.x; }
    o.pos.x = nx;
    let nz = o.pos.z + o.vel.z * dt;
    if (solidObj(o.f, o.pos.x, nz + Math.sign(o.vel.z) * r, o.pos.y + 0.03)) { hitWall(o, Math.abs(o.vel.z)); o.vel.z *= -0.35; nz = o.pos.z; }
    o.pos.z = nz;
    o.pos.y += o.vel.y * dt;
    const ceilY = zoneAt(o.pos.x, o.pos.z) === 'banya' ? 3.3 : indoor(o.f, Math.floor(o.pos.x / CS), Math.floor(o.pos.z / CS)) && o.f < 3 ? FLOOR_Y[o.f] + 2.9 : 99;
    if (o.pos.y > ceilY) { o.pos.y = ceilY; o.vel.y = -Math.abs(o.vel.y) * 0.3; }
    let s = surfaceUnder(o.f, o.pos.x, o.pos.z, o.pos.y);
    if (s === -99) { if (o.pos.y < FLOOR_Y[o.f]) o.f--; s = surfaceUnder(o.f, o.pos.x, o.pos.z, o.pos.y); }
    o.f = floorFromY(o.f, o.pos.x, o.pos.z, o.pos.y);
    // улетел за пределы или застрял в стене — вернуть на место
    if ((!zoneAt(o.pos.x, o.pos.z) && (o.pos.x < 0.2 || o.pos.z < 0.2 || o.pos.x > W * CS - 0.2 || o.pos.z > H * CS - 0.2)) || o.pos.y < -10) { if (o.kind === 'item') respawnObj(o); else removeObj(o); continue; }
    if (cell(o.f, Math.floor(o.pos.x / CS), Math.floor(o.pos.z / CS)) === 'w' && o.pos.y < FLOOR_Y[o.f] - 0.3) {
      fx.splash(o.pos);
      if (o.kind === 'item') { respawnObj(o); if (o.thrower) ptoast(o.thrower, o.name + ': течение унесло — ищи на прежнем месте'); }
      else removeObj(o);
      continue;
    }
    if (o.pos.y < s && o.id === 'flare') o.boom = true;
    if (o.pos.y < s) {
      const imp = -o.vel.y;
      o.pos.y = s;
      if (imp > 2.2) {
        if (o.breaks && imp + Math.hypot(o.vel.x, o.vel.z) * 0.5 > 5) { breakObj(o); continue; }
        fx.impact(o.pos, imp); noise(o.f, o.pos, Math.min(17, 3 + imp * 1.6), null);
      }
      o.vel.y = imp > 1.5 ? imp * 0.3 : 0; o.vel.x *= 0.62; o.vel.z *= 0.62;
      for (const t of G.traps) if (t.armed && t.f === o.f && Math.hypot(t.pos.x - o.pos.x, t.pos.z - o.pos.z) < 0.36) { springTrap(t, null); if (o.thrower) ptoast(o.thrower, 'Капкан захлопнулся!'); }
      if (Math.hypot(o.vel.x, o.vel.y, o.vel.z) < 0.25) { o.rest = true; o.vel.set(0, 0, 0); o.thrown = false; if (o.id === 'stone') o.kind = 'ammo'; }
    }
    o.mesh.position.copy(o.pos);
    if (!o.rest) { o.mesh.rotation.x += o.vel.length() * dt * 2; o.mesh.rotation.z += o.vel.x * dt; }
    else { o.mesh.rotation.x = 0; o.mesh.rotation.z = 0; }
    if (o.vel.length() > 4.5 && o.thrown) hitEnemies(o);
    if (o.boom && !o.broken) { const bp = o.pos.clone(); removeObj(o); G.flares = G.flares.filter(fl => fl.o !== o); explodeAt(bp, o.f, o.thrower); continue; }
  }
  for (let i = G.flares.length - 1; i >= 0; i--) { const fl = G.flares[i]; fl.life -= dt; if (fl.life <= 0) { removeObj(fl.o); G.flares.splice(i, 1); } }
  updateShards(dt);
}
function updateShards(dt) {
  for (let i = G.shards.length - 1; i >= 0; i--) {
    const s = G.shards[i]; s.t -= dt; s.v.y -= 9.8 * dt; s.m.position.addScaledVector(s.v, dt);
    if (s.m.position.y < s.floor) { s.m.position.y = s.floor; s.v.multiplyScalar(0.3); }
    if (s.t <= 0) { G.dyn.remove(s.m); G.shards.splice(i, 1); }
  }
}
function clientObjects(dt) {
  for (const o of G.objects) {
    if (o.broken) continue;
    if (o.pos.distanceTo(o.tgt) > 3) o.pos.copy(o.tgt); else o.pos.lerp(o.tgt, Math.min(1, dt * 12));
    o.mesh.position.copy(o.pos);
  }
  updateShards(dt);
}
function hitEnemies(o) {
  const proj = o.id === 'stone' || o.id === 'flare';
  const R = proj ? 0.75 : 0.6, big = o.id === 'flare', by = o.thrower;
  for (const e of [hostess, watchman, thing, yard, koch]) {
    if (!e || e.stun > 0 || e.state === 'off' || (e === thing && o.f !== 0)) continue;
    const eh = e === thing ? 0.8 : 1.3;
    if (Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) < R && Math.abs(e.pos.y + eh - o.pos.y) < 1.0) {
      o.vel.multiplyScalar(-0.25); fx.impact(o.pos, 8); fx.hurt(e.pos); if (big) o.boom = true;
      // попадание сбивает с ног: короткий рэгдолл (ракетница — дольше)
      const hitFrom = V(o.pos.x + o.vel.x * 4, e.pos.y, o.pos.z + o.vel.z * 4);
      if (e === thing) { startRag(e, hitFrom, (big ? 4 : 2.5) * D.stun, big ? 5 : 2.5); if (by) ptoast(by, big ? 'Нечто бежит от огня!' : 'Нечто отшатнулось!'); if (big) thingFlee(o.pos); else fx.roar(e.pos); }
      else if (e === koch) { startRag(e, hitFrom, (big ? 10 : 4) * D.stun, big ? 6 : 3); KB.mode = 'search'; KB.last = by ? [...bnLocal(by.pos.x, by.pos.z)] : KB.last; sayW('koch', 'chase', e.pos); if (by) ptoast(by, 'Коч Братан сбит с ног!'); }
      else {
        startRag(e, hitFrom, (big ? 14 : 5) * D.stun, big ? 6 : 3);
        if (busy(e) || e.state === 'todance') { e.state = e === hostess ? 'investigate' : 'walk'; e.timer = 30; G.danceLeft = 0; }
        if (e.state === 'sleep') { e.state = 'walk'; e.timer = 40; }
        sayW(whoOf(e), 'hurt', e.pos);
        if (e === yard) yardDrop();
        if (by) ptoast(by, whoName(e) + ' оглушён(а) на ' + Math.round(e.stun) + ' с');
        if (by && e !== yard) { if (e === hostess) { e.state = 'investigate'; const [x, z] = cellOf(by.pos); e.goToCell(by.f, x, z); } else startChase(watchman, by); }
      }
    }
  }
  if (!doll.off && doll.stun <= 0 && o.f === 1 && Math.hypot(doll.x - o.pos.x, DOLL_Z - o.pos.z) < (proj ? 0.7 : 0.6) && Math.abs(DOLL_Y - 0.3 - o.pos.y) < 0.7) {
    o.vel.multiplyScalar(-0.3); fx.impact(o.pos, 9); stunDoll(big ? 45 : 22, by);
  }
}
function hitWall(o, s) { if (o.id === 'flare') { o.boom = true; return; } if (s > 3) { fx.impact(o.pos, s); noise(o.f, o.pos, Math.min(16, 3 + s * 1.4), null); if (o.breaks && s > 6) breakObj(o); } }
function breakObj(o) {
  removeObj(o); fx.glass(o.pos); noise(o.f, o.pos, 18, null);
  spawnShards(o);
  if (Net.role === 'host') Net.send({ t: 'shards', id: o.id, p: pv(o.pos) });
}
function spawnShards(o) {
  const m = LM({ color: o.id === 'vase' ? 0x2a4a7a : o.id === 'plate' ? 0xd8d0c0 : 0x1f4a20 });
  for (let i = 0; i < 9; i++) { const s = box(0.05, 0.015, 0.04, m); s.position.copy(o.pos); G.dyn.add(s); G.shards.push({ m: s, v: V(rand(-2, 2), rand(1, 3), rand(-2, 2)), t: 8, floor: o.pos.y }); }
}
function respawnObj(o) {
  o.f = o.home.f; o.pos.copy(o.home.pos); o.vel.set(0, 0, 0); o.rest = true; o.thrown = false; o.dirty = true;
  o.mesh.position.copy(o.pos); o.mesh.rotation.set(0, 0, 0);
}

// ---------- руки игрока ----------
function viewMat(m) { m.traverse(c => { if (c.material) { c.material = c.material.clone(); c.material.depthTest = false; c.material.fog = false; c.renderOrder = 10; } }); return m; }
function setHeldView(o) {
  if (heldView) { camera.remove(heldView); heldView = null; }
  P.held = o;
  if (o) {
    o.mesh.visible = false;
    heldView = viewMat(makeItemMesh(o.id, false));
    heldView.position.set(0.3, -0.3, -0.55); heldView.rotation.set(0.3, -0.6, 0);
    heldView.scale.setScalar(o.id === 'plate' || o.id === 'pot' ? 0.55 : 0.8);
    if (o.id === 'oar' || o.id === 'hook' || o.id === 'shovel' || o.id === 'crowbar') { heldView.position.set(0.35, -0.38, -0.9); heldView.rotation.set(0, -1.3, 0.3); }
    camera.add(heldView);
  }
  $('heldName').textContent = o ? o.name : 'ничего';
  updateWeapView();
}
function updateWeapView() {
  if (weapView) { camera.remove(weapView); weapView = null; }
  if (P.weap && !P.held && !P.downed) {
    weapView = viewMat(makeItemMesh(P.weap, false));
    if (P.weap === 'flaregun') { weapView.scale.setScalar(0.75); weapView.position.set(0.24, -0.3, -0.5); weapView.rotation.set(0.1, 1.5, 0); }
    else { weapView.position.set(0.22, -0.3, -0.45); weapView.rotation.set(0.1, -0.2, 0); }
    camera.add(weapView);
  }
  const w = P.weap;
  $('bFire').classList.toggle('hidden', !w);
  $('bSwitch').classList.toggle('hidden', !(P.weapons.slingshot && P.weapons.flaregun));
  $('bFire').textContent = w === 'slingshot' ? 'Рогатка ×' + P.stones : w === 'flaregun' ? 'Ракета ×' + P.flareAmmo : '';
  $('weapName').textContent = w ? '· ' + (w === 'slingshot' ? 'Рогатка ×' + P.stones : 'Ракетница ×' + P.flareAmmo) : '';
  $('cross').classList.toggle('aim', !!w && !P.held);
}
function invChanged(pl) {
  if (pl.local) { setHeldView(pl.held); return; }
  Net.send({ t: 'inv', held: pl.held ? pl.held.nid : -1, w: pl.weapons, weap: pl.weap, st: pl.stones, fl: pl.flareAmmo }, true, pl.id);
}
function camPose() { const dir = V(); camera.getWorldDirection(dir); return { s: camera.getWorldPosition(V()), d: dir }; }
function safeStart(f, cp, dir) {
  let start = cp.clone().addScaledVector(dir, 0.45); start.y -= 0.12;
  if (solidObj(f, start.x, start.z, start.y)) { start = cp.clone(); start.y -= 0.15; }
  return start;
}
function holdFor(pl, o) {
  if (pl.held) dropFor(pl, false, null, null);
  o.heldBy = pl.id; o.rest = true; o.vel.set(0, 0, 0); o.dirty = true; o.mesh.visible = false;
  pl.held = o; invChanged(pl);
}
function dropFor(pl, throwIt, cp, dir) {
  const o = pl.held; if (!o) return;
  if (!cp) { cp = V(pl.pos.x, pl.pos.y + 1.4, pl.pos.z); dir = V(-Math.sin(pl.yaw), 0, -Math.cos(pl.yaw)); }
  const start = safeStart(pl.f, cp, dir);
  o.pos.copy(start); o.f = pl.f; o.heldBy = null; o.thrower = pl; o.dirty = true;
  if (throwIt) { o.vel.copy(dir).multiplyScalar(11); o.vel.y += 1.6; o.thrown = true; }
  else { o.vel.set(dir.x * 0.6, 0, dir.z * 0.6); o.thrown = false; }
  o.rest = false; o.mesh.visible = true; o.mesh.position.copy(o.pos);
  pl.held = null; invChanged(pl);
}
function consumeFor(pl) { const o = pl.held; if (!o) return; o.heldBy = null; pl.held = null; o.used = true; removeObj(o); invChanged(pl); }
function fireFor(pl, w, cp, dir) {
  if (!pl.weapons[w]) return;
  if (w === 'slingshot' && pl.stones <= 0) { ptoast(pl, 'Нет камней'); return; }
  if (w === 'flaregun' && pl.flareAmmo <= 0) { ptoast(pl, 'Ракеты кончились'); return; }
  const start = safeStart(pl.f, cp, dir);
  const id = w === 'slingshot' ? 'stone' : 'flare';
  const mesh = makeItemMesh(id, false); G.dyn.add(mesh);
  const o = regObject({ id, kind: 'proj', mesh, f: pl.f, pos: start.clone(), vel: dir.clone().multiplyScalar(w === 'slingshot' ? 26 : 22), rest: false, broken: false, thrown: true, thrower: pl, home: { f: pl.f, pos: start.clone() }, name: id === 'stone' ? 'Камень' : 'Ракета', heldBy: null });
  announceObject(o);
  if (w === 'slingshot') { pl.stones--; noise(pl.f, pl.pos, 3, pl); }
  else { pl.flareAmmo--; noise(pl.f, pl.pos, 16, pl); G.flares.push({ o, life: 12 }); }
  psfx(pl, w === 'slingshot' ? 'twang' : 'flare');
  invChanged(pl);
}
function fire() {
  if (G.mode !== 'play' || P.hidden || !P.weap || P.paused || P.downed || P.climb || P.ui) return;
  const { s, d } = camPose();
  P.kick = 0.25;
  if (Net.role === 'client') {
    if ((P.weap === 'slingshot' ? P.stones : P.flareAmmo) <= 0) { toast(P.weap === 'slingshot' ? 'Нет камней' : 'Ракеты кончились'); return; }
    Net.send({ t: 'r', a: 'fire', w: P.weap, s: pv(s), d: pv(d) }, true);
  } else fireFor(P, P.weap, s, d);
}
function releaseHeld(throwIt) {
  if (!P.held || P.hidden || P.paused || P.downed || P.climb || P.ui) return;
  const { s, d } = camPose();
  if (Net.role === 'client') Net.send({ t: 'r', a: 'drop', thr: throwIt, s: pv(s), d: pv(d) }, true);
  else dropFor(P, throwIt, s, d);
}

// ---------- записки с кодом ----------
function noteTex(text, title = 'сейф', big = 34) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, 128, 160);
  g.fillStyle = 'rgba(120,90,40,0.25)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.random() * 128, Math.random() * 160, 10 + Math.random() * 20, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(80,80,140,0.35)'; for (let y = 30; y < 160; y += 16) { g.beginPath(); g.moveTo(8, y); g.lineTo(120, y); g.stroke(); }
  g.fillStyle = '#2a1a10'; g.font = 'bold 18px Georgia'; g.textAlign = 'center';
  g.fillText(title, 64, 50); g.font = 'bold ' + big + 'px Georgia'; g.fillText(text, 64, 100);
  g.fillStyle = '#8a1010'; g.beginPath(); g.arc(20, 14, 5, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function placeNotes(spotIdx) {
  for (const n of G.notes) if (n.mesh.parent) n.mesh.parent.remove(n.mesh);
  G.notes = [];
  const halves = [G.code.slice(0, 2) + '··', '··' + G.code.slice(2)];
  spotIdx.forEach((si, i) => {
    const s = furn.notes[si];
    const isWord = i === 2, W2 = (G.word || '').toUpperCase();
    const tx = isWord ? noteTex(W2, 'скажи стеллажу', W2.length > 7 ? 18 : 24) : noteTex(halves[i]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), new THREE.MeshLambertMaterial({ map: tx }));
    m.position.copy(s.pos); m.rotation.y = s.ry; m.rotation.z = (i ? -0.08 : 0.06); G.dyn.add(m);
    G.notes.push({ f: s.f, pos: s.pos.clone(), mesh: m, text: isWord ? W2 : halves[i], part: isWord ? 'word' : i });
  });
}

// ---------- взаимодействие ----------
let focus = null;
function candidates() {
  const list = [];
  const cp = camera.getWorldPosition(V());
  if (P.downed || P.climb || P.dead || P.driving || P.inBunker || PILOT.on) return list;
  if (P.sacked) return [{ kind: 'wiggle', label: 'Шуршать', pos: camera.getWorldPosition(V()) }];
  if (P.hidden) return P.hideAnim ? [] : [{ kind: 'exit', label: 'Вылезти', pos: cp }];
  if (P.trapped) return [{ kind: 'trapfree', label: 'Вырваться! ' + P.trapped.got + '/' + P.trapped.need, pos: cp }];
  for (const o of G.objects) {
    if (o.broken || o.heldBy || o.locked || o.kind === 'proj') continue;
    if (o.f !== P.f && Math.abs(o.pos.y - P.pos.y) > 1.6) continue;
    if (o.vel && !o.rest && o.vel.length() > 1) continue;
    const def = ITEMS[o.id];
    const label = o.kind === 'ammo' ? 'Подобрать камень' : def && def.weapon ? 'Взять: ' + o.name : def && def.ammo ? 'Подобрать камни' : (P.held ? 'Поменять на: ' : 'Взять: ') + o.name;
    list.push({ kind: 'obj', o, pos: V(o.pos.x, o.pos.y + 0.08, o.pos.z), label });
  }
  for (const [key, d] of G.doors) {
    if (d.f !== P.f) continue;
    let label = d.open ? 'Закрыть дверь' : 'Открыть дверь';
    if (d.locked) { const lt = LOCK_TEXT[d.needs]; label = d.needs === 'symlock' ? 'Замок с картинками' : P.held && P.held.id === d.needs ? lt[0] : lt[1]; }
    list.push({ kind: 'door', d, key, pos: V(cc(d.x), FLOOR_Y[d.f] + 1.1, cc(d.z)), label });
  }
  furn.hides.forEach((h, idx) => {
    if (h.f !== P.f || players().some(p => p.hidden === h) || h.enemy) return;
    const p = h.type === 'bed' ? localToWorld(h.group, 0, 0.5, 0.6) : localToWorld(h.group, 0, 1.2, -0.2);
    list.push({ kind: 'hide', h, idx, pos: p, label: h.type === 'bed' ? 'Залезть под кровать' : 'Спрятаться в шкаф' });
  });
  if (P.f === 1 && G.sackMeshes) SACK_SLOTS.forEach(([sx, sz], i) => list.push({ kind: 'sack', idx: i, pos: V(sx * CS, 0.55, sz * CS), label: 'Развязать мешок' }));
  if (P.f === 1 && G.signs) for (const sg of G.signs) list.push({ kind: 'sign', sg, pos: sg.pos, label: 'Прочитать табличку', far: true });
  for (const n of G.notes) if (n.f === P.f) list.push({ kind: 'note', n, pos: n.pos, label: 'Прочитать записку' });
  if (P.f === 3) list.push({ kind: 'tom', pos: furn.tom.pos, label: 'Портрет: Том Перл', far: true });
  const sec = furn.secret;
  if (P.f === 0 && !sec.open && !sec.moving) list.push({ kind: 'secret', pos: sec.pos, label: 'Стеллаж: голосовой замок' });
  const ch = furn.chest;
  if (P.f === 0 && !ch.open) list.push({ kind: 'chest', pos: ch.pos, label: P.held && P.held.id === 'smallkey' ? 'Открыть сундук' : 'Сундук заперт' });
  const sf = furn.safe;
  if (P.f === 3 && !sf.open) list.push({ kind: 'safe', pos: sf.pos, label: 'Сейф: набрать код' });
  const ht = furn.hatch;
  if (P.f === 2) list.push({ kind: 'hatch', pos: V(cc(HATCH.x), 5.4, cc(HATCH.z)), label: ht.open ? 'Залезть на чердак' : P.held && P.held.id === 'hook' ? 'Опустить лестницу багром' : 'Люк на чердак: высоко… нужен багор', far: true });
  if (P.f === 3 && ht.open) list.push({ kind: 'hatch', pos: V(cc(HATCH.x), 6.2, cc(HATCH.z)), label: 'Спуститься с чердака', far: true });
  // поднять друга бинтом
  for (const pl of players()) if (pl !== P && pl.downed && pl.f === P.f) list.push({ kind: 'revive', pid: pl.id, pos: V(pl.pos.x, pl.pos.y + 0.3, pl.pos.z), label: 'Держи, чтобы поднять: ' + pl.name, far: true });
  const esc = (type, f, pos) => {
    if (P.f !== f) return;
    const e = G.esc[type], parts = partsFor(type);
    const miss = parts.filter(p => !e[p]);
    let label;
    if (!miss.length) label = 'Ворота открыты';
    else if (P.held && miss.includes(P.held.id)) label = 'Установить: ' + P.held.name;
    else label = ESCAPES[type].name + ': нужно ' + miss.map(p => ITEMS[p].name.toLowerCase()).join(', ');
    list.push({ kind: 'esc', type, pos, label, far: true });
  };
  esc('gate', 1, V(cc(9), 1.1, CS * 0.9));
  if (P.f === 1 && bunkerMesh) list.push(P.held && P.held.id === 'shahed' && !G.bunkerShahed ? { kind: 'loadshahed', pos: V(BUNKER.x, 0.9, BUNKER.z + 1.5), far: true, label: 'Зарядить шахед в пусковую' } : { kind: 'bunker', pos: V(BUNKER.x, 0.9, BUNKER.z + 1.5), far: true, label: 'Спуститься в бункер' });
  if (P.f === 1 && kochedorM && !G.kochDug && Math.hypot(P.pos.x - KOCHEDOR.x, P.pos.z - KOCHEDOR.z) < 4) list.push({ kind: 'kochedor', pos: V(KOCHEDOR.x, 0.6, KOCHEDOR.z), far: true, label: P.held && P.held.id === 'shovel' ? 'Выкопать кочедор лопатой' : 'Кочедор. Корни глубоко — нужна лопата' });
  if (P.f === 1 && bnHatchM && Math.hypot(P.pos.x - BANYA_HATCH.x, P.pos.z - BANYA_HATCH.z) < 3) list.push({ kind: 'banyahatch', pos: V(BANYA_HATCH.x, 0.3, BANYA_HATCH.z), far: true, label: G.banyaOpen ? 'Спуститься в люк' : P.held && P.held.id === 'banyakey' ? 'Отпереть люк ключом' : 'Люк в полу заперт. Нужен ключ' });
  if (inBanya(P)) list.push({ kind: 'banyaexit', pos: V(BN.x + BN_LADDER[0], 1.3, BN.z), far: true, label: 'Подняться по лестнице наверх' });
  if (P.f === 1 && G.mapMesh && !(P.inv && P.inv.map)) list.push({ kind: 'map', pos: MAPPOS.clone().setY(0.2), far: true, label: 'Подобрать карту' });
  if (P.f === 1 && van) list.push({ kind: 'van', pos: V(van.position.x, 1.2, van.position.z + 1.2), far: true, label: G.houseGone ? 'Сесть в фургон и уехать' : 'Фургон: сначала найди бункер по карте' });
  if (P.f === 1 && CAR.mesh && !CAR.driver) { const cp2 = V(CAR.pos.x, 1.0, CAR.pos.z); list.push({ kind: 'car', pos: cp2, far: true, label: CAR.dead ? 'Машина деда заглохла' : CAR.unlocked ? 'Сесть за руль' : P.held && P.held.id === 'carkey' ? 'Завести машину деда' : 'Машина деда: ключи у деда в комнате' }); }
  if (G.houseGone) return list.filter(c => !(c.pos && c.pos.x > 3.4 && c.pos.x < 36.6 && c.pos.z > 5.4 && c.pos.z < 30.6) || c.kind === "revive");
  return list;
}
function pickFocus() {
  const cp = camera.getWorldPosition(V()), dir = V(); camera.getWorldDirection(dir);
  let best = null, bs = 1e9;
  for (const c of candidates()) {
    if (c.kind === 'exit' || c.kind === 'trapfree' || c.kind === 'wiggle') return c;
    const v = c.pos.clone().sub(cp), d = v.length();
    if (d > (c.far ? 3.3 : 2.4)) continue;
    const dot = v.normalize().dot(dir);
    if (dot < (c.kind === 'door' || c.kind === 'secret' || c.kind === 'hatch' || c.kind === 'revive' ? 0.55 : c.kind === 'hide' ? 0.6 : 0.72)) continue;
    // нельзя брать сквозь стены
    if (c.kind !== 'door' && !los(P.f, cp, c.pos)) continue;
    const sc = d * (1.6 - dot); if (sc < bs) { bs = sc; best = c; }
  }
  return best;
}
const encodeC = (c) => ({ kind: c.kind, nid: c.o && c.o.nid, key: c.key, idx: c.idx, type: c.type, pid: c.pid, word: c.word });
function decodeC(e) {
  if (e.kind === 'obj') { const o = G.byNid.get(e.nid); return o && !o.broken && !o.heldBy ? { kind: 'obj', o } : null; }
  if (e.kind === 'door') { const d = G.doors.get(e.key); return d ? { kind: 'door', d, key: e.key } : null; }
  if (e.kind === 'hide') { const h = furn.hides[e.idx]; return h ? { kind: 'hide', h, idx: e.idx } : null; }
  return { kind: e.kind, type: e.type, pid: e.pid, word: e.word, idx: e.idx };
}
function doAction() {
  ensureAudio();
  if (G.mode === 'ch2') { CH2.act(); return; }
  if (G.mode !== 'play' || P.paused || P.downed || P.climb || P.ui) return;
  const c = focus; if (!c) return;
  if (c.kind === 'exit') { exitHide(); return; }
  if (c.kind === 'trapfree') { struggle(); return; }
  if (c.kind === 'wiggle') { if (Net.role === 'client') Net.send({ t: 'r', a: 'wiggle' }, true); else wiggleSack(P); sfx.sack(null); return; }
  if (c.kind === 'hide') { enterHide(c.h, c.idx); return; }
  if (c.kind === 'note') { readNote(c.n); return; }
  if (c.kind === 'sign') { readSign(c.sg); return; }
  if (c.kind === 'bunker') { enterBunker(); return; }
  if (c.kind === 'map') { P.inv = P.inv || {}; P.inv.map = true; sfx.paper(); $('bMap').classList.remove('hidden'); toast('Карта в инвентаре (кнопка 🗺). На ней отмечен бункер', 3.5); return; }
  if (c.kind === 'tom') { const L2 = ['Том Перл. Говорят, он первым сбежал из этого дома.', 'Том Перл смотрит на тебя с одобрением. Ты справишься.', 'На раме нацарапано: «Т.П. был здесь».', 'Хозяйка каждый вечер протирает этот портрет. Интересно, почему…', 'Кажется, Том Перл подмигнул. Показалось.']; G.tomI = ((G.tomI === undefined ? -1 : G.tomI) + 1) % L2.length; sfx.paper(); toast(L2[G.tomI], 3.5); return; }
  if (c.kind === 'safe') { openKeypad(); return; }
  if (c.kind === 'door' && c.d.locked && c.d.needs === 'symlock') { openSymLock(); return; }
  if (c.kind === 'secret') { openVoiceLock(); return; }
  if (c.kind === 'hatch' && furn.hatch.open) { startClimb(); return; }
  if (c.kind === 'revive') { P.reviving = { pid: c.pid, t: 0 }; return; }
  if (Net.role === 'client') { Net.send({ t: 'r', a: 'act', c: encodeC(c) }, true); return; }
  performAction(P, c);
}
function readNote(n) {
  sfx.paper(); P.known[n.part] = n.text;
  if (n.part === 'word') toast('Записка: «Стеллажу в подвале скажи вслух: ' + n.text + '»', 4);
  else toast('Записка: «код сейфа ' + n.text + '»', 3.5);
}
// выполнение действия (на хозяине или в одиночной игре) за любого игрока
function performAction(pl, c) {
  if (c.kind === 'kochedor') {
    if (G.kochDug) return;
    if (!pl.held || pl.held.id !== 'shovel') { ptoast(pl, 'Кочедор держится крепко. Нужна лопата', 2.5); return; }
    G.kochDug = true; applyBanyaVisual(); fx.dig(KOCHEDOR); setTimeout(() => fx.dig(KOCHEDOR), 350); noise(1, KOCHEDOR, 8, pl);
    const k = addObject('banyakey', 1, 25, 15, 'item'); k.pos.set(KOCHEDOR.x + 0.95, 0.02, KOCHEDOR.z + 0.2); k.mesh.position.copy(k.pos); k.home.pos.copy(k.pos); k.rest = true; announceObject(k);
    ptoast(pl, 'Под корнями кочедора — ключ! На бирке: «люк в баньке»', 3.5); return;
  }
  if (c.kind === 'banyahatch') {
    if (!G.banyaOpen) {
      if (pl.held && pl.held.id === 'banyakey') { consumeFor(pl); G.banyaOpen = true; applyBanyaVisual(); fx.door(BANYA_HATCH, true); ptoast(pl, 'Люк открыт. Снизу тянет паром, и кто-то пыхтит…', 3.5); }
      else ptoast(pl, 'Люк заперт. Говорят, ключ закопан в теплице — под кочедором', 3);
      return;
    }
    enterBanya(pl); return;
  }
  if (c.kind === 'banyaexit') { leaveBanya(pl); return; }
  if (pl.downed) return;
  if (c.kind === 'obj') {
    const o = c.o, def = ITEMS[o.id];
    if (o.kind === 'ammo') { pl.stones++; removeObj(o); psfx(pl, 'pickup'); invChanged(pl); return; }
    if (def && def.ammo) { pl.stones += 4; removeObj(o); psfx(pl, 'pickup'); ptoast(pl, pl.weapons.slingshot ? '+4 камня' : 'Камни. Пригодятся для рогатки'); invChanged(pl); return; }
    if (def && def.weapon) {
      pl.weapons[o.id] = true; pl.weap = o.id; removeObj(o); psfx(pl, 'install');
      if (o.id === 'slingshot') { pl.stones += 6; ptoast(pl, 'РОГАТКА! Кнопка «Рогатка» — выстрел. Сбивает с ног', 4); }
      else { pl.flareAmmo += 2; ptoast(pl, 'РАКЕТНИЦА! Две ракеты — оглушают надолго и прогоняют Нечто', 4); }
      invChanged(pl); return;
    }
    holdFor(pl, o); psfx(pl, 'pickup');
    return;
  }
  if (c.kind === 'door') {
    const d = c.d;
    if (d.locked) {
      const lt = LOCK_TEXT[d.needs];
      if (pl.held && pl.held.id === d.needs) { unlockDoor(d); consumeFor(pl); psfx(pl, 'install'); ptoast(pl, lt[2]); setDoor(d, true); }
      else { fx.locked(V(cc(d.x), FLOOR_Y[d.f] + 1.1, cc(d.z))); ptoast(pl, lt[1]); }
      return;
    }
    setDoor(d, !d.open); return;
  }
  if (c.kind === 'hatch') {
    const ht = furn.hatch;
    if (ht.open) return;
    if (pl.held && pl.held.id === 'hook') { consumeFor(pl); ht.open = true; fx.hatch(V(cc(HATCH.x), 5.5, cc(HATCH.z))); noise(2, pl.pos, 8, pl); ptoast(pl, 'Лестница на чердак опущена'); }
    else ptoast(pl, 'Люк в потолке. Без багра не дотянуться', 3);
    return;
  }
  if (c.kind === 'sack') {
    const v = players().find(p => p.sacked && p.sackSlot === c.idx);
    const sp2 = V(SACK_SLOTS[c.idx][0] * CS, 0.5, SACK_SLOTS[c.idx][1] * CS);
    fx.sack(sp2); noise(1, sp2, 3, pl);
    if (v && v !== pl) freeSack(v, pl); else ptoast(pl, 'Пусто. Только старая картошка…', 2);
    return;
  }
  if (c.kind === 'revive') {
    const t = PL.get(c.pid);
    if (!t || !t.downed || t.f !== pl.f) return;
    if (Math.hypot(t.pos.x - pl.pos.x, t.pos.z - pl.pos.z) > 3) return;
    revivePlayer(t, pl); return;
  }
  if (c.kind === 'secret') {
    const sec = furn.secret;
    if (sec.open || sec.moving) return;
    if (wordMatch(c.word || '', G.word)) { startSecret(); fx.grind(sec.pos); noise(0, sec.pos, 10, pl); ptoast(pl, 'Замок узнал слово. Механизм ожил…'); }
    else ptoast(pl, 'Замок молчит. Не то слово', 2.5);
    return;
  }
  if (c.kind === 'chest') {
    const ch = furn.chest;
    if (ch.open) return;
    if (pl.held && pl.held.id === 'smallkey') { consumeFor(pl); openChest(); fx.chest(ch.pos); ptoast(pl, 'Сундук открыт!'); }
    else { fx.locked(ch.pos); ptoast(pl, 'Сундук заперт. Замочек совсем маленький…', 3); }
    return;
  }
  if (c.kind === 'loadshahed') {
    if (!pl.held || pl.held.id !== 'shahed' || G.bunkerShahed) return;
    consumeFor(pl); G.bunkerShahed = true; psfx(pl, 'install');
    alltoast('Шахед Тру Адама на пусковой! Спускайся в бункер и запускай', 4); return;
  }
  if (c.kind === 'van') { if (G.houseGone) winAll('van'); else ptoast(pl, 'Фургон не уедет, пока стоит дом. Найди бункер по карте', 3); return; }
  if (c.kind === 'car') {
    if (CAR.dead || CAR.driver) return;
    if (!CAR.unlocked) { if (pl.held && pl.held.id === 'carkey') { consumeFor(pl); CAR.unlocked = true; fx.door(CAR.pos, true); enterCar(pl); } else ptoast(pl, 'Заперто. Ключи от машины лежат в комнате деда', 3); return; }
    enterCar(pl); return;
  }
  if (c.kind === 'esc') {
    const e = G.esc[c.type], parts = partsFor(c.type);
    const miss = parts.filter(p => !e[p]);
    if (pl.held && miss.includes(pl.held.id)) {
      e[pl.held.id] = true; consumeFor(pl); psfx(pl, 'install'); noise(pl.f, pl.pos, 5, pl);
      applyEscVisual(c.type);
      const left = parts.filter(p => !e[p]);
      if (!left.length) {
        if (c.type === 'gate') { G.esc.gateOpen = true; maps[1][0][9] = '.'; ptoast(pl, 'Ворота открыты! За ними — дорога. Ищи у ворот карту', 4); noise(1, pl.pos, 14, pl); }
        else ptoast(pl, ESCAPES[c.type].name + ' готова! Нажми ещё раз');
      } else ptoast(pl, 'Ещё нужно: ' + left.map(p => ITEMS[p].name.toLowerCase()).join(', '));
      return;
    }
    if (!miss.length && c.type !== 'gate') { winAll(c.type); return; }
    ptoast(pl, ESCAPES[c.type].name + ': нужно ' + miss.map(p => ITEMS[p].name.toLowerCase()).join(', '));
  }
}
function tryCode(pl, code) {
  const sf = furn.safe;
  if (sf.open) return;
  if (code === G.code) { openSafe(); fx.safe(sf.pos); psfx(pl, 'revive'); ptoast(pl, 'Щёлк! Сейф открыт'); noise(3, sf.pos, 6, pl); }
  else { psfx(pl, 'locked'); ptoast(pl, 'Неверный код'); }
  if (!pl.local) Net.send({ t: 'safe', ok: code === G.code }, true, pl.id);
}
function startSecret() { const sec = furn.secret; sec.moving = true; sec.t = 0; if (!sec.gearMesh) { const g = makeItemMesh('gear'); g.rotation.z = Math.PI / 2; g.position.set(-0.04, 0, 0); sec.socket.add(g); sec.gearMesh = g; } }
function openChest() { const ch = furn.chest; ch.open = true; ch.lock.visible = false; const fg = G.objects.find(o => o.id === 'flaregun'); if (fg) { fg.locked = false; fg.dirty = true; } }
function openSafe() { const sf = furn.safe; sf.open = true; const gk = G.objects.find(o => o.id === 'gatekey'); if (gk) { gk.locked = false; gk.dirty = true; } }
function applyEscVisual(type) {
  const e = G.esc;
  if (type !== 'gate' || !gateM) return;
  const u = gateM.userData, ex = GATE_EXTRA[diffKey] || [];
  u.chain.visible = !e.gate.cutters; u.padlock.visible = !e.gate.gatekey; u.boards.visible = !e.gate.crowbar; u.lasers.visible = !e.gate.remote;
  u.motor.visible = ex.length > 0; u.leverIn.visible = !!e.gate.lever; u.battIn.visible = !!e.gate.battery;
}

// ---------- замок сарая с картинками ----------
// три таблички во дворе показывают по одной картинке и её место (I, II, III). Собери — и сарай открыт.
const SYM_NAMES = ['солнце', 'луна', 'звезда', 'сердце', 'рыба', 'колокол'];
const SIGN_SPOTS = [[20, 15], [27, 10], [12, 19], [6, 19], [28, 3], [17, 21], [24, 20], [3, 16], [14, 2], [21, 8]];
function drawSym(g, k, cx, cy, r, col) {
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = r * 0.14; g.lineCap = 'round';
  g.beginPath();
  if (k === 0) { g.arc(cx, cy, r * 0.42, 0, 7); g.fill(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.moveTo(cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58); g.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); } g.stroke(); }
  else if (k === 1) { g.arc(cx, cy, r * 0.8, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx + r * 0.38, cy - r * 0.2, r * 0.7, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  else if (k === 2) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.38 : r * 0.9; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  else if (k === 3) { g.moveTo(cx, cy + r * 0.8); g.bezierCurveTo(cx - r * 1.1, cy, cx - r * 0.6, cy - r * 0.9, cx, cy - r * 0.35); g.bezierCurveTo(cx + r * 0.6, cy - r * 0.9, cx + r * 1.1, cy, cx, cy + r * 0.8); g.fill(); }
  else if (k === 4) { g.ellipse(cx - r * 0.1, cy, r * 0.6, r * 0.38, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx + r * 0.4, cy); g.lineTo(cx + r * 0.9, cy - r * 0.4); g.lineTo(cx + r * 0.9, cy + r * 0.4); g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx - r * 0.42, cy - r * 0.08, r * 0.08, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  else { g.moveTo(cx - r * 0.6, cy + r * 0.45); g.quadraticCurveTo(cx - r * 0.55, cy - r * 0.8, cx, cy - r * 0.8); g.quadraticCurveTo(cx + r * 0.55, cy - r * 0.8, cx + r * 0.6, cy + r * 0.45); g.closePath(); g.fill(); g.beginPath(); g.arc(cx, cy + r * 0.6, r * 0.15, 0, 7); g.fill(); g.fillRect(cx - r * 0.75, cy + r * 0.38, r * 1.5, r * 0.14); }
}
const SYM_IMG = [];
function symImg(k) {
  if (SYM_IMG[k]) return SYM_IMG[k];
  const c = document.createElement('canvas'); c.width = c.height = 96; drawSym(c.getContext('2d'), k, 48, 48, 40, '#e8c060');
  return (SYM_IMG[k] = c.toDataURL());
}
const ROMAN = ['I', 'II', 'III'];
function signTex(pos, k) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#5a4028'; g.fillRect(0, 0, 160, 128);
  for (let y = 0; y < 128; y += 32) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 160, 2); }
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(30,20,10,0.25)'; g.fillRect(Math.random() * 160, Math.random() * 128, 18, 2); }
  g.fillStyle = '#efe4c8'; g.font = 'bold 44px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ROMAN[pos], 40, 64);
  drawSym(g, k, 108, 64, 40, '#efe4c8');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function placeSigns(idx) {
  for (const sg of G.signs || []) if (sg.mesh.parent) sg.mesh.parent.remove(sg.mesh);
  G.signs = []; G.signIdx = idx;
  const postM = LM({ map: T.wood, color: 0x6a5038 });
  idx.forEach((si, pos) => {
    const [x, z] = SIGN_SPOTS[si];
    const g = new THREE.Group(); g.position.set(cc(x) + 0.4, 0, cc(z) - 0.4); g.rotation.y = rand(-0.6, 0.6) + (z < 12 ? 0 : Math.PI);
    g.add(box(0.08, 1.15, 0.08, postM, 0, 0.575, -0.07));
    const mat = new THREE.MeshLambertMaterial({ map: signTex(pos, G.sym[pos]) });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.04), [postM, postM, postM, postM, mat, mat]); board.position.y = 1.15; board.rotation.z = rand(-0.08, 0.08); g.add(board);
    G.dyn.add(g);
    G.signs.push({ mesh: g, pos: V(g.position.x, 1.15, g.position.z), slot: pos });
  });
}
let symBuf = [0, 0, 0];
function openSymLock() {
  P.ui = true; symBuf = [0, 0, 0];
  const kn = P.symKnown || {};
  $('symHint').textContent = Object.keys(kn).length ? 'Ты видел: ' + Object.entries(kn).map(([i, k]) => ROMAN[i] + ' — ' + SYM_NAMES[k]).join(', ') : 'Подсказки — на трёх деревянных табличках во дворе';
  renderSym(); $('pSym').classList.remove('hidden'); sfx.click();
}
function renderSym() { document.querySelectorAll('#symDials .dial').forEach((d, i) => { d.querySelector('img').src = symImg(symBuf[i]); }); }
function closeSymLock() { P.ui = false; $('pSym').classList.add('hidden'); }
document.querySelectorAll('#symDials .dial').forEach((d, i) => {
  d.querySelector('.up').addEventListener('click', () => { symBuf[i] = (symBuf[i] + 1) % SYM_NAMES.length; sfx.key(); renderSym(); });
  d.querySelector('.dn').addEventListener('click', () => { symBuf[i] = (symBuf[i] + SYM_NAMES.length - 1) % SYM_NAMES.length; sfx.key(); renderSym(); });
});
$('symOk').addEventListener('click', () => { const code = symBuf.slice(); if (Net.role === 'client') Net.send({ t: 'r', a: 'sym', code }, true); else trySym(P, code); closeSymLock(); });
$('symClose').addEventListener('click', closeSymLock);
function trySym(pl, code) {
  const d = G.doors.get('1,24,8'); if (!d || !d.locked) return;
  const ok = Array.isArray(code) && code.length === 3 && code.every((k, i) => k === G.sym[i]);
  if (ok) { unlockDoor(d); setDoor(d, true); psfx(pl, 'install'); ptoast(pl, 'Щёлк! Замок с картинками открылся'); fx.locked(V(cc(24), 1.1, cc(8))); }
  else { fx.locked(V(cc(24), 1.1, cc(8))); noise(1, V(cc(24), 0, cc(8)), 5, pl); if (pl.local) { sfx.beep(false); toast('Замок не открылся — картинки не те', 2); } }
  if (!pl.local) Net.send({ t: 'symres', ok }, true, pl.id);
}
function readSign(sg) { sfx.paper(); P.symKnown = P.symKnown || {}; P.symKnown[sg.slot] = G.sym[sg.slot]; toast('Табличка: «' + ROMAN[sg.slot] + ' — ' + SYM_NAMES[G.sym[sg.slot]] + '»', 3); }

// ---------- кодовый замок ----------
let keyBuf = '';
function openKeypad() { P.ui = true; keyBuf = ''; $('kpDisp').textContent = '····'; $('kpHint').textContent = Object.values(P.known).length ? 'Ты помнишь: ' + Object.values(P.known).join('  ') : 'Код где-то записан…'; $('pSafe').classList.remove('hidden'); sfx.click(); }
function closeKeypad() { P.ui = false; $('pSafe').classList.add('hidden'); }
document.querySelectorAll('#kpKeys button').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.k; sfx.key();
  if (k === 'C') keyBuf = ''; else if (k === 'OK') { if (keyBuf.length === 4) { if (Net.role === 'client') Net.send({ t: 'r', a: 'code', code: keyBuf }, true); else tryCode(P, keyBuf); closeKeypad(); } return; }
  else if (keyBuf.length < 4) keyBuf += k;
  $('kpDisp').textContent = (keyBuf + '····').slice(0, 4);
}));
$('kpClose').addEventListener('click', closeKeypad);

// ---------- голосовой замок ----------
const normWord = (t) => String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9 ]/g, ' ');
function lev(a, b) { const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; for (let j = 1; j <= b.length; j++) d[i][j] = i ? Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; } return d[a.length][b.length]; }
function wordMatch(text, word) {
  const w = normWord(word).trim(); if (!w) return false;
  return normWord(text).split(/\s+/).some(t => t === w || (w.length >= 5 && t.length >= 4 && lev(t, w) <= 1));
}
const VL = { open: false, timer: 0, done: false };
function openVoiceLock() {
  P.ui = true; VL.open = true; VL.done = false;
  $('pVoice').classList.remove('hidden'); $('vHeard').textContent = ''; $('vType').classList.add('hidden'); $('vInput').value = '';
  sfx.click();
  if (Net.voiceAvail()) startVoiceListen();
  else { $('vStatus').textContent = 'Микрофон работает только в приложении на iPhone. Напиши слово:'; $('vType').classList.remove('hidden'); $('vRec').classList.remove('on'); }
}
function startVoiceListen() {
  $('vStatus').textContent = 'Говори пароль в микрофон…'; $('vHeard').textContent = '';
  $('vRec').classList.add('on'); VL.timer = 7; VL.listening = true;
  Net.listen(true);
}
function stopVoiceListen() { if (VL.listening) { VL.listening = false; Net.listen(false); } $('vRec').classList.remove('on'); }
function closeVoiceLock() { stopVoiceListen(); VL.open = false; P.ui = false; $('pVoice').classList.add('hidden'); }
function submitWord(text) {
  if (VL.done) return;
  if (!wordMatch(text, G.word)) return false;
  VL.done = true; stopVoiceListen();
  $('vStatus').textContent = 'Щёлк! Замок узнал слово'; sfx.revive();
  const c = { kind: 'secret', word: text };
  if (Net.role === 'client') Net.send({ t: 'r', a: 'act', c }, true); else performAction(P, c);
  setTimeout(closeVoiceLock, 900);
  return true;
}
function updateVoiceLock(dt) {
  if (!VL.open) return;
  const lvl = Math.min(1, (P.voiceLvl || 0) * 12);
  document.querySelectorAll('#vBars i').forEach((b, i) => b.style.height = (6 + Math.max(0, lvl * 40 - i * 3) * (0.6 + 0.4 * Math.sin(now() * 20 + i))) + 'px');
  if (VL.listening) { VL.timer -= dt; if (VL.timer <= 0) { stopVoiceListen(); $('vStatus').textContent = 'Не расслышал. Нажми «Сказать ещё раз»'; } }
}
Net.on('heard', (ev) => {
  if (!VL.open || VL.done) return;
  $('vHeard').textContent = '«' + ev.text + '»';
  if (submitWord(ev.text)) return;
  if (ev.final) { stopVoiceListen(); $('vStatus').textContent = 'Замок молчит — не то слово. Попробуй ещё'; sfx.locked && sfx.locked(); }
});
$('vAgain').addEventListener('click', () => { if (Net.voiceAvail()) startVoiceListen(); });
$('vTypeBtn').addEventListener('click', () => { $('vType').classList.remove('hidden'); stopVoiceListen(); $('vStatus').textContent = 'Напиши слово:'; });
$('vOk').addEventListener('click', () => { if (!submitWord($('vInput').value)) { $('vStatus').textContent = 'Не то слово'; sfx.locked && sfx.locked(); } });
$('vClose').addEventListener('click', closeVoiceLock);

// ---------- голос: только для замка (голосовой чат убран) ----------
const VC = { noiseT: 0 };
Net.on('vlevel', (ev) => { P.voiceLvl = ev.l; });
Net.on('vstate', (ev) => {
  if (!VL.open) return;
  if (ev.s === 'denied') { $('vStatus').textContent = 'Нет доступа к микрофону (Настройки → Тихий дом). Напиши слово:'; $('vType').classList.remove('hidden'); stopVoiceListen(); }
  if (ev.s === 'nospeech') { $('vStatus').textContent = 'Распознавание речи недоступно. Напиши слово:'; $('vType').classList.remove('hidden'); stopVoiceListen(); }
  if (ev.s === 'error') { $('vType').classList.remove('hidden'); stopVoiceListen(); }
});
function updateVoice(dt) {
  // пароль, сказанный вслух рядом с Хозяйкой, она услышит
  VC.noiseT -= dt;
  if (VL.listening && (P.voiceLvl || 0) > 0.04 && VC.noiseT <= 0 && G.mode === 'play') {
    VC.noiseT = 0.45;
    myNoise(P.f, P.pos.clone(), Math.min(10, 2.5 + ((P.voiceLvl || 0) - 0.04) * 45));
  }
}

// ---------- люк: подъём и спуск ----------
function startClimb() {
  const ht = furn.hatch; if (!ht.open) return;
  const up = P.f === 2;
  P.climb = { t: 0, up, from: camera.position.clone(), to: up ? V(ht.above.x, 6 + 1.6, ht.above.z) : V(ht.below.x, 3 + 1.6, ht.below.z) };
  sfx.climb(); myNoise(P.f, P.pos.clone(), 4);
}
function updateClimb(dt) {
  const c = P.climb; if (!c) return;
  c.t += dt / 1.1;
  const k = Math.min(1, c.t), e = k * k * (3 - 2 * k);
  camera.position.lerpVectors(c.from, c.to, e);
  camera.position.x += Math.sin(k * Math.PI * 6) * 0.03;
  if (k >= 1) {
    const ht = furn.hatch;
    P.f = c.up ? 3 : 2; const tgt = c.up ? ht.above : ht.below;
    P.pos.set(tgt.x, FLOOR_Y[P.f], tgt.z); P.eye = 1.6; P.climb = null;
  }
}

// ---------- прятки ----------
function hideCam(h) { return h.type === 'wardrobe' ? localToWorld(h.group, 0, Math.min(1.55, h.h2 - 0.45), -0.3) : localToWorld(h.group, 0, 0.18, 0.15); }
function hideFor(pl, h) {
  if (players().some(p => p !== pl && p.hidden === h)) { ptoast(pl, 'Тут уже кто-то прячется'); return false; }
  // Сторож видит глазами, Хозяйка слышит скрип дверцы и шорох под кроватью
  const ws = watchman.state;
  if (ws !== 'off' && ws !== 'sleep' && watchman.stun <= 0 && (watchSees(pl) || (ws === 'chase' && distTo(watchman, pl) < 5))) { watchman.witness = pl.id; if (ws !== 'chase' && !busy(watchman)) startChase(watchman, pl); }
  const hs = hostess.state, hd = distTo(hostess, pl);
  const earR = (h.type === 'wardrobe' ? 7.5 : 4.5) * D.hear * (pl.crouch ? 0.8 : 1);
  if (hs !== 'off' && hostess.stun <= 0 && !busy(hostess) && (hd < earR || (hs === 'chase' && hd < (diffKey === 'nightmare' ? 6 : 4)))) { hostess.witness = pl.id; if (hs !== 'chase') startChase(hostess, pl); }
  pl.hidden = h;
  fx[h.type === 'wardrobe' ? 'wardrobe' : 'door'](h.pos, true);
  noise(h.f, h.pos, h.type === 'wardrobe' ? 3 : 1.5, pl);
  return true;
}
function unhideFor(pl) {
  const h = pl.hidden; if (!h) return;
  pl.hidden = null;
  for (const e of [hostess, watchman]) if (e.witness === pl.id) e.witness = null;
  if (h.type === 'wardrobe') fx.wardrobe(h.pos);
  noise(h.f, h.pos, 2.5, pl);
}
function enterHide(h, idx) {
  if (P.hideAnim) return;
  stopEmote();
  if (Net.role !== 'client' && !hideFor(P, h)) return;
  if (Net.role === 'client') { Net.send({ t: 'r', a: 'hide', i: idx }, true); P.hidden = h; }
  P.crouch = false; $('bCrouch').classList.remove('on');
  P.hideAnim = { h, t: 0, dir: 'in', from: camera.position.clone(), fromYaw: P.yaw, fromPitch: P.pitch };
  document.body.classList.add('hiding');
}
function exitHide() { const h = P.hidden; if (!h || P.hideAnim) return; P.hideAnim = { h, t: 0, dir: 'out', from: camera.position.clone() }; }
function updateHide(dt) {
  const A = P.hideAnim; if (!A) return;
  const h = A.h; A.t += dt;
  const doorsAng = (a) => { if (h.doors) h.doors.forEach(p => p.rotation.y = p.userData.s * a); };
  const yawIn = Math.atan2(-h.face[0], -h.face[1]);
  const k = Math.min(1, A.t / 0.7), e = k * k * (3 - 2 * k);
  doorsAng(h.type === 'wardrobe' ? Math.sin(Math.min(1, A.t / 0.9) * Math.PI) * 1.5 : 0);
  if (A.dir === 'in') {
    camera.position.lerpVectors(A.from, hideCam(h), e);
    P.yaw = lerpAngle(A.fromYaw, yawIn, e); P.pitch = A.fromPitch * (1 - e);
    if (A.t > 0.95) { doorsAng(0); P.hideAnim = null; P.yaw = yawIn; }
  } else {
    const out = V(cc(h.x + h.face[0]), FLOOR_Y[h.f], cc(h.z + h.face[1]));
    camera.position.lerpVectors(A.from, V(out.x, out.y + 1.6, out.z), e);
    if (A.t > 0.95) {
      doorsAng(0); P.hideAnim = null; P.pos.copy(out); P.f = h.f; P.eye = 1.6;
      if (Net.role === 'client') { P.hidden = null; Net.send({ t: 'r', a: 'unhide' }, true); } else unhideFor(P);
      document.body.classList.remove('hiding');
    }
  }
}

// ---------- поимка, жизни, дни, побег ----------
const whoOf = (e) => !e ? 'drone' : e === hostess ? 'hostess' : e === watchman ? 'watchman' : e === yard ? 'yard' : e === adam ? 'adam' : e === koch ? 'koch' : 'thing';
const enemyBy = (w) => ({ hostess, watchman, thing, yard, adam, koch })[w] || null;
const whoName = (e) => !e ? 'Дрон' : e === hostess ? 'Хозяйка' : e === watchman ? 'Сторож' : e === yard ? 'Дворник' : e === adam ? 'Тру Адам' : e === koch ? 'Коч Братан' : 'Нечто';
function caught(e, pl) {
  if (G.mode !== 'play' || pl.downed || pl.dead || pl.sacked) return;
  // сетевая игра: две жизни. Первая — валят на пол (друг поднимет), вторая — призрак. День кончается, когда на ногах никого
  if (MP()) { if (pl.lives > 1) downPlayer(e, pl); else killPlayer(e, pl); if (!standing().length) endDayAll(e); return; }
  G.splits.push({ t: G.time, what: 'День ' + G.day + ' — ' + whoName(e) + (MP() ? ' (' + pl.name + ')' : '') });
  if (pl.held) dropFor(pl, false, null, null);
  const pulled = !!pl.hidden;
  if (pl.hidden && !pl.local) unhideFor(pl);
  if (e === watchman && watchman.state === 'sleep') watchman.state = 'chase';
  if (Net.role === 'host') Net.send({ t: 'caught', who: whoOf(e), pid: pl.id, name: pl.name, splits: G.splits, pulled }, true);
  beginCaught(e, pl.id, pl.name, pulled);
}
function enemyAfter(e, pl) {
  if (!e) return;
  e.state = e === thing ? 'flee' : 'gloat'; e.timer = 3; e.path = []; e.tp = null; e.witness = null;
  if (e === thing) thingFlee(pl.pos);
}
function endDayAll(e) {
  G.splits.push({ t: G.time, what: 'День ' + G.day + ' — все выбыли' });
  if (Net.role === 'host') Net.send({ t: 'caught', who: whoOf(e), pid: '', name: '', splits: G.splits, all: true }, true);
  beginCaught(e, '', '', false, true);
}
function killPlayer(e, pl) {
  pl.lives = 0; pl.dead = true; pl.downed = false; pl.crouch = false; pl.trapped = null; pl.emote = null;
  if (pl.held) dropFor(pl, false, null, null);
  if (pl.hidden) unhideFor(pl);
  if (e && e !== thing) sayW(whoOf(e), 'catch', e.pos);
  enemyAfter(e, pl);
  G.splits.push({ t: G.time, what: 'День ' + G.day + ' — ' + pl.name + ' погиб (' + whoName(e) + ')' });
  if (Net.role === 'host') Net.send({ t: 'dead', pid: pl.id, name: pl.name }, true);
  onDead(pl.id, pl.name);
}
// ---- труп погибшего игрока: падает навзничь (рэгдолл) и лежит до конца дня; сам игрок летает призраком ----
function spawnCorpse(pl) {
  const m = makeKid(T, pl.color, pl.name || '');
  const U = m.userData; if (U.tag) U.tag.visible = false; if (U.help) U.help.visible = false; if (U.beam) U.beam.visible = false;
  m.position.set(pl.pos.x, pl.pos.y, pl.pos.z); m.rotation.order = 'YXZ'; m.rotation.y = pl.yaw + Math.PI + (Math.random() - 0.5) * 0.6;
  scene.add(m); G.corpses = G.corpses || []; G.corpses.push({ m, t: 0, side: Math.random() < 0.5 ? -1 : 1, seed: Math.random() * 6 });
}
function clearCorpses() { for (const c of G.corpses || []) scene.remove(c.m); G.corpses = []; }
function updateCorpses(dt) {
  for (const c of G.corpses || []) {
    c.t += dt; const U = c.m.userData;
    // падение: коленки подгибаются, тело заваливается на спину, лёгкий отскок
    const k = Math.min(1, c.t / 0.6), fall = k * k;
    const bounce = c.t > 0.6 && c.t < 1.0 ? Math.sin((c.t - 0.6) / 0.4 * Math.PI) * 0.12 : 0;
    c.m.rotation.x = -Math.PI / 2 * fall + bounce; c.m.rotation.z = c.side * 0.15 * fall;
    c.m.position.y = Math.max(0, 0.1 * fall);
    const s = Math.min(1, c.t / 0.8);
    U.hips.position.y = 0.82; U.spine.rotation.set(0, 0, c.side * 0.1 * s); U.neck.rotation.set(0, 0, 0);
    U.head.rotation.set(0.2 * s, c.side * 0.9 * s, 0);
    U.arms.forEach((a, i) => { a.a.rotation.set(-0.3 * s, 0, (i ? 1 : -1) * (0.2 + 1.1 * s) + Math.sin(c.seed + i) * 0.2 * s); a.b.rotation.x = -0.6 * s; });
    U.legs.forEach((l, i) => { l.a.rotation.set(-0.15 * s + (1 - s) * 0.6, 0, (i ? -1 : 1) * 0.28 * s); l.b.rotation.x = (1 - s) * 1.2 + 0.25 * s; });
  }
}
function onDead(pid, name) {
  const pl = PL.get(pid); if (pl && !pl.hasCorpse) { pl.hasCorpse = true; spawnCorpse(pl); } if (pl) { pl.dead = true; pl.downed = false; pl.lives = 0; }
  const me = pid === P.id;
  shout(me ? null : name);
  if (me) {
    P.dead = true; P.downed = false; P.reviving = null; P.trapped = null; stopEmote();
    if (P.held) setHeldView(null); updateWeapView();
    if (P.hidden) { const h = P.hidden; P.hidden = null; P.hideAnim = null; P.pos.set(cc(h.x + h.face[0]), FLOOR_Y[h.f], cc(h.z + h.face[1])); }
    document.body.classList.remove('hiding'); document.body.classList.add('ghost');
    $('red').style.opacity = 0; $('flash').style.opacity = 0.6; setTimeout(() => $('flash').style.opacity = 0, 200);
    $('ghostMsg').classList.remove('hidden'); sfx.down();
  }
  toast(me ? 'Ты погиб и стал призраком. Летай сквозь стены и подсказывай друзьям' : name + ' погиб — теперь он призрак', 4);
  $('downMsg').classList.add('hidden');
}
function downPlayer(e, pl) {
  pl.lives--; pl.downed = true; pl.crouch = false; pl.trapped = null; pl.emote = null;
  if (pl.held) dropFor(pl, false, null, null);
  const pulled = !!pl.hidden;
  if (pl.hidden) unhideFor(pl);
  if (pulled && e && e !== thing) { sayW(whoOf(e), 'pull', e.pos); subtitleAll(e, 'pull'); }
  enemyAfter(e, pl);
  if (!pulled && e) sayW(whoOf(e), 'down', e.pos);
  G.splits.push({ t: G.time, what: 'День ' + G.day + ' — ' + pl.name + ' повален (' + whoName(e) + ')' });
  if (Net.role === 'host') Net.send({ t: 'down', pid: pl.id, name: pl.name }, true);
  onDowned(pl.id, pl.name);
}
function onDowned(pid, name) {
  const me = pid === P.id;
  shout(me ? null : name);
  if (me) { P.downed = true; sfx.down(); $('red').style.opacity = 0.45; if (P.held) setHeldView(null); updateWeapView(); }
  toast(me ? 'Тебя повалили! Можно медленно ползти — ползи к другу' : name + ' повален! Подойди и держи кнопку, чтобы поднять', 4);
  $('downMsg').classList.toggle('hidden', !P.downed);
}
function revivePlayer(t, by) {
  t.downed = false;
  if (Net.role === 'host') Net.send({ t: 'up', pid: t.id, name: t.name, by: by.name }, true);
  onRevived(t.id, t.name, by.name);
}
function onRevived(pid, name, by) {
  if (pid === P.id) { P.downed = false; $('red').style.opacity = 0; updateWeapView(); }
  sfx.revive(); toast(pid === P.id ? by + ' поднял тебя! Вторую поимку уже не пережить' : name + ' снова на ногах', 3);
  $('downMsg').classList.toggle('hidden', !P.downed);
}
// пойманный игрок орёт
function shout(name) {
  say('player', 'scream');
  const el = $('shout'); el.textContent = (name ? name + ': ' : '') + 'КОЧ, БРАТАН, КОЧ!';
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
const PULL = { hostess: 'Думаешь, я слепая?', watchman: 'Думаешь, я настолько глуп?' };
function subtitle(text, cls) { const el = $('sub'); el.textContent = text; el.className = cls || ''; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function subtitleAll(e, kind) { const w = whoOf(e); if (kind !== 'pull' || !PULL[w]) return; const text = whoName(e) + ': «' + PULL[w] + '»'; subtitle(text, w); if (Net.role === 'host') Net.send({ t: 'sub', text, cls: w }, true); }
function beginCaught(e, pid, name, pulled, all) {
  if (PILOT.on) { PILOT.on = false; document.body.classList.remove('piloting'); } P.inBunker = false; $('bunker').classList.add('hidden');
  if (P.driving) { P.driving = false; document.body.classList.remove('driving'); }
  if (BT.on) { BT.on = false; stopPhonk(); document.body.classList.remove('club'); $('clubUI').classList.add('hidden'); camera.fov = 72; camera.updateProjectionMatrix(); if (P.selfAv) P.selfAv.visible = false; }
  if (TG.on) endTom(true); if (AB.on) { AB.on = false; P.ui = false; $('auraGame').classList.add('hidden'); }
  stopEmote(); P.trapped = null; $('emoteMenu').classList.add('hidden');
  G.mode = 'caught'; G.ct = 0; G.catcher = e; G.caughtPid = pid; G.fadeOn = false;
  $('hud').classList.add('hidden'); $('vign').style.opacity = 0; $('downMsg').classList.add('hidden');
  setMusic('off'); stopVoices(); closeKeypad(); closeVoiceLock(); closeSymLock(); stopTracks(); P.reviving = null; DR.active = false; if (DR.mesh) DR.mesh.visible = false;
  if (pid && pid === P.id) {
    $('flash').style.opacity = 0.85; sfx.scare();
    shout(null);
    const who = whoOf(e);
    if (!e) { sfx.boom(null); spawnBoom(V(P.pos.x, P.pos.y + 1.2, P.pos.z - 0.6)); G.shake = 1; P.climb = null; return; }
    if (who !== 'thing' && who !== 'yard') setTimeout(() => { say(who, pulled ? 'pull' : 'catch'); if (pulled) subtitle(whoName(e) + ': «' + PULL[who] + '»', who); }, pulled ? 900 : 1500);
    if (P.hidden) { const h = P.hidden; P.pos.set(cc(h.x + h.face[0]), FLOOR_Y[h.f], cc(h.z + h.face[1])); P.hidden = null; P.hideAnim = null; document.body.classList.remove('hiding'); if (h.doors) h.doors.forEach(p => p.rotation.y = p.userData.s * 1.4); }
    P.climb = null;
    const fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw), U = e.mesh.userData;
    e.pos.set(P.pos.x + fx2 * U.scareDist, P.pos.y, P.pos.z + fz2 * U.scareDist);
    e.yaw = Math.atan2(-fx2, -fz2); e.state = 'chase'; e.sync();
  } else { sfx.hurt(null); if (!all) shout(name); toast(all ? 'На ногах никого не осталось. Новый день…' : name + ' пойман! Новый день…', 2.5); }
}
function updateCaught(dt) {
  G.ct += dt;
  const e = G.catcher, t = G.ct;
  if (!e) { if (G.caughtPid === P.id) { $('flash').style.opacity = Math.max(0, 1 - t * 2).toFixed(2); $('red').style.opacity = Math.min(0.9, t).toFixed(2); camera.position.set(P.pos.x + (Math.random() - 0.5) * 0.2 * Math.max(0, 1 - t), P.pos.y + 1.4 - t * 0.6, P.pos.z); camera.rotation.z = t * 0.6; } }
  const U = e ? e.mesh.userData : null;
  if (e && G.caughtPid === P.id) {
    $('flash').style.opacity = Math.max(0, 0.85 - t * 4).toFixed(2);
    $('red').style.opacity = Math.min(0.85, t * 1.2).toFixed(2);
    const lunge = Math.min(1, t * 6);
    if (U.jaw) U.jaw.rotation.x = 0.2 + lunge * 0.6 + Math.sin(t * 40) * 0.08;
    if (U.head) { U.head.rotation.z = Math.sin(t * 31) * 0.12; U.head.rotation.x = -0.1; U.head.rotation.y = 0; }
    if (U.arms) U.arms.forEach((a, i) => { a.a.rotation.x = -1.5 + Math.sin(t * 20 + i) * 0.1; a.b.rotation.x = -0.3; a.a.rotation.z = (i ? 1 : -1) * 0.35; });
    if (U.neck) U.neck.rotation.x = -0.3;
    if (e === hostess) { U.spine.rotation.x = 0.15; U.hips.position.y = 0.92; }
    if (e === watchman) { U.hips.position.y = 0.95; U.spine.rotation.x = 0.22; U.neck.rotation.x = 0.3; U.legs.forEach(l => { l.a.rotation.x = 0; l.b.rotation.x = 0; }); U.face.map = U.faceO; }
    if (e === thing) U.jaw.scale.set(1.4, 1.6 + Math.sin(t * 30) * 0.2, 1);
    e.mesh.scale.setScalar(1 + lunge * 0.06);
    e.mesh.updateMatrixWorld(true);
    const hp = (e === thing ? U.jaw : U.head).getWorldPosition(V());
    const cp = V(P.pos.x, P.pos.y + 1.55, P.pos.z);
    camera.position.copy(cp);
    P.yaw = Math.atan2(-(hp.x - cp.x), -(hp.z - cp.z));
    P.pitch = Math.atan2(hp.y - cp.y, Math.max(0.2, Math.hypot(hp.x - cp.x, hp.z - cp.z)));
    const shake = 0.06 * Math.max(0, 1.3 - t);
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake;
  } else if (G.caughtPid !== P.id) $('red').style.opacity = Math.min(0.5, t * 0.6).toFixed(2);
  if (t > 1.5 && !G.fadeOn) { G.fadeOn = true; showFade('', ''); }
  if (t > 2.3 && isHost() && !G.dayDone) {
    G.dayDone = true;
    G.day++;
    if (G.day > D.days) { if (Net.role === 'host') Net.send({ t: 'over', splits: G.splits }, true); gameOver(); return; }
    if (Net.role === 'host') Net.send({ t: 'day', day: G.day }, true);
    startDay();
  }
}
function spawnFor(pl) {
  const [x, z] = SPAWN_CELLS[pl.idx % SPAWN_CELLS.length];
  pl.f = SPAWN_F; pl.pos.set(cc(x), FLOOR_Y[SPAWN_F], cc(z)); pl.tgt.copy(pl.pos); pl.yaw = SPAWN_YAW; pl.pitch = 0;
  pl.hidden = null; pl.crouch = false; pl.idle = 0; pl.light = false; pl.noiseT = -99; pl.lives = 2; pl.downed = false; pl.climb = null; pl.trapped = null; pl.emote = null; pl.dead = false; pl.sacked = false; pl.sackSlot = -1; pl.hasCorpse = false;
  if (pl.avatar) { pl.avatar.position.copy(pl.pos); setGhostLook(pl.avatar, false); }
  if (pl.local) { document.body.classList.remove('ghost'); $('ghostMsg').classList.add('hidden'); $('sackView').classList.add('hidden'); }
}
function startDay() {
  clearCorpses(); pbrify(scene);
  G.mode = 'daybreak'; G.dt0 = 0; G.dayDone = false;
  $('red').style.opacity = 0; if (G.catcher) G.catcher.mesh.scale.setScalar(1);
  showFade('ДЕНЬ ' + G.day, G.day === D.days ? 'последний день' : 'осталось дней: ' + (D.days - G.day + 1));
  setTimeout(() => say('narrator', 'day', null, G.day - 1), 400);
  for (const pl of players()) spawnFor(pl);
  P.hideAnim = null; P.stamina = 100; P.tired = false; P.eye = 1.6; P.ui = false; closeKeypad();
  document.body.classList.remove('hiding'); $('bCrouch').classList.remove('on'); $('bLight').classList.remove('on'); $('downMsg').classList.add('hidden');
  for (const h of furn.hides) if (h.doors) h.doors.forEach(p => p.rotation.y = 0);
  hostess.place(2, 14, 5); hostess.state = 'patrol'; hostess.stun = 0; hostess.witness = null; hostess.wait = 0; hostess.tp = null;
  watchman.place(...CHAIR); watchman.state = 'sleep'; watchman.timer = rand(...D.sleep) * (G.day === 1 ? 1 : 0.6); watchman.yaw = Math.PI; watchman.stun = 0; watchman.witness = null; watchman.wait = 0; watchman.tp = null;
  watchman.pos.z += 0.15; watchman.tgt.copy(watchman.pos); watchman.sync();
  thing.place(0, 11, 4); thing.state = 'wander'; thing.stun = 0; thing.tp = null;
  kochStart();
  yard.place(1, 21, 10); yard.state = 'patrol'; yard.stun = 0; yard.tp = null; yard.carry = null; yard.wait = 0;
  DR.active = false; DR.phase = ''; if (isHost()) scheduleDrone();
  AD.active = false; AD.fight = null; if (adam) adam.mesh.visible = false; if (isHost()) scheduleAdam();
  if (P.driving) { P.driving = false; document.body.classList.remove('driving'); } resetCar();
  for (const pl of players()) { pl.aura = false; pl.safe = false; pl.inBunker = false; }
  if (PILOT.on) { PILOT.on = false; document.body.classList.remove('piloting'); } $('bunker').classList.add('hidden'); G.pilotOther = null;
  if (AB.on) { AB.on = false; P.ui = false; $('auraGame').classList.add('hidden'); }
  for (const h of furn.hides) h.enemy = null; for (const e of [hostess, watchman, thing, yard]) { e.hideAt = null; if (e.state !== 'off') e.mesh.visible = true; }
  applyPracticeEnemies();
  thing.mesh.userData.jaw.scale.set(1, 1, 1);
  doll.x = DOLL_X1; doll.dir = -1; doll.stun = 0; doll.cool = 0; doll.wait = 0;
  G.danceT = rand(...D.dance); G.danceLeft = 0;
  if (isHost()) placeStartTraps();
  $('dayline').firstChild.textContent = 'День ' + G.day; $('dname').textContent = (D.days > 50 ? ' · без лимита дней' : ' из ' + D.days) + ' · ' + (G.practice ? 'Практика · ' : '') + D.name + (MP() ? ' · игроков: ' + PL.size : '');
  $('hud').classList.remove('hidden');
  updateHUD();
}
function winAll(type) {
  if (G.mode !== 'play' && G.mode !== 'daybreak') return;
  G.splits.push({ t: G.time, what: 'Побег: ' + ESCAPES[type].name });
  if (Net.role === 'host') Net.send({ t: 'win', type, splits: G.splits, tm: G.time }, true);
  startEscape(type);
}
function startEscape(type) {
  G.mode = 'escape'; G.et = 0; G.escType = type; $('hud').classList.add('hidden'); closeKeypad();
  if (P.held) setHeldView(null);
  if (type === 'gate') { P.pos.set(cc(9), 0, CS * 0.6); P.yaw = 0; }
  if (type === 'van') { sfx.carStart(van.position); P.pos.set(van.position.x + 6, 1.4, van.position.z); P.yaw = Math.PI / 2; }
  P.pitch = 0; P.hidden = null; P.hideAnim = null; P.eye = 1.6; P.downed = false; P.climb = null; document.body.classList.remove('hiding'); $('downMsg').classList.add('hidden'); $('red').style.opacity = 0;
}
function updateEscape(dt) {
  G.et += dt;
  const t = G.escType;
  if (t === 'gate') { P.pos.z -= dt * 3.2; }
  if (t === 'van') { van.position.x -= dt * (1 + G.et * 4); P.pos.set(van.position.x + 6 + G.et * 0.5, 1.4, van.position.z); P.yaw = Math.PI / 2; P.pitch = -0.12; }
  const long = t === 'van' ? 3 : 0;   // на фургоне едем подольше по прямой
  if (G.et > 2.6 + long && !G.escFade) { G.escFade = true; showFade(t === 'van' ? 'ПРОДОЛЖЕНИЕ СЛЕДУЕТ…' : '', ''); }
  if (G.et > 3.6 + long) { G.escFade = false; finish(true); }
}
// концовка смерти (своя для каждого, кто поймал последним), потом — экран результата
function gameOver() {
  if (G.ending) return; G.ending = true;
  const who = whoOf(G.catcher), E = ending1(who);
  G.endWho = who; hideFade(); $('red').style.opacity = 0; $('hud').classList.add('hidden');
  setMusic('off'); stopTracks(); sfx.lose();
  playEnding({ draw: E.draw, lines: E.lines, title: E.title, onDone: () => finish(false) });
}
function finish(win) {
  G.mode = 'over'; setMusic('off'); stopTracks();
  if (win) {
    sfx.win(); say('narrator', 'win');
    let best = null, rec = false;
    if (G.practice) { $('resTitle').textContent = G.escType === 'van' ? 'ПРОДОЛЖЕНИЕ СЛЕДУЕТ…' : 'СВОБОДА'; $('resSub').textContent = 'Практика · ' + ESCAPES[G.escType].how + ' · рекорд не записывается'; $('resTime').textContent = fmt(G.time); }
    else {
    const key = 'hushwood.best.' + diffKey + (MP() ? '.coop' : '');
    try { best = parseFloat(localStorage.getItem(key)); if (!(best > 0) || G.time < best) { localStorage.setItem(key, String(G.time)); localStorage.setItem('hushwood.bestinfo.' + diffKey + (MP() ? '.coop' : ''), JSON.stringify({ esc: ESCAPES[G.escType].name, day: G.day, date: new Date().toLocaleDateString('ru-RU') })); rec = true; } } catch (e) { }
    $('resTitle').textContent = G.escType === 'van' ? 'ПРОДОЛЖЕНИЕ СЛЕДУЕТ…' : 'СВОБОДА';
    try { localStorage.setItem('hushwood.boom', G.houseGone ? '1' : '0'); } catch (e) { }
    if (G.escType === 'van') { try { localStorage.setItem('hushwood.ch2', '1'); } catch (e) { } setTimeout(() => toast('Открыта ГЛАВА 2 · КВАРТИРА — выбери её в меню «Играть»', 5), 800); }
    $('resSub').textContent = (MP() ? 'Вы сбежали ' : 'Ты сбежал ') + ESCAPES[G.escType].how + ' · ' + D.name + ' · день ' + G.day + ' из ' + D.days + (MP() ? ' · кооператив' : '');
    $('resTime').textContent = fmt(G.time) + (rec ? '  — новый рекорд!' : best > 0 ? '  (рекорд ' + fmt(best) + ')' : '');
    }
  } else {
    setTimeout(() => say('narrator', 'over'), 300);
    const E = ending1(G.endWho || whoOf(G.catcher));
    $('resTitle').textContent = 'КОНЦОВКА: ' + E.title;
    $('resSub').textContent = E.lines[E.lines.length - 1] + ' · ' + D.name + ' сложность.';
    $('resTime').textContent = fmt(G.time);
  }
  $('resSplits').innerHTML = G.splits.map(s => fmt(s.t) + ' · ' + s.what).join('<br>');
  $('bAgain').classList.toggle('hidden', Net.role === 'client');
  $('hud').classList.add('hidden'); hideFade(); $('downMsg').classList.add('hidden');
  $('result').classList.remove('hidden');
  document.exitPointerLock && document.exitPointerLock();
}
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); }

// ---------- раскладка предметов (с проверкой, что игра проходима) ----------
function solvable(place) {
  const have = new Set(); let changed = true;
  const ok = (spot) => ZONE_REQ[zoneOf(spot[0], spot[1], spot[2])].every(k => have.has(k));
  while (changed) { changed = false; for (const id in place) if (!have.has(id) && ok(place[id])) { have.add(id); changed = true; } }
  return Object.keys(place).every(id => have.has(id));
}
function planItems() {
  const ids = [...KEY_ITEMS, ...(GATE_EXTRA[diffKey] || [])];
  if (!D.random) { const p = {}; ids.forEach(id => p[id] = DEFAULT_ITEMS[id]); return { place: p, notes: [0, 4, 7] }; }
  for (let tries = 0; tries < 400; tries++) {
    const pool = shuffle(SPOTS.slice()); const p = {};
    ids.forEach((id, i) => p[id] = pool[i]);
    // ключи от замков не лежат слишком «легко»: хотя бы два важных предмета — за замками
    const locked = ids.filter(id => ZONE_REQ[zoneOf(...p[id])].length).length;
    if (locked < (diffKey === 'easy' ? 3 : 5)) continue;
    if (solvable(p)) return { place: p, notes: shuffle([...Array(furn.notes.length).keys()]).slice(0, 3) };
  }
  const p = {}; ids.forEach(id => p[id] = DEFAULT_ITEMS[id]); return { place: p, notes: [0, 4, 7] };
}

// ---------- запуск игры ----------
function resetWorld(key, practice) {
  diffKey = key; G.practice = practice || null; G.ending = false; G.endWho = null; stopEnding();
  D = G.practice ? Object.assign({}, DIFFS[key], { glow: G.practice.glow || DIFFS[key].glow, days: G.practice.endless ? 99 : DIFFS[key].days }) : DIFFS[key];
  maps = buildMaps();
  if (G.dyn) scene.remove(G.dyn);
  G.dyn = new THREE.Group(); scene.add(G.dyn);
  G.objects = []; G.byNid = new Map(); G.nidSeq = 1; G.shards = []; G.flares = []; G.splits = []; G.time = 0; G.day = 1; G.escFade = false; G.dollKey = false; G.notes = [];
  G.traps = []; G.trapSeq = 0; G.trapCD = 25;
  AD.beaten = false; CAR.unlocked = false; G.bunkerShahed = false; G.kochDug = false; G.banyaOpen = false;
  if (G.houseGone) { G.houseGone = false; setHouseGone(false); furn.root.visible = true; if (G.ruins) { scene.remove(G.ruins); G.ruins = null; } G.fires = null; for (const l of LAMPS) (l.meshes || []).forEach(m => m.visible = true); if (G.dollRail) G.dollRail.visible = true; G.broken = [1]; }
  P.inv = {}; $('bMap').classList.add('hidden');
  if (G.broken && G.broken.length) { G.broken = []; rebuildWorld(); } G.broken = [];
  if (gateM) gateM.visible = true;
  G.esc = { gateOpen: false, gate: {} };
  for (const pl of players()) { pl.weapons = { slingshot: false, flaregun: false }; pl.weap = null; pl.stones = 0; pl.flareAmmo = 0; pl.held = null; pl.hidden = null; pl.known = {}; pl.symKnown = {}; pl.downed = false; }
  setHeldView(null);
  buildDoors(G.dyn);
  const sec = furn.secret; sec.open = false; sec.moving = false; sec.t = 0; sec.shelf.position.z = 0;
  if (sec.gearMesh) { sec.socket.remove(sec.gearMesh); sec.gearMesh = null; }
  const ch = furn.chest; ch.open = false; ch.lid.rotation.x = 0; ch.lock.visible = true;
  const sf = furn.safe; sf.open = false; sf.door.rotation.y = 0;
  const ht = furn.hatch; ht.open = false; ht.t = 0; ht.panel.rotation.z = 0; ht.ladder.visible = false;
  gateM = bakeRig(makeGate()); gateM.position.set(cc(9), 0, CS * 0.5); G.dyn.add(gateM);
  applyEscVisual('gate');
  ensureEnemies(); applyBanyaVisual();
  // освещение по сложности
  hemi.intensity = 0.9 * D.ambient; moon.intensity = 0.5 * D.ambient;
  scene.fog.color.setHex(D.dark ? 0x000000 : 0x05060a); scene.background.setHex(D.dark ? 0x000000 : 0x05060a);
  P.battery = 100;
  ['menu', 'result', 'pause', 'pSettings', 'pRec', 'pHelp', 'pNet', 'pSafe', 'pPractice', 'pVoice', 'pSym'].forEach(i => $(i).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  $('bRestart').classList.toggle('hidden', MP());
}
function chooseLamps() {
  const off = new Set();
  LAMPS.forEach((l, i) => { if (!l.noOff && Math.random() < D.lampOff) off.add(i); });
  // на каждом этаже хотя бы одна лампа горит (кроме кошмара — там можно остаться в темноте на чердаке)
  for (let f = 0; f < 4; f++) { const ids = LAMPS.map((l, i) => i).filter(i => LAMPS[i].f === f); if (ids.length && ids.every(i => off.has(i)) && !(D.dark && f === 3)) off.delete(ids[0]); }
  return [...off];
}
function applyLamps(list) { G.lampOff = new Set(list); LAMPS.forEach((l, i) => { l.on = !G.lampOff.has(i); l.bulb.material = l.on ? l.onMat : l.offMat; }); }
function placeItems() {
  const plan = planItems();
  for (const id in plan.place) addObject(id, ...plan.place[id], 'item');
  for (const [f, x, z, id] of PROP_SPOTS) addObject(id, f, x, z, 'prop');
  addObject('slingshot', 0, 18, 3, 'item');
  addObject('stones', 0, 16, 5, 'item'); addObject('stones', 1, 2, 15, 'item'); addObject('stones', 2, 12, 11, 'item');
  addObject('carkey', 1, 4, 11, 'item');
  const fg = addObject('flaregun', 0, 18, 4, 'item'); fg.pos.copy(furn.chest.inside); fg.mesh.position.copy(fg.pos); fg.locked = true; fg.home.pos.copy(fg.pos);
  placeRemote();
  const gk = addObject('gatekey', 3, 16, 9, 'item'); gk.pos.copy(furn.safe.inside); gk.mesh.position.copy(gk.pos); gk.locked = true; gk.home.pos.copy(gk.pos);
  G.code = String(1000 + Math.floor(Math.random() * 9000));
  G.word = WORDS[(Math.random() * WORDS.length) | 0];
  G.sym = [0, 1, 2].map(() => (Math.random() * SYM_NAMES.length) | 0);
  placeSigns(shuffle([...Array(SIGN_SPOTS.length).keys()]).slice(0, 3));
  placeNotes(plan.notes); G.noteIdx = plan.notes;
}
function newGame(key, practice) {
  try { localStorage.setItem('hushwood.diff', key); } catch (e) { }
  resetWorld(key, practice);
  applyLamps(chooseLamps());
  placeItems();
  updateWeapView();
  startDay();
  setMusic('ambient');
  toast(MP() ? 'Сбегите вместе! Предметы общие, дни тоже.' : 'Найди путь наружу. Пауза — подсказки.', 3.5);
}
function ensureEnemies() {
  if (hostess) return;
  hostess = new Walker(makeHostess(T), allowUpper); scene.add(hostess.mesh);
  watchman = new Walker(makeWatchman(T), allowUpper); scene.add(watchman.mesh);
  thing = new Walker(makeThing(T), allowThing); scene.add(thing.mesh);
  yard = new Walker(makeYardman(T), allowYard); scene.add(yard.mesh); yard.state = 'patrol';
  adam = new Walker(makeAdam(T), allowAdam); scene.add(adam.mesh); adam.mesh.visible = false; adam.state = 'walk';
  koch = new Walker(makeKoch(T), () => false); scene.add(koch.mesh); koch.state = 'relax';
  { const gm = LM({ color: 0x2a2a2a, map: T.metal }), hole = new THREE.MeshBasicMaterial({ color: 0x020202, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), gg = new THREE.Group();
    for (const [f, x, z] of THING_VENTS) { const h = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), hole); h.rotation.x = -Math.PI / 2; h.position.set(cc(x), FLOOR_Y[f] + 0.012, cc(z)); gg.add(h); for (let i = 0; i < 6; i++) gg.add(box(0.05, 0.03, 0.9, gm, cc(x) - 0.4 + i * 0.16, FLOOR_Y[f] + 0.02, cc(z))); }
    scene.add(gg); }   // отдушины в полу подвала — через них ползает Нечто
  CAR.mesh = makeCar(T); scene.add(CAR.mesh); resetCar();
  buildRoad(); buildBunker(); buildOutside(); buildArena(); buildClub(); buildBanyaOutside(); buildUnderBanya();
  if (!SUR) SUR = buildSurroundings(scene, T);
  // метка выхода для ивента с дроном
  { const ex = exitPos(); const g = new THREE.Group(); g.position.copy(ex);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 32), new THREE.MeshBasicMaterial({ color: 0x40ff60, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const cg = c.getContext('2d'); cg.fillStyle = 'rgba(0,40,0,0.6)'; cg.fillRect(0, 0, 256, 96); cg.fillStyle = '#60ff80'; cg.font = 'bold 56px Osw, Arial'; cg.textAlign = 'center'; cg.fillText('ВЫХОД', 128, 68);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); sp.scale.set(1.4, 0.52, 1); sp.position.y = 2.1; sp.renderOrder = 7; g.add(sp);
    g.visible = false; scene.add(g); G.exitMark = g; }
  // мешки с картошкой в сарае — среди них дворник прячет пойманных
  G.sackMeshes = SACK_SLOTS.map(([sx, sz], i) => { const m = makeSack(); m.position.set(sx * CS, 0, sz * CS); m.rotation.y = i * 1.3; m.scale.setScalar(0.9 + (i % 3) * 0.06); scene.add(m); COLS[1].push({ f: 1, x0: sx * CS - 0.28, x1: sx * CS + 0.28, z0: sz * CS - 0.28, z1: sz * CS + 0.28, y0: 0, y1: 0.8 }); return m; });
  const dm = makeDoll(T); scene.add(dm);
  doll = { mesh: dm, x: DOLL_X1, dir: -1, stun: 0, cool: 0, wait: 0 };
  if (SHADOWS) [hostess.mesh, watchman.mesh, thing.mesh, yard.mesh, dm].forEach(m => m.traverse(o => { if (o.isMesh) o.castShadow = true; }));
  const rail = box((DOLL_X1 - DOLL_X0) + 1.2, 0.06, 0.1, LM({ map: T.metal }));
  rail.position.set((DOLL_X0 + DOLL_X1) / 2, 2.95, DOLL_Z); scene.add(rail); G.dollRail = rail;
}

// ---------- практика: убрать выбранных врагов ----------
function applyPracticeEnemies() {
  const pr = G.practice || {};
  const set = (e, off) => { e.mesh.visible = !off; if (off) { e.state = 'off'; e.path = []; e.pos.set(-60, -60, -60); e.sync(); } };
  set(hostess, pr.noHostess); set(watchman, pr.noWatchman); set(thing, pr.noThing); set(yard, pr.noYard); if (koch) { koch.mesh.visible = !pr.noKoch; if (pr.noKoch) koch.pos.set(-60, -60, -60), koch.sync(); }
  if (pr.noDrone) G.droneT = 1e9;
  doll.mesh.visible = !pr.noDoll; doll.off = !!pr.noDoll;
  // без куклы ключик от сундука просто лежит в коридоре
  if (pr.noDoll && !G.dollKey) { G.dollKey = true; addObject('smallkey', 1, 9, 9, 'item'); }
}

// ---------- свет: пул ламп ----------
let lightT = 0;
function updateLights(dt) {
  lightT = Math.min(lightT, 0.15) - dt;
  const flareObj = G.objects.find(o => o.id === 'flare' && !o.broken);
  if (lightT <= 0) {
    lightT = 0.15;
    const cp = camera.position, f = P.f;
    const cand = LAMPS.filter(l => l.on).map(l => ({ l, s: l.pos.distanceTo(cp) + (l.f === f ? 0 : 12) })).sort((a, b) => a.s - b.s);
    G.poolSel = cand.slice(0, POOL.length).map(c => c.l);
  }
  const sel = G.poolSel || [];
  const t = now() + mt;
  POOL.forEach((pl, i) => {
    if (i === POOL.length - 1 && G.boomLight) { pl.position.copy(G.boomLight.pos); pl.color.setHex(0xff8030); pl.distance = 26; pl.intensity = 140 * G.boomLight.t; return; }
    if (i === POOL.length - 1 && flareObj) { pl.position.copy(flareObj.pos); pl.position.y += 0.2; pl.color.setHex(0xff5020); pl.distance = 14; pl.intensity = 12 * (0.8 + Math.random() * 0.4); return; }
    const l = sel[i];
    if (!l) { pl.intensity = 0; return; }
    pl.position.copy(l.pos); pl.color.setHex(l.col); pl.distance = l.d;
    const base = l.i * 1.5 * (D ? D.light : 1);
    pl.intensity = l.flick ? base * (Math.random() < 0.03 ? 0.2 : 0.9 + Math.sin(t * 13 + i) * 0.1) : base;
    if (l.f === 0 && thing && (thing.state === 'hunt' || thing.state === 'rise') && thing.pos.distanceTo(l.pos) < 7) pl.intensity *= Math.random() < 0.25 ? 0.05 : 0.6 + Math.random() * 0.4;   // Нечто рядом — лампы мигают
  });
}

// ================= СЕТЕВАЯ ИГРА =================
function setupPlayers(list) {
  for (const pl of players()) if (pl.avatar) { scene.remove(pl.avatar); pl.avatar = null; }
  PL.clear();
  for (const [id, name, idx] of list) {
    const local = id === Net.myId;
    const pl = local ? P : newPlayer(id, name, COLORS[idx % 4], false);
    if (local) { P.id = id; P.name = name; P.color = COLORS[idx % 4]; }
    pl.idx = idx;
    if (!local) { pl.avatar = makeKid(T, pl.color, name); scene.add(pl.avatar); }
    PL.set(id, pl);
  }
}
function singlePlayers() {
  for (const pl of players()) if (pl.avatar) scene.remove(pl.avatar);
  PL.clear(); P.id = 'me'; P.idx = 0; P.downed = false; PL.set(P.id, P);
}
function hostStart() {
  Net.lock(true);
  const list = [[Net.myId, Net.myName, 0], ...[...Net.peers.entries()].map(([id, name], i) => [id, name, i + 1])];
  setupPlayers(list);
  newGame(diffKey);
  Net.send({ t: 'start', diff: diffKey, players: list, objs: G.objects.map(packFull), code: G.code, word: G.word, sym: G.sym, signs: G.signIdx, notes: G.noteIdx, lamps: [...G.lampOff] }, true);
}
function clientStart(m) {
  setupPlayers(m.players);
  resetWorld(m.diff);
  applyLamps(m.lamps || []);
  for (const a of m.objs) objFromNet(a);
  G.code = m.code; G.word = m.word; placeNotes(m.notes); G.sym = m.sym; placeSigns(m.signs);
  updateWeapView();
  G.day = 1; startDay();
  setMusic('ambient');
  toast('Сбегите вместе! Предметы общие, дни тоже.', 3.5);
}
function makeSnapshot(full) {
  const ep = (e) => [e.f, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), r2(e.yaw), e.state, e.stun > 0 ? r2(e.stun) : 0, e.moving ? 1 : 0, r2(e.anim), r2(e.speedNow), r2(e.tiltX || 0), r2(e.tiltZ || 0), e.rag ? (e.rag.air ? 2 : 1) : 0];
  const doors = [], locks = [];
  const blown = [];
  for (const d of G.doors.values()) { doors.push(d.open ? 1 : 0); locks.push(d.locked ? 1 : 0); blown.push(d.blown ? 1 : 0); }
  const objs = [];
  for (const o of G.objects) if (full || o.dirty) { objs.push(packObj(o)); o.dirty = false; }
  const sec = furn.secret;
  return {
    t: 's', tm: r2(G.time), day: G.day, dt: r2(G.danceTime),
    e: [ep(hostess), ep(watchman), ep(thing), ep(yard)],
    yc: yard.carry || '',
    ad: [AD.active ? 1 : 0, AD.beaten ? 1 : 0, r2(adam.pos.x), r2(adam.pos.y), r2(adam.pos.z), r2(adam.yaw), adam.f, AD.fight ? 1 : 0, adam.moving ? 1 : 0, r2(adam.anim)],
    car: [r2(CAR.pos.x), r2(CAR.pos.z), r2(CAR.yaw), r2(CAR.sp), CAR.dead ? 1 : 0, CAR.driver || '', CAR.radio, CAR.unlocked ? 1 : 0, r2(CAR.radioT)],
    kb: [r2(koch.pos.x), r2(koch.pos.z), r2(koch.yaw), KB.mode, koch.moving ? 1 : 0, r2(koch.anim), r2(KB.steamT), G.kochDug ? 1 : 0, G.banyaOpen ? 1 : 0, r2(KB.timer), r2(koch.tiltX || 0), r2(koch.tiltZ || 0), koch.rag ? 1 : 0],
    brk: G.broken, gb: G.esc.gateBlown ? 1 : 0, hg: G.houseGone ? 1 : 0, bs: G.bunkerShahed ? 1 : 0, pd: PILOT.on ? [r2(PILOT.pos.x), r2(PILOT.pos.y), r2(PILOT.pos.z), r2(P.yaw)] : (G.pilotOther || 0),
    drn: DR.active ? [r2(DR.pos.x), r2(DR.pos.y), r2(DR.pos.z), r2(DR.vel.x), r2(DR.vel.y), r2(DR.vel.z), DR.phase === 'chase' ? 1 : 2, r2(DR.t)] : 0,
    dl: [r2(doll.x), doll.dir, r2(doll.stun), r2(doll.cool)],
    dr: doors.join(''), lk: locks.join(''), bw: blown.join(''),
    es: G.esc, sc: [sec.open ? 1 : 0, sec.moving ? 1 : 0, r2(sec.t)], ch: furn.chest.open ? 1 : 0, sf: furn.safe.open ? 1 : 0, ht: furn.hatch.open ? 1 : 0,
    pl: players().map(p => [p.id, p.f, r2(p.pos.x), r2(p.pos.y), r2(p.pos.z), r2(p.yaw), r2(p.pitch), p.crouch ? 1 : 0, p.hidden ? furn.hides.indexOf(p.hidden) : -1, p.light ? 1 : 0, r2(p.moving || 0), p.downed ? 1 : 0, p.lives, p.emote ? (p.emote.k || p.emote) : 0, r2(p.emote ? (p.emote.t !== undefined ? p.emote.t : p.emoteT || 0) : 0), p.dead ? 1 : 0, p.sacked ? 1 : 0, p.sackSlot === undefined ? -1 : p.sackSlot, r2(p.wiggleT || 0)]),
    tr: G.traps.map(t => [t.id, t.f, r2(t.pos.x), r2(t.pos.z), t.armed ? 1 : 0, t.gone ? 1 : 0]),
    o: objs,
  };
}
function applySnapshot(s) {
  if (G.mode !== 'play' && G.mode !== 'daybreak') return;
  G.time = s.tm; G.danceTime = s.dt;
  yard.carry = s.yc || null;
  if (s.hg && !G.houseGone && !G.houseBooming) destroyHouse();
  G.pilotOther = s.pd || null; G.bunkerShahed = !!s.bs;
  if (s.kb) { const k = s.kb; koch.tgt.set(k[0], 0, k[1]); koch.tyaw = k[2]; koch.state = k[3]; koch.moving = !!k[4]; koch.anim = k[5]; koch.speedNow = 2; if (k[6] > KB.steamT + 1) sfx.steam(null); KB.steamT = k[6]; KB.timer = k[9]; koch.tiltX = k[10] || 0; koch.tiltZ = k[11] || 0; koch.rag = k[12] ? (koch.rag || { seed: Math.random() * 10, air: false }) : null; if (!!k[7] !== !!G.kochDug || !!k[8] !== !!G.banyaOpen) { G.kochDug = !!k[7]; G.banyaOpen = !!k[8]; applyBanyaVisual(); } } if (P.inBunker && !PILOT.on) refreshBunker();
  if (s.ad) { AD.active = !!s.ad[0]; AD.beaten = !!s.ad[1]; adam.tgt.set(s.ad[2], s.ad[3], s.ad[4]); adam.tyaw = s.ad[5]; adam.f = s.ad[6]; adam.state = s.ad[7] ? 'pose' : 'walk'; adam.moving = !!s.ad[8]; adam.anim = s.ad[9]; adam.speedNow = 1.9; }
  if (s.car) { const c2 = s.car; CAR.driver = c2[5] || null; CAR.dead = !!c2[4]; CAR.unlocked = !!c2[7]; if (CAR.driver !== P.id) { CAR.pos.set(c2[0], 0, c2[1]); CAR.yaw = c2[2]; CAR.sp = c2[3]; CAR.radio = c2[6]; CAR.radioT = c2[8]; } }
  if (s.brk && s.brk.length !== G.broken.length) { G.broken = s.brk.map(a => a.slice()); for (const [x, z] of G.broken) maps[1][z][x] = '.'; rebuildWorld(); }
  if ((s.gb || (s.es && s.es.gateBlown)) && gateM && gateM.visible) { gateM.visible = false; maps[1][0][9] = '.'; }
  if (s.drn) { if (!DR.active) { DR.pos.set(s.drn[0], s.drn[1], s.drn[2]); DR.t = s.drn[7]; } DR.active = true; DR.tgt.set(s.drn[0], s.drn[1], s.drn[2]); DR.vel.set(s.drn[3], s.drn[4], s.drn[5]); DR.phase = s.drn[6] === 1 ? 'chase' : 'leave'; if (Math.abs(DR.t - s.drn[7]) > 1) DR.t = s.drn[7]; } else DR.active = false;
  [hostess, watchman, thing, yard].forEach((e, i) => {
    const a = s.e[i]; e.f = a[0]; e.tgt.set(a[1], a[2], a[3]); e.tyaw = a[4]; e.state = a[5]; e.stun = a[6]; e.moving = !!a[7]; e.anim = a[8]; e.speedNow = a[9]; e.tiltX = a[10]; e.tiltZ = a[11]; e.rag = a[12] ? (e.rag || { seed: Math.random() * 10, air: a[12] === 2 }) : null; if (e.rag) e.rag.air = a[12] === 2;
  });
  doll.x = s.dl[0]; doll.dir = s.dl[1]; doll.stun = s.dl[2]; doll.cool = s.dl[3];
  let i = 0;
  for (const d of G.doors.values()) { d.open = s.dr[i] === '1'; if (s.bw && s.bw[i] === '1' && !d.blown) blowDoor(d); if (d.locked && s.lk[i] === '0') unlockDoor(d); i++; }
  const prevGate = G.esc.gateOpen;
  G.esc = s.es; applyEscVisual('gate');
  if (G.esc.gateOpen && !prevGate) maps[1][0][9] = '.';
  const sec = furn.secret;
  if (s.sc[1] && !sec.moving && !sec.open) startSecret();
  if (s.sc[0] && !sec.open) { sec.open = true; sec.moving = false; sec.shelf.position.z = 1.9; maps[0][4][14] = '.'; }
  if (s.ch && !furn.chest.open) openChest();
  if (s.sf && !furn.safe.open) openSafe();
  if (s.ht) furn.hatch.open = true;
  for (const a of s.o) applyObj(a);
  if (s.tr) syncTraps(s.tr);
  for (const a of s.pl) {
    const pl = PL.get(a[0]); if (!pl) continue;
    if (pl.local) { pl.lives = a[12]; P.sackSlot = a[17]; if (a[16]) { P.pos.set(a[2], a[3], a[4]); P.f = a[1]; } continue; }
    pl.f = a[1]; pl.tgt.set(a[2], a[3], a[4]); pl.pos.copy(pl.tgt); pl.yaw = a[5]; pl.pitch = a[6]; pl.crouch = !!a[7];
    pl.hidden = a[8] >= 0 ? furn.hides[a[8]] : null; pl.light = !!a[9]; pl.moving = a[10]; pl.downed = !!a[11]; pl.lives = a[12];
    pl.dead = !!a[15]; pl.sacked = !!a[16]; pl.sackSlot = a[17]; pl.wiggleT = a[18];
    if (a[13]) { if (pl.emote !== a[13] || Math.abs((pl.emoteT || 0) - a[14]) > 0.5) pl.emoteT = a[14]; pl.emote = a[13]; } else pl.emote = 0;
  }
}
function clientEnemies(dt) {
  if (DR.active) { if (DR.pos.distanceTo(DR.tgt) > 6) DR.pos.copy(DR.tgt); else DR.pos.lerp(DR.tgt, Math.min(1, dt * 8)); DR.t += dt; }
  for (const e of [hostess, watchman, thing, yard]) {
    e.mesh.visible = e.state !== 'indrone' && e.state !== 'off' && e.state !== 'lurk';
    if (e.pos.distanceTo(e.tgt) > 4) e.pos.copy(e.tgt); else e.pos.lerp(e.tgt, Math.min(1, dt * 10));
    e.yaw = lerpAngle(e.yaw, e.tyaw, Math.min(1, dt * 10));
    e.sync();
  }
  if (hostess.state === 'dance') G.danceTime += dt;
  animHostess(); animWatchman(); animThing(); animDoll(dt); animYard();
  if (koch) { if (koch.pos.distanceTo(koch.tgt) > 4) koch.pos.copy(koch.tgt); else koch.pos.lerp(koch.tgt, Math.min(1, dt * 10)); koch.yaw = lerpAngle(koch.yaw, koch.tyaw, Math.min(1, dt * 10)); KB.mode = koch.state; KB.steamT = Math.max(0, KB.steamT - dt); animKoch(dt); koch.sync(); }
  adam.mesh.visible = AD.active; if (AD.active) { if (adam.pos.distanceTo(adam.tgt) > 4) adam.pos.copy(adam.tgt); else adam.pos.lerp(adam.tgt, Math.min(1, dt * 10)); adam.yaw = lerpAngle(adam.yaw, adam.tyaw, Math.min(1, dt * 10)); animAdam(); adam.sync(); }
  hostess.bell = (hostess.bell || 0) - dt;
  if (hostess.moving && hostess.bell <= 0) { sfx.bell(V(hostess.pos.x, hostess.pos.y + 1.4, hostess.pos.z)); hostess.bell = hostess.state === 'chase' ? 0.32 : 0.75; }
}
function netTick(dt) {
  if (Net.role === 'host') {
    G.snapT -= dt; G.fullT -= dt;
    if (G.snapT <= 0) { G.snapT = 0.1; const full = G.fullT <= 0; if (full) G.fullT = 3; Net.send(makeSnapshot(full), full); }
  } else if (Net.role === 'client') {
    G.poseT -= dt;
    if (G.poseT <= 0 && PILOT.on) Net.send({ t: 'pd', a: [r2(PILOT.pos.x), r2(PILOT.pos.y), r2(PILOT.pos.z), r2(P.yaw)] });
    if (G.poseT <= 0 && P.driving) Net.send({ t: 'car', a: [r2(CAR.pos.x), r2(CAR.pos.z), r2(CAR.yaw), r2(CAR.sp), CAR.radio, r2(CAR.radioT)] });
    if (G.poseT <= 0) { G.poseT = 1 / 15; Net.send({ t: 'p', a: [P.f, r2(P.pos.x), r2(P.pos.y), r2(P.pos.z), r2(P.yaw), r2(P.pitch), P.crouch ? 1 : 0, P.sprint ? 1 : 0, P.light ? 1 : 0, r2(P.idle), r2(P.moving || 0), P.climb ? 1 : 0, P.emote ? P.emote.k : 0, P.emote ? r2(P.emote.t) : 0] }); }
  }
}
Net.on('msg', ({ from, m }) => {
  if (m.t && m.t.startsWith('c2')) { if (CH2) CH2.net(m, from); return; }   // вторая глава считает себя сама
  if (m.t === 'start2' && Net.role === 'client') { startChapter2(false, m.players); return; }
  if (Net.role === 'host') {
    const pl = PL.get(from); if (!pl) return;
    if (m.t === 'pd') { G.pilotOther = m.a; return; }
    if (m.t === 'car') { if (CAR.driver === from) { CAR.pos.set(m.a[0], 0, m.a[1]); CAR.yaw = m.a[2]; CAR.sp = m.a[3]; CAR.radio = m.a[4]; CAR.radioT = m.a[5]; } return; }
    if (m.a === undefined && m.t === 'carout') return;
    if (m.t === 'p') { const a = m.a; const stale = pl.teleTo && performance.now() - pl.teleAt < 2500 && Math.hypot(a[1] - pl.teleTo.x, a[3] - pl.teleTo.z) > 3; if (pl.teleTo && !stale) pl.teleTo = null; if (!pl.sacked && !stale) { pl.f = a[0]; pl.pos.set(a[1], a[2], a[3]); pl.tgt.copy(pl.pos); pl.crouch = !!a[6]; pl.sprint = !!a[7]; pl.idle = a[9]; pl.moving = a[10]; pl.climb = a[11] ? {} : null; if (a[12]) { if (pl.emote !== a[12] || Math.abs((pl.emoteT || 0) - a[13]) > 0.5) pl.emoteT = a[13]; pl.emote = a[12]; } else pl.emote = 0; } pl.yaw = a[4]; pl.pitch = a[5]; pl.light = !!a[8]; }
    else if (m.t === 'n') { if (G.mode === 'play' && !pl.downed) noise(m.f, V(...m.p), m.r, pl); }
    else if (m.t === 'r' && G.mode === 'play' && !pl.downed) {
      if (m.a === 'act') { const c = decodeC(m.c); if (c && !pl.dead && !pl.sacked) performAction(pl, c); }
      else if (m.a === 'drop') dropFor(pl, m.thr, V(...m.s), V(...m.d));
      else if (m.a === 'fire') fireFor(pl, m.w, V(...m.s), V(...m.d));
      else if (m.a === 'hide') { const h = furn.hides[m.i]; if (h && !hideFor(pl, h)) Net.send({ t: 'unhide' }, true, pl.id); }
      else if (m.a === 'unhide') unhideFor(pl);
      else if (m.a === 'gate' && G.esc.gateOpen) winAll('gate');
      else if (m.a === 'code') tryCode(pl, String(m.code));
      else if (m.a === 'sym') trySym(pl, m.code);
      else if (m.a === 'trap') { const t = G.traps.find(t => t.id === m.id); if (t && t.armed) springTrap(t, pl); }
      else if (m.a === 'wiggle') wiggleSack(pl);
      else if (m.a === 'aura') auraResult(pl, !!m.win);
      else if (m.a === 'bunker') pl.inBunker = !!m.on;
      else if (m.a === 'useshahed') { if (pl.held && pl.held.id === 'shahed') consumeFor(pl); }
      else if (m.a === 'pboom') { if (m.house && !G.houseGone) houseBoom(V(...m.p)); else { explodeAt(V(...m.p), m.f, pl, { shahed: true }); shahedMissed(); } G.pilotOther = null; }
      else if (m.a === 'plaunch') G.bunkerShahed = false;
      else if (m.a === 'faint') { if (inBanya(pl)) caught(koch, pl); }
      else if (m.a === 'carout') { if (CAR.driver === pl.id) { CAR.driver = null; CAR.pos.set(m.car[0], 0, m.car[1]); CAR.yaw = m.car[2]; if (m.car[3]) CAR.dead = true; } }
      else if (m.a === 'crash') crashAt(m.kind, m.cx, m.cz, V(...m.p));
      else if (m.a === 'carhit') { const e = enemyBy(m.who); if (e && e.stun <= 0) carHitEnemy(e); }
      else if (m.a === 'trapfree') { const t = G.traps.find(t => t.id === m.id); if (t) t.gone = true; }
    }
    return;
  }
  switch (m.t) {
    case 'lobby': renderLobby(m); break;
    case 'start': clientStart(m); break;
    case 's': applySnapshot(m); break;
    case 'o+': for (const a of m.o) objFromNet(a); break;
    case 'fx': if (G.mode !== 'menu') sfx[m.n] && sfx[m.n](...m.a.map(x => x && x.v ? V(...x.v) : x)); break;
    case 'pfx': sfx[m.n] && sfx[m.n](); break;
    case 'say': say(m.who, m.kind, m.p ? V(...m.p) : null, m.idx); break;
    case 'toast': toast(m.text, m.dur); break;
    case 'shards': spawnShards({ id: m.id, pos: V(...m.p) }); break;
    case 'inv': {
      P.weapons = m.w; if (!P.weap || !P.weapons[P.weap]) P.weap = m.weap; P.stones = m.st; P.flareAmmo = m.fl;
      const o = m.held >= 0 ? G.byNid.get(m.held) : null;
      if (o) { o.heldBy = P.id; o.mesh.visible = false; }
      setHeldView(o); break;
    }
    case 'unhide': if (P.hidden) { P.hideAnim = null; const h = P.hidden; P.hidden = null; P.pos.set(cc(h.x + h.face[0]), FLOOR_Y[h.f], cc(h.z + h.face[1])); document.body.classList.remove('hiding'); toast('Тут уже кто-то прячется'); } break;
    case 'down': { const pl = PL.get(m.pid); if (pl) pl.downed = true; if (m.pid === P.id && P.hidden) { const h = P.hidden; P.hidden = null; P.hideAnim = null; P.pos.set(cc(h.x + h.face[0]), FLOOR_Y[h.f], cc(h.z + h.face[1])); document.body.classList.remove('hiding'); } onDowned(m.pid, m.name); break; }
    case 'up': { const pl = PL.get(m.pid); if (pl) pl.downed = false; onRevived(m.pid, m.name, m.by); break; }
    case 'safe': sfx.beep(m.ok); break;
    case 'symres': sfx.beep(m.ok); if (!m.ok) toast('Замок не открылся — картинки не те', 2); break;
    case 'caught': if (G.mode === 'play' || G.mode === 'daybreak') { G.splits = m.splits; beginCaught(enemyBy(m.who), m.pid, m.name, m.pulled, m.all); } break;
    case 'dead': onDead(m.pid, m.name); break;
    case 'sacked': onSacked(m.pid, m.name); break;
    case 'sackdrop': { const pl = PL.get(m.pid); if (pl) pl.sackSlot = m.slot; if (m.pid === P.id) { P.sackSlot = m.slot; toast(m.slot < 0 ? 'Дворник услышал тебя и тащит мешок на другое место!' : 'Тебя бросили в сарае среди мешков. Шурши, чтобы друзья нашли', 4); } break; }
    case 'unsack': onUnsacked(m.pid, m.name, m.p); break;
    case 'boom': spawnBoom(V(...m.p)); shakeFrom(V(...m.p)); break;
    case 'aura': startAura(); break;
    case 'housegone': if (!G.houseGone) { houseBoomFx(V(...m.p)); setTimeout(destroyHouse, 1400); } break;
    case 'drive': startDriving(); break;
    case 'tele': P.f = m.f; P.pos.set(...m.p); P.hidden = null; P.hideAnim = null; document.body.classList.remove('hiding'); stopEmote(); P.hideT = 0; $('flash').style.opacity = 0.7; setTimeout(() => $('flash').style.opacity = 0, 150); break;
    case 'sub': subtitle(m.text, m.cls); break;
    case 'day': G.day = m.day; startDay(); break;
    case 'over': G.splits = m.splits; gameOver(); break;
    case 'win': G.splits = m.splits; G.time = m.tm; startEscape(m.type); break;
  }
});
Net.on('peers', () => { if (Net.role === 'host') { renderLobby(); Net.send({ t: 'lobby', players: lobbyList(), diff: diffKey, chap: netChap }, true); } });
Net.on('me', () => { if (Net.role === 'host') renderLobby(); });
Net.on('connected', () => { if (Net.role === 'client') { $('netStatus').textContent = 'Подключено! Ждём, когда хозяин начнёт игру…'; $('netFound').innerHTML = ''; } });
Net.on('disconnected', (id) => {
  if (Net.role === 'client' && id === Net.hostId) { Net.leave(); singlePlayers(); toMenu(); toast('Хозяин вышел из игры', 3); return; }
  if (Net.role === 'host' && CH2 && CH2.S.on) { CH2.dropPlayer(id); toast('Игрок вышел', 2.5); return; }
  if (Net.role === 'host') {
    const pl = PL.get(id);
    if (pl) { if (pl.held) dropFor(pl, false, null, null); unhideFor(pl); if (pl.avatar) scene.remove(pl.avatar); PL.delete(id); toast(pl.name + ' вышел', 2.5); }
  }
});
Net.on('found', () => renderFound());
Net.on('error', (msg) => { $('netStatus').textContent = msg; });
const lobbyList = () => [[Net.myId, Net.myName], ...Net.peers.entries()];

// ---------- лобби ----------
function netModeStatus() {
  if (Net.mode() === 'online') return 'Интернет: один создаёт игру, остальные нажимают «Найти игру». До 4 игроков.';
  if (Net.mode() === 'lan') return 'Рядом: все устройства — в одной Wi-Fi сети (или просто рядом друг с другом). Один создаёт игру, остальные присоединяются.';
  return 'Сетевая игра недоступна на этом устройстве.';
}
function syncNetModeButtons() {
  const mode = Net.mode();
  $('netMode').querySelectorAll('button').forEach(b => {
    const can = b.dataset.v === 'online' ? Net.canOnline() : Net.canLan();
    b.disabled = !can;
    b.classList.toggle('sel', can && b.dataset.v === mode);
    b.style.opacity = can ? '' : '.45';
  });
}
function openNet() {
  $('netName').value = SET.name || ('Игрок ' + (10 + Math.floor(Math.random() * 90)));
  syncNetModeButtons();
  $('netStatus').textContent = netModeStatus();
  $('nHost').disabled = $('nFind').disabled = !Net.available();
  $('netFound').innerHTML = ''; $('netLobby').innerHTML = ''; $('nGo').classList.add('hidden');
  openPanel('pNet');
}
function netName() { const n = ($('netName').value || 'Игрок').trim().slice(0, 14) || 'Игрок'; SET.name = n; saveSet(); return n; }
function renderLobby(m) {
  const list = m ? m.players : lobbyList();
  const diff = m ? m.diff : diffKey, chap = m ? (m.chap || 1) : netChap;
  $('netChapRow').classList.toggle('hidden', Net.role !== 'host');
  $('netChap').querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.v === chap));
  $('netLobby').innerHTML = '<div class="no">Игроки (' + list.length + ' из 4) · ' + (chap === 2 ? 'глава 2 «Квартира»' : 'глава 1 · сложность: ' + DIFFS[diff].name) + '</div>' + list.map(([id, name], i) => '<div><span style="color:#' + COLORS[i % 4].toString(16).padStart(6, '0') + '">●</span> ' + escapeHtml(name) + (i === 0 ? ' — хозяин' : '') + (id === Net.myId ? ' (ты)' : '') + '</div>').join('');
  if (Net.role === 'host') {
    $('nGo').classList.toggle('hidden', Net.peers.size < 1);
    $('netStatus').textContent = Net.peers.size
      ? 'Можно начинать. Сложность меняется в главном меню.'
      : (Net.mode() === 'online' ? 'Игра создана. Друзья увидят её в «Найти игру».' : 'Игра создана. Ждём друзей… Пусть они нажмут «Найти игру».');
  }
}
function renderFound() {
  const el = $('netFound'); el.innerHTML = '';
  if (Net.role !== 'client' || Net.peers.size) return;
  if (!Net.found.size) { el.innerHTML = '<div class="no">' + (Net.mode() === 'online' ? 'Ищем игры в интернете…' : 'Ищем игры рядом…') + '</div>'; return; }
  for (const [id, name] of Net.found) {
    const b = document.createElement('button'); b.className = 'pbtn'; b.style.margin = '4px 6px 0 0';
    b.textContent = 'Войти к ' + name;
    b.onclick = () => { Net.join(id); $('netStatus').textContent = 'Подключаюсь к ' + name + '…'; };
    el.appendChild(b);
  }
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('netMode').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  if (b.disabled) return;
  Net.setMode(b.dataset.v);
  syncNetModeButtons();
  $('netStatus').textContent = netModeStatus();
  $('netFound').innerHTML = ''; $('netLobby').innerHTML = ''; $('nGo').classList.add('hidden');
  sfx.click();
}));
$('nHost').addEventListener('click', () => {
  ensureAudio();
  Net.host(netName());
  renderLobby();
  $('netFound').innerHTML = '';
  $('netStatus').textContent = Net.mode() === 'online' ? 'Создаю игру на сервере…' : 'Создаю игру…';
});
$('nFind').addEventListener('click', () => {
  ensureAudio();
  Net.browse(netName());
  $('netLobby').innerHTML = '';
  $('netStatus').textContent = Net.mode() === 'online' ? 'Ищем игры в интернете…' : 'Ищем игры рядом…';
  renderFound();
});
$('nGo').addEventListener('click', () => { if (Net.role === 'host' && Net.peers.size) { if (netChap === 2) hostStart2(); else hostStart(); } });
$('netChap').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  const v = +b.dataset.v;
  if (v === 2 && !ch2Unlocked()) { toast('Глава 2 откроется, когда пройдёшь первую до конца', 3); return; }
  netChap = v; sfx.click(); renderLobby(); if (Net.role === 'host') Net.send({ t: 'lobby', players: lobbyList(), diff: diffKey, chap: netChap }, true);
}));
function hostStart2() {
  Net.lock(true);
  const list = [[Net.myId, Net.myName, 0], ...[...Net.peers.entries()].map(([id, name], i) => [id, name, i + 1])];
  Net.send({ t: 'start2', players: list }, true);
  startChapter2(false, list);
}
$('nBack').addEventListener('click', () => { Net.leave(); singlePlayers(); closePanel('pNet'); });

// ---------- ввод ----------
const keys = {};
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const look = { id: null, lx: 0, ly: 0 };
const touchEl = $('touch');
function lookDelta(dx, dy, s) {
  if (P.hideAnim || P.paused || P.ui) return;
  P.yaw -= dx * s * SET.sens; P.pitch -= dy * s * SET.sens * (SET.invert ? -1 : 1);
  P.pitch = Math.max(-1.4, Math.min(1.4, P.pitch));
}
const noTouchDefault = (el) => ['touchstart', 'touchmove', 'touchend'].forEach(ev => el.addEventListener(ev, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
noTouchDefault(touchEl); document.querySelectorAll('#hud .btn').forEach(noTouchDefault);
document.addEventListener('selectstart', (e) => { if (!(e.target && e.target.tagName === 'INPUT')) e.preventDefault(); });
touchEl.addEventListener('pointerdown', (e) => {
  ensureAudio();
  if ((G.mode !== 'play' && G.mode !== 'ch2') || P.paused) return;
  if (!isTouch && e.pointerType === 'mouse') { canvas.requestPointerLock && canvas.requestPointerLock(); return; }
  const left = e.clientX < window.innerWidth * 0.42 && !P.hidden;
  // палец мог «потеряться» (пункт управления, уведомления) — новое касание забирает джойстик/обзор себе
  if (left && joy.id !== null) endPtr({ pointerId: joy.id });
  if (!left && look.id !== null) look.id = null;
  if (left && joy.id === null) {
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0; joy.lx = e.clientX; joy.ly = e.clientY;
    const j = $('joy'); j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.classList.remove('hidden');
  } else if (look.id === null) { look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY; }
  touchEl.setPointerCapture && touchEl.setPointerCapture(e.pointerId);
});
touchEl.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    joy.lx = e.clientX; joy.ly = e.clientY;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const m = Math.hypot(dx, dy), max = 62;
    if (m > max) { dx = dx / m * max; dy = dy / m * max; }
    joy.x = dx / max; joy.y = dy / max;
    $('joy').firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (e.pointerId === look.id) { lookDelta(e.clientX - look.lx, e.clientY - look.ly, 0.0055); look.lx = e.clientX; look.ly = e.clientY; }
});
const endPtr = (e) => {
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joy').classList.add('hidden'); $('joy').firstElementChild.style.transform = ''; }
  if (e.pointerId === look.id) look.id = null;
};
touchEl.addEventListener('pointerup', endPtr); touchEl.addEventListener('pointercancel', endPtr); touchEl.addEventListener('lostpointercapture', endPtr);
// полный сброс управления: свернули игру, открыли пункт управления/уведомления, отпустили все пальцы
function resetInput() {
  if (joy.id !== null) endPtr({ pointerId: joy.id });
  joy.id = null; joy.x = joy.y = 0; look.id = null; actDown = false;
  for (const k in keys) keys[k] = false;
  const j = $('joy'); j.classList.add('hidden'); j.firstElementChild.style.transform = '';
}
window.__inputReset = resetInput;
window.addEventListener('blur', resetInput);
window.addEventListener('pagehide', resetInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
['touchend', 'touchcancel'].forEach(ev => document.addEventListener(ev, (e) => { if (!e.touches || e.touches.length === 0) resetInput(); }, { passive: true }));
// сторож касаний: в списке реальных пальцев должен быть палец рядом с джойстиком/обзором,
// иначе этот палец «потерялся» (системный жест, глюк сенсора) — отпускаем
function checkTouches(e) {
  if (!e.touches || (joy.id === null && look.id === null)) return;
  const near = (x, y, r) => { for (const t of e.touches) if (Math.hypot(t.clientX - x, t.clientY - y) < r) return true; return false; };
  if (joy.id !== null && !near(joy.lx, joy.ly, 110)) endPtr({ pointerId: joy.id });
  if (look.id !== null && !near(look.lx, look.ly, 260)) look.id = null;
}
['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(ev => document.addEventListener(ev, (e) => { if (ev === 'touchmove' && Math.random() > 0.25) return; checkTouches(e); }, { passive: true, capture: true }));
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas && (G.mode === 'play' || G.mode === 'ch2')) lookDelta(e.movementX, e.movementY, 0.0025); });
document.addEventListener('mousedown', (e) => { if (document.pointerLockElement === canvas && G.mode === 'ch2') { if (e.button === 0) CH2.act(); return; } if (document.pointerLockElement === canvas && G.mode === 'play') { if (e.button === 0) { if (P.weap && !P.held && !(focus && focus.kind === 'revive')) fire(); else { actDown = true; doAction(); } } if (e.button === 2) releaseHeld(true); } });
document.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (BT.on && !e.repeat) { const k = { ArrowLeft: 0, KeyD: 0, ArrowDown: 1, KeyF: 1, ArrowUp: 2, KeyJ: 2, ArrowRight: 3, KeyK: 3 }[e.code]; if (k !== undefined) { e.preventDefault(); clubPress(k); return; } }
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.code] = true; ensureAudio();
  if (G.mode === 'ch2') { if (e.code === 'KeyE' && !e.repeat) CH2.act(); if (e.code === 'KeyF') { P.light = !P.light; $('bLight').classList.toggle('on', P.light); } if (e.code === 'KeyC') toggleCrouch(); if (e.code === 'Escape' || e.code === 'KeyP') pauseGame(); return; }
  if (G.mode === 'play' && !P.paused && !P.ui) {
    if (e.code === 'KeyE' && !e.repeat) { actDown = true; doAction(); }
    if (e.code === 'KeyC' || e.code === 'ControlLeft') toggleCrouch();
    if (e.code === 'KeyQ') releaseHeld(true);
    if (e.code === 'KeyG') releaseHeld(false);
    if (e.code === 'KeyF') toggleLight();
    if (e.code === 'KeyR') fire();
    if (e.code === 'Digit1') startEmote(1);
    if (e.code === 'Digit2') startEmote(2);
    if (e.code === 'Digit3') startEmote(3);
    if (e.code === 'Space' && AB.on) auraTap();
    if (e.code === 'Tab') { e.preventDefault(); switchWeap(); }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (VL.open) closeVoiceLock(); else if (P.ui) closeKeypad(); else if (isPaused()) resumeGame(); else if (G.mode === 'play' || G.mode === 'daybreak') pauseGame(); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyE') actDown = false; });
document.addEventListener('mouseup', (e) => { if (e.button === 0) actDown = false; });
function btn(id, fn) { const b = $(id); b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); ensureAudio(); fn(); }); }
btn('bAct', () => { actDown = true; doAction(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('bAct').addEventListener(ev, () => { actDown = false; }));
btn('bThrow', () => releaseHeld(true));
btn('bDrop', () => releaseHeld(false));
btn('bCrouch', () => { if (G.mode === 'play' || G.mode === 'ch2') toggleCrouch(); });
btn('bLight', () => { if (G.mode === 'ch2') { P.light = !P.light; $('bLight').classList.toggle('on', P.light); sfx.click(); return; } if (G.mode === 'play') toggleLight(); });
btn('bFire', fire);
btn('bSwitch', switchWeap);
btn('bPause', () => { if (G.mode === 'play' || G.mode === 'daybreak' || G.mode === 'ch2') pauseGame(); });
function switchWeap() { if (P.weapons.slingshot && P.weapons.flaregun) { P.weap = P.weap === 'slingshot' ? 'flaregun' : 'slingshot'; sfx.click(); updateWeapView(); } }
function toggleCrouch() { if (P.hidden || P.downed) return; P.crouch = !P.crouch; $('bCrouch').classList.toggle('on', P.crouch); }
function toggleLight() { if (P.battery <= 1 && !P.light) { toast('Батарейка фонаря села — подожди, она чуть подзарядится'); return; } P.light = !P.light; $('bLight').classList.toggle('on', P.light); sfx.click(); }
const isPaused = () => G.mode === 'paused' || P.paused;
function pauseGame() {
  if (G.mode === 'ch2') { G.prevMode = 'ch2'; G.mode = 'paused'; $('hints').innerHTML = '<div><b>Глава 2 · Квартира</b></div><div class="no" style="margin-top:6px">' + (CH2.objectiveText() || 'Осмотрись') + '</div>'; $('pause').classList.remove('hidden'); document.exitPointerLock && document.exitPointerLock(); return; }
  if (MP()) P.paused = true; else { G.prevMode = G.mode; G.mode = 'paused'; }
  closeKeypad();
  const e = G.esc;
  let html = MP() ? '<div class="no" style="margin-bottom:6px">Сетевая игра идёт дальше — враги не ждут!</div>' : '';
  html += '<div><b>Ворота</b>: ' + partsFor('gate').map(p => '<span class="' + (e.gate[p] ? 'ok' : 'no') + '">' + (e.gate[p] ? '✓ ' : '· ') + ITEMS[p].name + '</span>').join(', ') + '</div>';
  const notes = [];
  notes.push(G.doors.get('1,15,10').locked ? 'Подвал заперт (ржавый ключ)' : 'Подвал открыт');
  notes.push(G.doors.get('2,9,3').locked ? 'Балкон заколочен (отвёртка)' : 'Балкон открыт');
  notes.push(G.doors.get('1,24,8').locked ? 'Сарай заперт замком с картинками. Три таблички с подсказками стоят во дворе' + (P.symKnown && Object.keys(P.symKnown).length ? ': ' + Object.entries(P.symKnown).map(([i, k]) => (+i + 1) + ' — ' + SYM_NAMES[k]).join(', ') : '') : 'Сарай открыт');
  notes.push(furn.hatch.open ? 'Лестница на чердак опущена' : 'Люк на чердак на 2 этаже (нужен багор)');
  notes.push(furn.safe.open ? 'Сейф на чердаке открыт' : 'Ключ от ворот — в сейфе на чердаке. Код: ' + ((P.known[0] || '··').slice(0, 2) + (P.known[1] || '··').slice(2)));
  if (!furn.secret.open) notes.push('В подвале стеллаж с голосовым замком' + (P.known.word ? ': скажи «' + P.known.word + '»' : ' — пароль записан где-то в доме'));
  html += '<div class="no" style="margin-top:6px">' + notes.join('<br>') + '</div>';
  if (MP()) html += '<div class="no" style="margin-top:6px">Игроки: ' + players().map(p => escapeHtml(p.name) + (p.downed ? ' (лежит)' : ' ' + '❤'.repeat(p.lives))).join(', ') + '</div>';
  $('hints').innerHTML = html;
  $('pause').classList.remove('hidden');
  document.exitPointerLock && document.exitPointerLock();
  if (!MP()) stopVoices();
}
function resumeGame() { if (MP()) P.paused = false; else G.mode = G.prevMode || 'play'; if (G.mode === 'ch2') { $('pause').classList.add('hidden'); return; } $('pause').classList.add('hidden'); }

// ---------- меню ----------
function refreshMenu() { $('mDiffName').textContent = DIFFS[diffKey].name; }
function openPanel(id) { $(id).classList.remove('hidden'); sfx.click(); }
function closePanel(id) { $(id).classList.add('hidden'); sfx.click(); }
$('mPlay').addEventListener('click', () => { ensureAudio(); fillChapters(); openPanel('pChapters'); });
$('chap1').addEventListener('click', () => { closePanel('pChapters'); Net.leave(); singlePlayers(); newGame(diffKey); });
$('chap2').addEventListener('click', () => { if (!ch2Unlocked()) { sfx.locked && sfx.locked(); toast('Глава 2 откроется, когда пройдёшь первую до конца — на фургоне', 3.5); return; } closePanel('pChapters'); startChapter2(false); });
$('chapClose').addEventListener('click', () => closePanel('pChapters'));
$('ch2skip').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); CH2.skip(); });
// ---------- главы ----------
function ch2Unlocked() {
  try { if (localStorage.getItem('hushwood.ch2') === '1') return true; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('hushwood.best.') && parseFloat(localStorage.getItem(k)) > 0) return true; } } catch (e) { }
  return false;
}
function fillChapters() {
  const u = ch2Unlocked(); $('chap2').classList.toggle('locked', !u); $('chap2st').textContent = u ? 'Ночь, ливень, девятиэтажка' : '🔒 Пройди главу 1 до конца';
}
function startChapter2(skipCut, list) {
  $('pNet').classList.add('hidden');
  if (!list) { Net.leave(); singlePlayers(); } else setupPlayers(list);
  const ps = list ? list.map(([id, name, idx]) => ({ id, name, idx, color: COLORS[idx % 4] })) : null;
  stopTracks(); setMusic('off'); stopVoices(); DR.active = false;
  ['menu', 'result', 'pause', 'pChapters'].forEach(i => $(i).classList.add('hidden'));
  $('hud').classList.remove('hidden'); $('red').style.opacity = 0; $('vign').style.opacity = 0; $('flash').style.opacity = 0;
  G.mode = 'ch2'; P.paused = false; P.ui = false; P.dead = false; P.hidden = null; document.body.classList.remove('ghost', 'hiding', 'driving', 'piloting', 'club');
  showFade('ГЛАВА 2', 'загрузка…');
  setTimeout(() => { CH2.start(skipCut, ps); }, 60);   // дать экрану показать «загрузку», пока строится уровень
}
$('mNet').addEventListener('click', () => { ensureAudio(); openNet(); });
$('mDiff').addEventListener('click', () => { ensureAudio(); diffKey = DIFF_ORDER[(DIFF_ORDER.indexOf(diffKey) + 1) % 4]; try { localStorage.setItem('hushwood.diff', diffKey); } catch (e) { } refreshMenu(); sfx.click(); if (Net.role === 'host') Net.send({ t: 'lobby', players: lobbyList(), diff: diffKey, chap: netChap }, true); });
$('mSet').addEventListener('click', () => { ensureAudio(); fillSettings(); openPanel('pSettings'); });
$('mRec').addEventListener('click', () => { ensureAudio(); fillRecords(); openPanel('pRec'); });
const PRACT = { noHostess: true, noWatchman: true, noDoll: true, noThing: true, noYard: true, noDrone: true, noAdam: true, noKoch: true, glow: true, endless: true };
try { Object.assign(PRACT, JSON.parse(localStorage.getItem('hushwood.practice') || '{}')); } catch (e) { }
function fillPractice() {
  $('prDiff').textContent = DIFFS[diffKey].name;
  const seg = (id, key, invert) => { const el = $(id); el.querySelectorAll('button').forEach(b => { const on = invert ? !PRACT[key] : PRACT[key]; b.classList.toggle('sel', (b.dataset.v === '1') === on); b.onclick = () => { PRACT[key] = invert ? b.dataset.v !== '1' : b.dataset.v === '1'; try { localStorage.setItem('hushwood.practice', JSON.stringify(PRACT)); } catch (e) { } fillPractice(); sfx.click(); }; }); };
  seg('prHost', 'noHostess', true); seg('prWatch', 'noWatchman', true); seg('prDoll', 'noDoll', true); seg('prThing', 'noThing', true); seg('prYard', 'noYard', true); seg('prDrone', 'noDrone', true); seg('prAdam', 'noAdam', true); seg('prKoch', 'noKoch', true);
  seg('prGlow', 'glow'); seg('prDays', 'endless');
}
$('mPract').addEventListener('click', () => { ensureAudio(); fillPractice(); openPanel('pPractice'); });
$('prGo').addEventListener('click', () => { Net.leave(); singlePlayers(); $('pPractice').classList.add('hidden'); newGame(diffKey, Object.assign({}, PRACT)); });
$('prBack').addEventListener('click', () => closePanel('pPractice'));
$('mHelp').addEventListener('click', () => { ensureAudio(); openPanel('pHelp'); });
$('sClose').addEventListener('click', () => { closePanel('pSettings'); if (isPaused()) $('pause').classList.remove('hidden'); });
$('rClose').addEventListener('click', () => closePanel('pRec'));
$('hClose').addEventListener('click', () => closePanel('pHelp'));
$('bResume').addEventListener('click', resumeGame);
$('bPSet').addEventListener('click', () => { fillSettings(); $('pause').classList.add('hidden'); openPanel('pSettings'); });
$('bRestart').addEventListener('click', () => { if (CH2 && CH2.S.on) { if (MP()) return; $('pause').classList.add('hidden'); startChapter2(true); return; } if (!MP()) newGame(diffKey, G.practice); });
$('bMenu').addEventListener('click', () => { Net.leave(); singlePlayers(); toMenu(); });
$('bAgain').addEventListener('click', () => { if (Net.role === 'host') { Net.lock(false); $('result').classList.add('hidden'); openNet(); renderLobby(); } else { singlePlayers(); newGame(diffKey, G.practice); } });
$('bMenu2').addEventListener('click', () => { Net.leave(); singlePlayers(); toMenu(); });
function toMenu() { stopEnding(); if (CH2 && CH2.S.on) CH2.stop(); setTimeout(menuBg, 50); closeVoiceLock(); stopTracks(); DR.active = false; if (DR.mesh) DR.mesh.visible = false; G.mode = 'menu'; P.paused = false; P.ui = false; ['pause', 'result', 'hud', 'pSafe', 'downMsg'].forEach(i => $(i).classList.add('hidden')); $('menu').classList.remove('hidden'); refreshMenu(); setMusic('menu'); stopVoices(); placeMenuScene(); }
function fillRecords() {
  let html = '';
  for (const k of DIFF_ORDER) for (const coop of ['', '.coop']) {
    let v = null, info = null;
    try { v = parseFloat(localStorage.getItem('hushwood.best.' + k + coop)); info = JSON.parse(localStorage.getItem('hushwood.bestinfo.' + k + coop) || 'null'); } catch (e) { }
    if (coop && !(v > 0)) continue;
    html += '<div>' + DIFFS[k].name + (coop ? ' (вместе)' : '') + ': ' + (v > 0 ? fmt(v) + (info ? ' · ' + info.esc + ' · ' + info.date : '') : '—') + '</div>';
  }
  $('recList').innerHTML = html;
}
function fillSettings() {
  const sl = (id, key, fmtv) => { const el = $(id); el.value = SET[key]; const v = $('v' + id.slice(1)); v.textContent = fmtv(SET[key]); el.oninput = () => { SET[key] = parseFloat(el.value); v.textContent = fmtv(SET[key]); saveSet(); }; };
  sl('sSens', 'sens', v => (+v).toFixed(2)); sl('sMusic', 'music', v => Math.round(v * 100) + '%'); sl('sSfx', 'sfx', v => Math.round(v * 100) + '%');
  const seg = (id, get, setv) => { const el = $(id); el.querySelectorAll('button').forEach(b => { b.classList.toggle('sel', b.dataset.v === get()); b.onclick = () => { setv(b.dataset.v); saveSet(); fillSettings(); sfx.click(); }; }); };
  seg('sVoice', () => SET.voice ? '1' : '0', v => { SET.voice = v === '1'; if (!SET.voice) stopVoices(); });
  seg('sQual', () => SET.quality, v => { SET.quality = v; applyPixelRatio(); $('qualNote').textContent = 'Чёткость изменена сразу. Текстуры и количество ламп — после перезапуска приложения.'; });
  seg('sInv', () => SET.invert ? '1' : '0', v => SET.invert = v === '1');
  seg('sFps', () => SET.fps ? '1' : '0', v => { SET.fps = v === '1'; $('fps').classList.toggle('hidden', !SET.fps); });
}
$('fps').classList.toggle('hidden', !SET.fps);
document.querySelectorAll('.pcard').forEach(p => p.addEventListener('pointerdown', e => e.stopPropagation()));

let mt = 0;
function placeMenuScene() {
  G.practice = null;
  if (hostess) [hostess, watchman, thing, yard].forEach(e => e.mesh.visible = true);
  if (doll) doll.mesh.visible = true;
  if (!maps) maps = buildMaps();
  if (!D) D = DIFFS[diffKey];
  ensureEnemies();
  hostess.place(1, 9, 5); hostess.pos.x += 0.6; hostess.pos.z -= 0.4; hostess.yaw = -0.45; hostess.state = 'menu'; hostess.stun = 0; hostess.moving = false; hostess.sync();
  watchman.place(...CHAIR); watchman.state = 'sleep'; watchman.stun = 0; watchman.yaw = Math.PI; watchman.pos.z += 0.15; watchman.sync();
  thing.place(0, 11, 4); yard.place(1, 22, 12); yard.state = 'patrol'; yard.sync(); doll.x = cc(12); doll.dir = -1; doll.stun = 0; doll.mesh.position.set(doll.x, DOLL_Y, DOLL_Z); doll.mesh.rotation.y = -Math.PI / 2;
  hemi.intensity = 0.9; moon.intensity = 0.5; scene.fog.color.setHex(0x05060a); scene.background.setHex(0x05060a);
  applyLamps([]);
}
function menuTick(dt) {
  mt += dt;
  const h = hostess, U = h.mesh.userData;
  h.moving = false; animHostess();
  U.head.rotation.y = Math.sin(mt * 0.4) * 0.3; U.head.rotation.z = Math.sin(mt * 0.6) * 0.15;
  U.jaw.rotation.x = Math.max(0, Math.sin(mt * 0.9)) * 0.3;
  U.arms[0].a.rotation.x = -0.25 + Math.sin(mt * 0.8) * 0.05;
  animWatchman();
  camera.position.set(17.4 + Math.sin(mt * 0.3) * 0.06, 1.5 + Math.sin(mt * 0.9) * 0.02, 13.9);
  camera.lookAt(19.3, 1.2, 10.6);
  P.yaw = camera.rotation.y; P.pitch = camera.rotation.x; P.f = 1;
  scene.fog.density = 0.06;
  updateLights(dt);
  setListener(camera.position.x, camera.position.y, camera.position.z, camera.rotation.y);
  furn.pendulums.forEach(p => p.rotation.z = Math.sin(mt * 3.1) * 0.25);
  G.menuBell = (G.menuBell || 4) - dt; if (G.menuBell <= 0) { sfx.bell(V(cc(9), 1.4, cc(5))); G.menuBell = rand(5, 9); }
}

// ---------- HUD ----------
let toastTimer = 0;
function toast(t, dur = 2.2) { const el = $('toast'); el.textContent = t; el.classList.add('on'); toastTimer = dur; }
function showFade(t, sub) { $('fadeText').textContent = t || ''; $('fadeSub').textContent = sub || ''; $('fade').classList.add('on'); }
function hideFade() { $('fade').classList.remove('on'); }
function updateHUD() {
  $('timer').textContent = fmt(G.time);
  const a = $('bAct');
  if (focus) { a.textContent = focus.label; a.classList.remove('idle'); } else { a.textContent = '—'; a.classList.add('idle'); }
  $('stam').style.visibility = D.stamina ? 'visible' : 'hidden';
  $('stam').firstElementChild.style.width = P.stamina + '%';
  $('stam').firstElementChild.style.background = P.tired ? '#9a1010' : '#9a8f7c';
  $('lives').textContent = MP() ? '❤'.repeat(Math.max(0, P.lives)) + '♡'.repeat(Math.max(0, 2 - P.lives)) : '';
  $('batt').style.visibility = D.battery ? 'visible' : 'hidden';
  $('batt').firstElementChild.style.width = P.battery + '%';
}

// ---------- поднять друга: держать кнопку ----------
let actDown = false;
const REVIVE_T = 3;
function updateRevive(dt) {
  const r = P.reviving, a = $('bAct');
  if (!r) { if (a.dataset.prog) { a.style.background = ''; delete a.dataset.prog; } return; }
  const t = PL.get(r.pid);
  if (!actDown || P.downed || P.hidden || !t || !t.downed || t.f !== P.f || Math.hypot(t.pos.x - P.pos.x, t.pos.z - P.pos.z) > 3) { P.reviving = null; return; }
  r.t += dt;
  const pct = Math.min(100, r.t / REVIVE_T * 100);
  a.style.background = `conic-gradient(rgba(70,170,70,.85) ${pct}%, rgba(16,12,10,.55) 0)`; a.dataset.prog = '1';
  if (r.t >= REVIVE_T) {
    P.reviving = null;
    const c = { kind: 'revive', pid: r.pid };
    if (Net.role === 'client') Net.send({ t: 'r', a: 'act', c }, true); else performAction(P, c);
  }
}

function stopTracks() { for (const n of ['dance', 'shahed']) if (G.trk[n]) { playTrack(n, false); G.trk[n] = false; } G.trackOn = false; }

// ---------- эмоции: танцы игрока ----------
const EMOTE_TRACK = { 1: 'dance', 2: 'dance', 3: 'shahed' };
function startEmote(k) {
  $('emoteMenu').classList.add('hidden');
  if (G.mode !== 'play' || P.hidden || P.downed || P.trapped || P.climb || P.ui || P.dead || P.sacked) return;
  P.emote = { k, t: 0 }; P.crouch = false; $('bCrouch').classList.remove('on');
  if (!P.selfAv) { P.selfAv = makeKid(T, P.color, P.name && P.name !== 'Я' ? P.name : 'Ты'); scene.add(P.selfAv); P.selfAv.userData.tag.visible = false; P.selfAv.userData.help.visible = false; P.selfAv.userData.beam.visible = false; }
  P.selfAv.visible = true;
  toast(['', 'Танец бабки!', 'Танец деда!', 'Самолётик!'][k] + ' Музыку слышат все… и Хозяйка тоже', 2.5);
  P.camYaw = P.yaw;
}
function stopEmote() { P.emote = null; if (P.selfAv) P.selfAv.visible = false; }
// камера со стороны, пока танцуешь
function updateSelfEmote(dt) {
  if (!P.emote || G.mode !== 'play') { if (P.selfAv) P.selfAv.visible = false; if (P.emote && G.mode !== 'play') P.emote = null; return; }
  const av = P.selfAv, U = av.userData, t = P.emote.t;
  av.visible = true; av.position.set(P.pos.x, P.pos.y, P.pos.z);
  av.rotation.y = P.yaw + Math.PI + danceSpin(t, P.emote.k);
  danceRig(U, t, P.emote.k, 0.82);
  const head = V(P.pos.x, P.pos.y + 1.1, P.pos.z);
  let ang = P.yaw + Math.sin(t * 0.35) * 0.9, dist = 2.8;
  const want = V(head.x - Math.sin(ang) * dist, head.y + 0.55, head.z - Math.cos(ang) * dist);
  // не залезать камерой в стену
  for (let k = 1; k <= 12; k++) { const q = head.clone().lerp(want, k / 12); const [cx, cz] = cellOf(q); if (solidSight(P.f, cx, cz)) { want.copy(head.clone().lerp(want, Math.max(0, (k - 1.5) / 12))); break; } }
  camera.position.copy(want); camera.lookAt(head);
}
let emoteNoiseT = 0;
function emoteNoise(dt) {
  emoteNoiseT -= dt; if (emoteNoiseT > 0) return; emoteNoiseT = 1;
  for (const pl of players()) if (pl.emote && !pl.downed) noise(pl.f, pl.pos.clone(), 11, pl);
}
btn('bCarOut', () => { if (P.driving) leaveCar(); });
btn('bRadio', () => { if (P.driving && !CAR.dead) toggleRadio(); });
btn('bBoom', pilotBoom);
btn('bMap', openMap);
document.querySelectorAll('#clubBtns button').forEach((b, i) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); clubPress(+b.dataset.l); }));
const closeMap = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } $('pMap').classList.add('hidden'); };
['mapClose', 'mapX', 'pMap'].forEach(id => $(id).addEventListener('pointerdown', closeMap));
$('bkLaunch').addEventListener('click', launchPilot);
$('bkExit').addEventListener('click', leaveBunker);
btn('abTap', auraTap);
$('tomCanvas').addEventListener('pointerdown', (e) => { e.preventDefault(); tomTap(e); });
$('tomClose').addEventListener('click', () => endTom(true));
$('bEmote').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (P.emote) { stopEmote(); return; } $('emoteMenu').classList.toggle('hidden'); sfx.click(); });
document.querySelectorAll('#emoteMenu button').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); ensureAudio(); startEmote(+b.dataset.e); }));

// ---------- игрок: движение ----------
function updatePlayer(dt) {
  if (P.climb) { updateClimb(dt); P.idle = 0; P.moving = 0; return; }
  if (P.sacked) { P.idle = 0; P.moving = 0; return; }
  if (P.hidden) {
    if (!P.hideAnim) {
      const h = P.hidden;
      camera.position.copy(hideCam(h));
      const base = Math.atan2(-h.face[0], -h.face[1]);
      let d = P.yaw - base; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      P.yaw = base + Math.max(-0.6, Math.min(0.6, d)); P.pitch = Math.max(-0.35, Math.min(0.35, P.pitch));
      P.pos.set(h.pos.x, h.pos.y, h.pos.z); P.f = h.f;
    }
    P.idle = 0; P.moving = 0; return;
  }
  const frozen = P.paused || P.ui;
  let mx = frozen ? 0 : joy.x, mz = frozen ? 0 : joy.y;
  if (!frozen) {
    if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  }
  if (P.dead) { ghostMove(dt, mx, mz); return; }
  if (P.driving) { driveCar(dt, mx, mz); P.moving = 0; P.idle = 0; return; }
  if (P.inBunker) { P.pos.set(BUNKER.x, 0, BUNKER.z + 2.2); P.f = 1; P.moving = 0; P.idle = 0; return; }
  if (P.emote) { if (Math.hypot(mx, mz) > 0.25) stopEmote(); else { P.emote.t += dt; if (P.emote.t > trackLen(EMOTE_TRACK[P.emote.k])) stopEmote(); mx = mz = 0; } }
  if (P.trapped) { mx = mz = 0; }
  const m = Math.min(1, Math.hypot(mx, mz));
  const wantSprint = (keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > 0.95) && m > 0.5 && !P.crouch && !P.downed;
  P.sprint = wantSprint && !P.tired;
  if (D.stamina) {
    if (P.sprint) { P.stamina -= dt * 20; if (P.stamina <= 0) { P.stamina = 0; P.tired = true; } }
    else { P.stamina = Math.min(100, P.stamina + dt * (P.moving ? 9 : 16)); if (P.tired && P.stamina > 35) P.tired = false; }
  }
  // поваленный игрок может только медленно ползти
  const speed = P.downed ? 0.6 : P.crouch ? 1.6 : P.sprint ? 5.0 : 3.0;
  let vx = 0, vz = 0;
  if (m > 0.05) {
    const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
    const fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    vx = (fx2 * -mz + rx * mx) * speed * m; vz = (fz2 * -mz + rz * mx) * speed * m;
  }
  const r = 0.28;
  const blocked = (x, z) => {
    for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const zn = zoneAt(x + ox, z + oz);
      if (zn) { if (zoneSolid(zn, x + ox, z + oz)) return true; continue; }
      if (solidCell(P.f, Math.floor((x + ox) / CS), Math.floor((z + oz) / CS))) return true;
    }
    if (zoneAt(x, z)) return false;
    return hitCollider(P.f, x, z, r, P.pos.y);
  };
  // если игрок оказался внутри препятствия (люк, мебель, вылез из шкафа) — мягко выталкиваем на свободное место
  if (blocked(P.pos.x, P.pos.z)) {
    let done = false;
    for (let rr = 0.1; rr <= 2.0 && !done; rr += 0.1) for (let a = 0; a < 16 && !done; a++) {
      const nx = P.pos.x + Math.cos(a / 16 * Math.PI * 2) * rr, nz = P.pos.z + Math.sin(a / 16 * Math.PI * 2) * rr;
      if (!blocked(nx, nz)) { P.pos.x = nx; P.pos.z = nz; done = true; }
    }
  }
  const ox = P.pos.x, oz = P.pos.z;
  if (!blocked(P.pos.x + vx * dt, P.pos.z)) P.pos.x += vx * dt;
  if (!blocked(P.pos.x, P.pos.z + vz * dt)) P.pos.z += vz * dt;
  const moved = Math.hypot(P.pos.x - ox, P.pos.z - oz);
  P.moving = moved / Math.max(dt, 1e-4);
  const hy = heightAt(P.f, P.pos.x, P.pos.z);
  P.f = floorFromY(P.f, P.pos.x, P.pos.z, hy);
  P.pos.y = heightAt(P.f, P.pos.x, P.pos.z);
  // на чердаке под скатом нужно пригибаться
  let eyeT = P.crouch ? 0.85 : 1.6;
  if (P.f === 3) { const room = 6 + 3.5 * Math.max(0, 1 - Math.abs(P.pos.z - 18) / 12.6) - 6; eyeT = Math.min(eyeT, room - 0.25); }
  P.eye += (eyeT - P.eye) * Math.min(1, dt * 10);
  P.stepAcc += moved;
  const stride = P.sprint ? 2.0 : P.crouch ? 1.2 : 1.7;
  if (P.stepAcc > stride && !P.downed) {
    P.stepAcc = 0;
    sfx.step(P.crouch, P.sprint, P.f === 0);
    myNoise(P.f, P.pos.clone(), P.crouch ? 0 : P.sprint ? 10 : 3.6);
  }
  const [cx, cz] = cellOf(P.pos), ck = P.f + ',' + cx + ',' + cz;
  if (ck !== P.lastCell) {
    P.lastCell = ck;
    if (cell(P.f, cx, cz) === 'c' && !P.downed) { sfx.creak(P.pos); myNoise(P.f, P.pos.clone(), P.crouch ? 2.5 : P.sprint ? 9 : 6.5); }
  }
  if (P.f === 0 && moved < 0.002) P.idle += dt; else P.idle = 0;
  if (false) {
    G.gateSent = true;
    if (Net.role === 'client') Net.send({ t: 'r', a: 'gate' }, true); else winAll('gate');
  }
}

// ---------- главный цикл ----------
let last = performance.now(), fpsN = 0, fpsT = 0, bootOkT = 4;
function frame(t) {
  requestAnimationFrame(frame);
  let dt = Math.max(0, Math.min(0.05, (t - last) / 1000)); last = t;
  if (bootOkT > 0) { bootOkT -= dt; if (bootOkT <= 0) try { localStorage.setItem('hushwood.boot', 'ok'); } catch (e) { } }
  if (SET.fps) { fpsN++; fpsT += dt; if (fpsT > 0.5) { $('fps').textContent = Math.round(fpsN / fpsT) + ' FPS · ' + renderer.info.render.calls + ' dc'; fpsN = 0; fpsT = 0; } }
  if (CH2 && CH2.S.menu && !CH2.S.on) {   // фон главного меню, когда открыта вторая глава
    if (G.mode === 'menu') { if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('on'); } try { CH2.frame(dt); } catch (e) { CH2.menu(false); } return; }
    CH2.menu(false);
  }
  if (CH2 && CH2.S.on) {   // вторая глава: своя сцена, свой кадр
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('on'); }
    try { CH2.frame(dt, G.mode === 'paused'); } catch (e) { if (!G.errShown) { G.errShown = true; window.__showError && window.__showError('Глава 2: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')); } }
    return;
  }
  try { tick(dt); if (RTX && !G.noBloom) RTX.composer.render(dt); else renderer.render(scene, camera); }
  catch (e) { if (!G.errShown) { G.errShown = true; window.__showError && window.__showError('Ошибка в игре: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')); } }
}
function tick(dt) {
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('on'); }
  updateTom(dt); updateAura(dt);
  if (G.mode === 'menu') { menuTick(dt); return; }
  const playing = G.mode === 'play' || G.mode === 'caught' || G.mode === 'daybreak' || G.mode === 'escape';
  if (!playing) return;
  const host = isHost();
  if (host) G.time += dt;
  if (G.mode === 'daybreak') { G.dt0 += dt; if (G.dt0 > 1.8) { hideFade(); G.mode = 'play'; G.gateSent = false; } }
  if (G.mode === 'play') {
    updatePlayer(dt); updateHide(dt);
    if (host) { const off = G.practice || {}; if (!off.noHostess && !off.noWatchman) updateDance(dt); if (!off.noHostess) updateHostess(dt); if (!off.noWatchman) updateWatchman(dt); if (!off.noDoll) updateDoll(dt); if (!off.noThing) updateThing(dt); if (!off.noYard) updateYard(dt); if (!off.noDrone) updateDrone(dt); if (!off.noAdam) updateAdam(dt); updateGateLasers(dt); if (!off.noKoch) updateKoch(dt); if (MP() && G.mode === 'play' && !standing().length) endDayAll(null); }
    else clientEnemies(dt);
    updateTraps(dt); updateRunHide(dt);
    focus = pickFocus();
    updateRevive(dt);
    updateVoice(dt); updateVoiceLock(dt);
  } else if (G.mode === 'caught') { updateCaught(dt); focus = null; }
  else if (G.mode === 'escape') { updateEscape(dt); focus = null; }
  if (G.mode !== 'play') updateTraps(dt);
  if (host && G.mode === 'play') emoteNoise(dt);
  else { hostess.sync(); watchman.sync(); animWatchman(); }
  if (host) physics(dt); else clientObjects(dt);
  for (const pl of players()) if (!pl.local) animKid(pl, dt);
  animDrone(dt); updateSacks();
  if (MP()) netTick(dt);
  for (const d of G.doors.values()) { const tgt = d.open ? 1 : 0; d.t += (tgt - d.t) * Math.min(1, dt * 7); d.piv.rotation.y = d.piv.userData.base + d.t * (Math.PI / 2) * 0.92; }
  if (G.esc.gateOpen) gateM.userData.leaf.rotation.y = Math.min(1.6, gateM.userData.leaf.rotation.y + dt * 1.5);
  const sec = furn.secret;
  if (sec.moving) {
    sec.t = Math.min(1, sec.t + dt / 3); sec.shelf.position.z = sec.t * 1.9;
    if (sec.gearMesh) sec.gearMesh.rotation.x += dt * 4;
    if (sec.t >= 1) { sec.moving = false; sec.open = true; maps[0][4][14] = '.'; if (P.f === 0) toast('Тайная комната открыта!', 3); sfx.whisper(sec.pos); }
  }
  const ch = furn.chest; if (ch.open && ch.lid.rotation.x > -1.9) ch.lid.rotation.x -= dt * 2.5;
  const sf = furn.safe; if (sf.open && sf.door.rotation.y > -1.8) sf.door.rotation.y -= dt * 2;
  const ht = furn.hatch; if (ht.open) { ht.t = Math.min(1, ht.t + dt * 1.5); ht.panel.rotation.z = -ht.t * 1.6; ht.ladder.visible = ht.t > 0.5; }
  furn.pendulums.forEach(p => p.rotation.z = Math.sin(now() * 3.1) * 0.25);
  furn.flames.forEach((f, i) => f.scale.y = 0.8 + Math.sin(now() * 17 + i) * 0.25);
  updateLights(dt);
  if (P.light) { if (D.battery) { P.battery -= dt * 1.4; if (P.battery <= 0) { P.battery = 0; P.light = false; $('bLight').classList.remove('on'); toast('Батарейка фонаря села'); } } }
  else if (D.battery) P.battery = Math.min(100, P.battery + dt * 0.8);
  flash.intensity = P.light ? (D.dark ? 70 : 55) * Math.min(1, 0.4 + P.battery / 100) : 0;
  if (G.mode !== 'caught' && !(P.hidden || P.hideAnim || P.climb)) {
    const bob = P.moving > 0.5 ? Math.sin(now() * (P.sprint ? 14 : 9)) * (P.crouch ? 0.02 : 0.04) : 0;
    camera.position.set(P.pos.x, P.pos.y + (P.downed ? 0.3 : document.body.classList.contains('underwater') ? 0.12 : P.eye) + bob, P.pos.z);
  }
  camera.rotation.y = P.yaw; camera.rotation.x = P.pitch; camera.rotation.z = P.downed ? 0.18 + Math.sin(now() * 2.2) * (P.moving > 0.2 ? 0.05 : 0) : 0;
  if (P.trapped) { camera.position.y -= 0.25; camera.rotation.z = Math.sin(now() * 30) * P.kick * 0.2; }
  updateSelfEmote(dt);
  if (P.driving) carCamera();
  updatePilot(dt); updatePilotMesh(dt); updateFires(dt);
  if (SUR) { const zc = zoneAt(camera.position.x, camera.position.z); SUR.update(dt, camera.position, !BT.on && zc !== 'club' && zc !== 'arena' && zc !== 'banya' && camera.position.y > -40); }
  if (BT.on) animClub(songTime());
  updateCarVisual(dt);
  updateFx(dt);
  P.kick = Math.max(0, P.kick - dt);
  if (weapView) { weapView.position.z = (P.weap === 'flaregun' ? -0.5 : -0.45) + P.kick * 0.4; weapView.rotation.x = 0.1 + P.kick * 1.2; }
  setListener(camera.position.x, camera.position.y, camera.position.z, P.yaw);
  scene.fog.density = (D.dark ? 1.35 : 1) * (P.f === 0 ? 0.085 : P.f === 3 ? 0.07 : indoor(P.f, ...cellOf(P.pos)) ? 0.05 : 0.04);
  // призраки видят в темноте: голубое ночное зрение
  if (BT.on) { scene.fog.density = 0.01; hemi.intensity = 1.8; hemi.color.setHex(0xb090ff); hemi.groundColor.setHex(0x402060); G.nv = true; }
  else if (PILOT.on) {   // камера шахеда: зелёный прибор ночного видения
    scene.fog.density *= 0.15; hemi.intensity = 4.5; hemi.color.setHex(0xe0ffe0); hemi.groundColor.setHex(0x80a080); renderer.toneMappingExposure = 2.8; G.nv = true;
  } else if (P.dead) {
    scene.fog.density *= 0.3; hemi.intensity = 2.6; hemi.color.setHex(0x9fd0ff); hemi.groundColor.setHex(0x4060a0); renderer.toneMappingExposure = 2.3; G.nv = true;
  } else if (G.nv) {
    G.nv = false; hemi.intensity = 0.9 * D.ambient; hemi.color.setHex(0x4a5070); hemi.groundColor.setHex(0x1c140e); renderer.toneMappingExposure = 1.7;
  }
  if (!G.nv) {   // на улице светлее от луны — видно двор, деревню, лес
    const zc0 = zoneAt(P.pos.x, P.pos.z);
    const outside = !BT.on && (zc0 === 'out' || (!zc0 && ((P.f === 1 && !indoor(1, ...cellOf(P.pos))) || (P.f === 2 && zoneOf(2, ...cellOf(P.pos)) === 'balcony'))));
    const kH = (outside ? 1.5 : 0.9) * D.ambient, kM = (outside ? 2.2 : 0.5) * D.ambient;
    hemi.intensity += (kH - hemi.intensity) * Math.min(1, dt * 2); moon.intensity += (kM - moon.intensity) * Math.min(1, dt * 2);
    if (outside) scene.fog.density = Math.min(scene.fog.density, 0.04) * 0.6;
  }
  updateHeat(dt); steamFx(dt); updateCorpses(dt);
  // страховка: ивент с дроном кончился, а ты всё ещё в коридоре — возвращаем домой
  if (G.mode === 'play' && zoneAt(P.pos.x, P.pos.z) === 'arena' && !(DR.active && DR.phase === 'chase')) { G.stuckT = (G.stuckT || 0) + dt; if (G.stuckT > 1.5) { G.stuckT = 0; const b = exitPos(); P.f = 1; P.pos.set(b.x, 0, b.z + 1); toast('Дрон улетел — ты снова в доме', 2.5); } } else G.stuckT = 0;
  if (T.water) T.water.offset.y -= 0.004;
  const chased = !P.dead && ((inBanya(P) && (KB.mode === 'chase' || KB.mode === 'dash')) || [hostess, watchman, yard].some(e => e.state === 'chase' && e.distP() < 14) || (thing.state === 'hunt' && P.f === 0) || (DR.active && DR.phase === 'chase'));
  const dancing = hostess.state === 'dance' || watchman.state === 'dance';
  $('vign').style.opacity = chased && G.mode === 'play' ? 1 : 0;
  const heard = !chased && hostess.state === 'investigate' && hostess.distP() < 18;
  $('eye').textContent = chased ? 'ТЕБЯ ЗАМЕТИЛИ' : 'ОНА УСЛЫШАЛА ШУМ';
  $('eye').classList.toggle('on', (chased || heard) && G.mode === 'play');
  $('eye').classList.toggle('soft', heard);
  if (G.mode === 'play') setMusic(chased ? 'chase' : (dancing || G.trackOn) ? 'dance' : 'ambient');
  // музыка из файлов: «dance» — танцы стариков и игроков, «shahed» — дрон и «самолётик». Слышат все, ближе — громче
  const live = G.mode === 'play' || G.mode === 'daybreak';
  const srcs = { dance: [], shahed: [] };
  if (dancing) srcs.dance.push({ p: V((hostess.pos.x + watchman.pos.x) / 2, hostess.pos.y + 1, (hostess.pos.z + watchman.pos.z) / 2), t: G.danceTime });
  if (DR.active && DR.phase === 'chase') srcs.shahed.push({ p: DR.pos.clone(), t: DR.t, loud: true, loop: true });
  if (CAR.radio && !CAR.dead && CAR.driver) srcs[CAR.radio === 1 ? 'dance' : 'shahed'].push({ p: V(CAR.pos.x, 1, CAR.pos.z), t: CAR.radioT, loop: true });
  for (const pl of players()) { const k = pl.local ? (pl.emote && pl.emote.k) : pl.emote; if (k) srcs[EMOTE_TRACK[k]].push({ p: V(pl.pos.x, pl.pos.y + 1, pl.pos.z), t: pl.local ? pl.emote.t : (pl.emoteT || 0) }); }
  for (const name of ['dance', 'shahed']) {
    let src = null, bd = 1e9; for (const s2 of srcs[name]) { const d = s2.p.distanceTo(camera.position); if (d < bd) { bd = d; src = s2; } }
    const on = !!src && live;
    if (on && !G.trk[name]) G.trk[name] = playTrack(name, true, src.t, !!src.loop);
    else if (!on && G.trk[name]) { playTrack(name, false); G.trk[name] = false; }
    if (G.trk[name]) trackVol(name, src.p, src.loud ? 0.25 : 0.1, src.loud ? 45 : 34, src.loud ? 1.3 : 1.1);
  }
  G.trackOn = G.trk.dance || G.trk.shahed;
  if (chased && G.mode === 'play') { G.heartT -= dt; if (G.heartT <= 0) { sfx.heart(); G.heartT = 0.75; } }
  if (G.mode === 'play' || G.mode === 'daybreak') updateHUD();
}

// ---------- старт ----------
D = DIFFS[diffKey];
maps = buildMaps();
G.esc = { gateOpen: false, gate: {} };
G.dyn = new THREE.Group(); scene.add(G.dyn);
placeMenuScene();
refreshMenu();
setMusic('menu');
pbrify(scene);
if (SAFE_BOOT) setTimeout(() => toast('Прошлый запуск оборвался — включена низкая графика (меняется в настройках)', 5), 800);
requestAnimationFrame(frame);
log('Игра загружена: webgl2=' + renderer.capabilities.isWebGL2 + ', maxTex=' + renderer.capabilities.maxTextureSize + ', сеть=' + (Net.kind || 'нет') + ', качество=' + SET.quality);

// отладка и автотесты
CH2 = createCh2({ renderer, T, P, joy, keys, sfx, sfx2, rain, playTrack, trackVol, trackReady, stopTracks, toast, showFade, hideFade, $, quality: SET.quality, setListener, Net, say,
  myId: () => Net.role !== 'single' ? Net.myId : 'me', diff: () => diffKey, playEnding,
  // взорвали ли дом в главе 1 (старые сохранения: глава 2 открыта фургоном — значит, дом взорван)
  boom: () => { try { const b = localStorage.getItem('hushwood.boom'); return b !== null ? b === '1' : localStorage.getItem('hushwood.ch2') === '1'; } catch (e) { return false; } },
  onExit: () => { if (MP()) { Net.leave(); singlePlayers(); } toMenu(); } });
// фон главного меню: если вторая глава открыта — показываем дождливый двор у девятиэтажки
function menuBg() { if (G.mode !== 'menu' || !CH2 || CH2.S.on) return; if (ch2Unlocked()) { try { CH2.menu(true); } catch (e) { log('menu bg: ' + e.message); } } }
$('paper').addEventListener('click', () => { $('paper').classList.add('hidden'); P.ui = false; });
// заставка «by B → by Burbonishe»
(function splash() {
  const el = $('splash'); if (!el) return;
  const done = () => { if (el.dataset.done) return; el.dataset.done = '1'; el.classList.add('out'); setTimeout(() => el.remove(), 700); };
  if (/[?&]shot/.test(location.search)) { el.remove(); setTimeout(menuBg, 0); return; }
  const rest = el.querySelector('.rest'), word = el.querySelector('.word');
  const letters = [...rest.textContent].map((ch, i) => { const s = document.createElement('span'); s.textContent = ch; s.style.transitionDelay = (0.06 * i) + 's'; return s; });
  rest.textContent = ''; letters.forEach(s => rest.appendChild(s));
  const shift = rest.offsetWidth / 2; word.style.transform = 'translateX(' + shift + 'px)';
  setTimeout(() => el.classList.add('in'), 100);
  setTimeout(() => { word.style.transform = 'translateX(0)'; el.classList.add('open'); }, 1200);
  setTimeout(() => { menuBg(); }, 2500);   // уровень второй главы строится, пока надпись стоит
  setTimeout(done, 3500);
  el.addEventListener('pointerdown', done);
})();
window.HW = {
  start: (k) => { singlePlayers(); newGame(k || 'normal'); },
  tp: (f, x, z, yaw = 0, pitch = 0) => { P.f = f; P.pos.set(x * CS, FLOOR_Y[f], z * CS); P.pos.y = heightAt(f, P.pos.x, P.pos.z); P.yaw = yaw; P.pitch = pitch; P.hidden = null; P.hideAnim = null; P.climb = null; P.ui = false; document.body.classList.remove('hiding'); G.mode = 'play'; hideFade(); },
  tick: (n = 10, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); renderer.render(scene, camera); },
  freeze: () => { G.mode = 'frozen'; },
  place: (who, f, x, z, yaw) => { const e = { hostess, watchman, thing }[who]; e.place(f, x, z); if (yaw !== undefined) { e.yaw = e.tyaw = yaw; } e.state = 'pause'; e.timer = 999; e.sync(); },
  light: (on) => { P.light = on; },
  hide: (i) => enterHide(furn.hides[i], i),
  hides: () => furn.hides.map((h, i) => [i, h.f, h.x, h.z, h.type]),
  give: (id) => { const o = G.objects.find(o => o.id === id && !o.broken); if (o) { o.locked = false; if (Net.role === 'client') return false; holdFor(P, o); } return !!o; },
  weapon: (id) => { P.weapons[id] = true; P.weap = id; P.stones = 10; P.flareAmmo = 2; updateWeapView(); },
  fire: () => fire(),
  state: () => ({ mode: G.mode, role: Net.role, f: P.f, pos: P.pos.toArray().map(v => +v.toFixed(2)), host: hostess.state, watch: watchman.state, thing: thing.state, day: G.day, focus: focus && focus.label, hidden: !!P.hidden, held: P.held && P.held.id, downed: P.downed, lives: P.lives, players: players().map(p => p.name + (p.downed ? '(down)' : '') + '@' + p.pos.toArray().map(v => v.toFixed(1)).join(',')), secret: furn.secret.open, chest: furn.chest.open, safe: furn.safe.open, hatch: furn.hatch.open, code: G.code, time: +G.time.toFixed(1) }),
  wm: () => watchman, hs: () => hostess, doll: () => doll, act: () => doAction(), focus: () => focus && focus.label,
  objs: () => G.objects.filter(o => !o.broken).map(o => [o.id, o.f, +o.pos.x.toFixed(2), +o.pos.y.toFixed(2), +o.pos.z.toFixed(2), o.rest, o.heldBy, o.locked ? 'L' : '']),
  drawCalls: () => { renderer.render(scene, camera); return renderer.info.render.calls; },
  freeAt: (f, x, z) => { const r = 0.28; for (const [ox, oz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { const ch = cell(f, Math.floor((x + ox) / CS), Math.floor((z + oz) / CS)); if (ch === null || '#fwRq WTB'.includes(ch)) return false; } return !hitCollider(f, x, z, r, FLOOR_Y[f]); },
  code: (c) => tryCode(P, c), BT, clubPress: (l) => clubPress(l), songTime: () => songTime(), bunker: () => enterBunker(), pilot: () => launchPilot(), PILOT, adam: () => { G.adamT = 0; }, AD, CAR, tom: () => startTom(), TG, AB, aura: () => startAura(), auraWin: () => endAura(true), car: () => { CAR.unlocked = true; enterCar(P); }, breakWall, wiggle: (pid) => wiggleSack(PL.get(pid)), yard: () => yard, drone: () => { G.droneT = 0; }, DR, boom: (f, x, z) => explodeAt(V(x * CS, FLOOR_Y[f] + 1, z * CS), f, P), kill: (pid) => { const pl = PL.get(pid) || P; caught(hostess, pl); }, emote: (k) => startEmote(k), traps: () => G.traps.map(t => [t.id, t.f, +t.pos.x.toFixed(1), +t.pos.z.toFixed(1), t.armed, t.gone]), addTrap: (f, x, z) => addTrap(f, x * CS, z * CS).id, dlen: () => danceLen(), trk: () => !!G.trackOn, climb: () => startClimb(), dance: () => { G.danceT = 0; },
  danceNow: () => { hostess.place(...DANCE_SPOTS.hostess); watchman.place(...DANCE_SPOTS.watchman); hostess.state = watchman.state = 'todance'; G.danceWait = 5; },
  planCheck: (n = 50) => { let ok = 0; for (let i = 0; i < n; i++) { const p = planItems(); if (solvable(p.place)) ok++; } return ok; },
  killP: (pid) => killPlayer(hostess, PL.get(pid)), los: (f, a, b) => los(f, a, b), heightAt: (f, x, z) => heightAt(f, x, z), spots: SPOTS,
  banya: () => { G.kochDug = true; G.banyaOpen = true; applyBanyaVisual(); enterBanya(P); }, KB, koch: () => koch, inBanya: () => inBanya(P), BN,
  ch2: (skip) => startChapter2(!!skip), CH2: () => CH2,
  endTest: (who) => { const E = ending1(who); playEnding({ draw: E.draw, lines: E.lines, title: E.title, onDone: () => { } }); },
  net: Net, hostStart, openNet, caughtBy: (w, pid) => caught({ hostess, watchman, thing }[w], pid ? PL.get(pid) : P),
  lt: () => String(lightT), maps: () => maps, T, scene, THREE, G, P, PL, keys, furn, pool: () => POOL.map(l => [l.position.toArray().map(v => +v.toFixed(1)), +l.intensity.toFixed(1), l.distance]),
};
