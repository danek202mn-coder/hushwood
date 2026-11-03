import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const CS = 2;                     // размер клетки, м
export const W = 32, H = 24;             // клеток по X и Z
export const NFLOORS = 4;
export const FLOOR_Y = [-3, 0, 3, 6];    // подвал, 1 этаж, 2 этаж, чердак

// ---------- карта ----------
// '#' стена  'q' стекло  '.' пол  'c' скрипучий пол  'D' дверь  'L' запертая дверь  'H' тайный стеллаж
// 'S' лестница  'W' шкаф  'B' кровать  'T' мебель  'g' трава  'p' тропинка  'f' забор
// 'G' ворота  'r' рельсы  'R' дрезина  'Y' дерево  'w' вода  'o' колодец  ' ' пусто
function grid(ch) { const g = []; for (let z = 0; z < H; z++) g.push(new Array(W).fill(ch)); return g; }
function rect(g, x0, z0, x1, z1, ch) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z][x] = ch; }
function put(g, list, ch) { for (const [x, z] of list) g[z][x] = ch; }

export const SHED = { x0: 22, z0: 3, x1: 27, z1: 8 };
export const GREEN = { x0: 22, z0: 12, x1: 28, z1: 18 };
export const BANYA = { x0: 14, z0: 17, x1: 18, z1: 20 };   // банька во дворе: стены по краю, внутри комната 3×2 клетки
export const ATTIC = { x0: 2, z0: 6, x1: 17, z1: 12 };
export const HATCH = { f: 2, x: 13, z: 9 };
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
let HOUSE_GONE = false;
export function setHouseGone(v) { HOUSE_GONE = !!v; }
export function insideHouse(cx, cz) { return !HOUSE_GONE && cx >= 2 && cx <= 17 && cz >= 3 && cz <= 14; }
export function indoor(f, x, z) {
  if (f === 0 || f === 3) return true;
  if (insideHouse(x, z)) return true;
  if (f === 1 && (inR(SHED, x, z) || inR(GREEN, x, z) || inR(BANYA, x, z))) return true;
  return false;
}
export function zoneOf(f, x, z) {
  if (f === 0) return x >= 15 && z <= 5 ? 'secret' : 'basement';
  if (f === 3) return 'attic';
  if (f === 2 && z <= 2) return 'balcony';
  if (f === 1 && inR(SHED, x, z)) return 'shed';
  if (f === 1 && inR(GREEN, x, z)) return 'green';
  if (f === 1 && inR(BANYA, x, z)) return 'banya';
  if (insideHouse(x, z)) return 'house';
  return 'yard';
}

export function buildMaps() {
  // Подвал
  const g0 = grid('#');
  put(g0, [[15, 11], [15, 12], [15, 13]], 'S');
  rect(g0, 15, 14, 15, 15, '.');
  rect(g0, 5, 15, 15, 15, '.');
  rect(g0, 11, 6, 11, 14, '.');
  rect(g0, 8, 3, 13, 5, '.');
  rect(g0, 7, 11, 7, 14, '.');
  rect(g0, 4, 8, 8, 10, '.');
  rect(g0, 4, 11, 4, 16, '.');
  rect(g0, 2, 3, 3, 17, 'w');
  put(g0, [[13, 3], [8, 3]], 'T');
  g0[4][14] = 'H';
  rect(g0, 15, 3, 18, 5, '.');
  put(g0, [[18, 4], [13, 16]], 'T'); // ящики — в нише, не в проходе

  // Первый этаж и двор
  const g1 = grid('g');
  for (let x = 0; x < W; x++) { g1[0][x] = 'f'; g1[H - 1][x] = 'f'; }
  for (let z = 0; z < H; z++) { g1[z][0] = 'f'; g1[z][W - 1] = 'f'; }
  g1[0][9] = 'G';
  for (let z = 0; z <= 22; z++) g1[z][30] = 'r';
  g1[20][30] = 'R';
  for (let z = 1; z <= 2; z++) g1[z][9] = 'p';
  for (let x = 10; x <= 24; x++) g1[2][x] = 'p';
  for (let z = 3; z <= 11; z++) g1[z][24] = 'p';
  for (let x = 24; x <= 25; x++) g1[11][x] = 'p';
  put(g1, [[4, 1], [15, 1], [1, 9], [5, 17], [13, 19], [19, 21], [20, 10], [28, 1], [3, 21], [11, 21], [27, 21], [21, 1]], 'Y');
  put(g1, [[19, 16]], 'o');
  // банька: толстые бревенчатые стены (клетки-пустоты), внутри пол, в северной стене проём
  for (let z = BANYA.z0; z <= BANYA.z1; z++) for (let x = BANYA.x0; x <= BANYA.x1; x++) g1[z][x] = (x === BANYA.x0 || x === BANYA.x1 || z === BANYA.z0 || z === BANYA.z1) ? ' ' : '.';
  g1[BANYA.z0][16] = '.';
  rect(g1, 2, 3, 17, 14, '#');
  rect(g1, 3, 4, 6, 6, '.'); rect(g1, 8, 4, 10, 6, '.'); rect(g1, 12, 4, 16, 6, '.');
  rect(g1, 3, 8, 16, 9, '.');
  rect(g1, 3, 11, 6, 13, '.'); rect(g1, 8, 11, 8, 13, '.');
  put(g1, [[9, 12], [10, 12], [11, 12], [15, 11], [15, 12], [15, 13]], 'S');
  put(g1, [[9, 3], [5, 7], [14, 7], [5, 10], [8, 10]], 'D');
  g1[7][9] = '.';
  g1[10][15] = 'L';
  put(g1, [[10, 8], [4, 9], [13, 9], [9, 5]], 'c');
  put(g1, [[4, 5], [3, 4], [14, 5], [6, 13]], 'T');
  put(g1, [[16, 4], [8, 4], [8, 13], [16, 9]], 'W');
  put(g1, [[3, 13]], 'B');
  // сарай
  rect(g1, SHED.x0, SHED.z0, SHED.x1, SHED.z1, '#');
  rect(g1, 23, 4, 26, 7, '.');
  g1[8][24] = 'L';
  put(g1, [[26, 4], [23, 4]], 'T');
  put(g1, [[26, 7]], 'W');
  // теплица
  rect(g1, GREEN.x0, GREEN.z0, GREEN.x1, GREEN.z1, 'q');
  rect(g1, 23, 13, 27, 17, '.');
  g1[12][25] = 'D';
  put(g1, [[23, 14], [23, 16], [27, 14], [27, 16]], 'T');

  // Второй этаж
  const g2 = grid(' ');
  rect(g2, 2, 3, 17, 14, '#');
  rect(g2, 3, 4, 6, 6, '.'); rect(g2, 8, 4, 10, 6, '.'); rect(g2, 12, 4, 16, 6, '.');
  rect(g2, 3, 8, 16, 9, '.');
  rect(g2, 3, 11, 6, 13, '.'); rect(g2, 12, 11, 12, 13, '.'); rect(g2, 14, 11, 16, 13, '.');
  put(g2, [[9, 12], [10, 12], [11, 12]], 'S');
  put(g2, [[5, 7], [14, 7], [5, 10], [15, 10]], 'D');
  g2[7][9] = '.'; g2[10][12] = '.';
  g2[3][9] = 'L';
  rect(g2, 8, 2, 10, 2, '.');
  put(g2, [[7, 8], [11, 9], [15, 8]], 'c');
  put(g2, [[3, 6], [16, 6], [16, 13]], 'T');
  put(g2, [[6, 4], [6, 11], [3, 9]], 'W');
  put(g2, [[3, 4], [12, 4], [3, 13]], 'B');

  // Чердак
  const g3 = grid(' ');
  rect(g3, ATTIC.x0, ATTIC.z0, ATTIC.x1, ATTIC.z1, '#');
  rect(g3, 3, 7, 16, 11, '.');
  put(g3, [[6, 8], [11, 10], [15, 9]], 'c');
  put(g3, [[16, 9], [3, 7], [9, 11]], 'T');
  put(g3, [[4, 11]], 'W');

  return [g0, g1, g2, g3];
}

export const FURN_TYPE = {
  '1,3,4': 'stove', '1,4,5': 'table', '1,14,5': 'table', '1,6,13': 'desk',
  '2,3,6': 'dresser', '2,16,6': 'dresser', '2,16,13': 'tub',
  '0,13,3': 'bench', '0,8,3': 'bench', '0,18,4': 'chest', '0,13,16': 'crates',
  '1,26,4': 'workbench', '1,23,4': 'shelfunit',
  '1,23,14': 'planter', '1,23,16': 'planter', '1,27,14': 'planter', '1,27,16': 'planter',
  '3,16,9': 'safe', '3,3,7': 'crates', '3,9,11': 'trunk',
};
const TILE_ROOMS = [[1, 3, 4, 6, 6], [2, 14, 11, 16, 13]];

export const RAMPS = [
  { cells: [[9, 12], [10, 12], [11, 12]], low: 1, high: 2, axis: 'x', a: 9 * CS, b: 12 * CS },
  { cells: [[15, 11], [15, 12], [15, 13]], low: 0, high: 1, axis: 'z', a: 14 * CS, b: 11 * CS },
];
export function rampAt(cx, cz) {
  for (const r of RAMPS) for (const [x, z] of r.cells) if (x === cx && z === cz) return r;
  return null;
}
export function rampY(r, x, z) {
  const c = r.axis === 'x' ? x : z;
  let t = (c - r.a) / (r.b - r.a);
  t = Math.max(0, Math.min(1, t));
  return FLOOR_Y[r.low] + t * (FLOOR_Y[r.high] - FLOOR_Y[r.low]);
}
const RZ0 = 3 * CS - 0.6, RZ1 = 15 * CS + 0.6, RZM = (RZ0 + RZ1) / 2, RY0 = 6, RY1 = 9.5;
export function roofY(z) { return RY0 + (RY1 - RY0) * Math.max(0, 1 - Math.abs(z - RZM) / (RZM - RZ0)); }

// ---------- текстуры ----------
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let ANISO = 4, LOW = false;
const noiseCache = {};
// плавный бесшовный шум: без мелкой «ряби», которая мерцает на телефоне
export function fbm(n, seed, oct = 4, base = 4) {
  const key = n + ':' + seed + ':' + oct + ':' + base;
  if (noiseCache[key]) return noiseCache[key];
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), R = rng(seed);
  const acc = new Float32Array(n * n);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const L = base << o, lat = new Float32Array(L * L);
    for (let i = 0; i < lat.length; i++) lat[i] = R();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x / n * L, fy = y / n * L, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = lat[(y0 % L) * L + x0 % L], b = lat[(y0 % L) * L + (x0 + 1) % L], c2 = lat[((y0 + 1) % L) * L + x0 % L], d = lat[((y0 + 1) % L) * L + (x0 + 1) % L];
      acc[y * n + x] += amp * (a + (b - a) * sx + (c2 - a) * sy + (a - b - c2 + d) * sx * sy);
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < n * n; i++) { const v = acc[i] / tot * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return (noiseCache[key] = c);
}
export function grime(g, w, h, seed, alpha, mode = 'multiply') {
  const n = fbm(64, seed, 4, 3);
  g.save(); g.globalCompositeOperation = mode; g.globalAlpha = alpha; g.imageSmoothingEnabled = true;
  for (let y = 0; y < h; y += 256) for (let x = 0; x < w; x += 256) g.drawImage(n, x, y, 256, 256);
  g.restore();
}
export function stain(g, x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = a; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
}
function crack(g, R, x, y, len, col, w = 1) {
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
  for (let i = 0; i < len; i++) { x += R() * 10 - 5; y += R() * 7 + 3; g.lineTo(x, y); }
  g.stroke();
}
export function tex(w, h, draw, seed = 1) {
  let c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const R = rng(seed);
  draw(g, w, h, R);
  if (LOW && w >= 128) {
    const s = document.createElement('canvas'); s.width = w / 2; s.height = h / 2;
    s.getContext('2d').drawImage(c, 0, 0, w / 2, h / 2); c.width = c.height = 0; c = s;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function fleur(g, x, y, s, col) {
  g.fillStyle = col; g.beginPath();
  g.moveTo(x, y - s); g.quadraticCurveTo(x + s * 0.6, y - s * 0.2, x, y + s * 0.5); g.quadraticCurveTo(x - s * 0.6, y - s * 0.2, x, y - s); g.fill();
  g.beginPath(); g.arc(x - s * 0.55, y + s * 0.15, s * 0.22, 0, 7); g.arc(x + s * 0.55, y + s * 0.15, s * 0.22, 0, 7); g.fill();
  g.fillRect(x - 0.6, y + s * 0.4, 1.2, s * 0.6);
}
function wallTex(base, stripeA, motif, panel, seed) {
  // 256×384 = 2 м × 3 м; деревянная панель снизу ~0.95 м
  return tex(256, 384, (g, w, h, R) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = stripeA; g.fillRect(x, 0, 12, 262); }
    for (let y = 22, row = 0; y < 250; y += 36, row++) for (let x = (row % 2) * 16 + 8; x < w; x += 32) fleur(g, x, y, 6, motif);
    grime(g, w, 262, seed, 0.45);
    for (let i = 0; i < 4; i++) { const x = R() * w; const gr = g.createLinearGradient(0, 0, 0, 120 + R() * 120); gr.addColorStop(0, 'rgba(70,45,15,0.35)'); gr.addColorStop(1, 'rgba(70,45,15,0)'); g.fillStyle = gr; g.fillRect(x, 0, 6 + R() * 14, 260); }
    stain(g, R() * w, 90 + R() * 80, 50, 'rgba(60,40,15,1)', 0.25);
    const dark = g.createLinearGradient(0, 150, 0, 262); dark.addColorStop(0, 'rgba(0,0,0,0)'); dark.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = dark; g.fillRect(0, 150, w, 112);
    g.fillStyle = '#2b1f16'; g.fillRect(0, 0, w, 6); g.fillStyle = 'rgba(255,230,190,0.12)'; g.fillRect(0, 6, w, 2);
    g.fillStyle = '#3a2416'; g.fillRect(0, 258, w, 10); g.fillStyle = 'rgba(255,220,170,0.18)'; g.fillRect(0, 258, w, 2); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 267, w, 2);
    g.fillStyle = panel; g.fillRect(0, 269, w, h - 269);
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 6, 280, 52, 84);
      g.fillStyle = panel; g.fillRect(x + 9, 283, 46, 78);
      g.fillStyle = 'rgba(255,220,180,0.07)'; g.fillRect(x + 9, 283, 46, 2);
    }
    grime(g, w, h, seed + 5, 0.25);
    g.fillStyle = '#140d07'; g.fillRect(0, h - 14, w, 14); g.fillStyle = 'rgba(255,220,180,0.1)'; g.fillRect(0, h - 14, w, 1);
  }, seed);
}
function planksTex(seed, tint, boards = 6, gap = 'rgba(13,7,3,0.55)') {
  // доски вдоль текстуры: мягкие волокна вдоль доски, без мелкой ряби (не рябит в глазах)
  return tex(256, 256, (g, w, h, R) => {
    const bh = h / boards;
    for (let i = 0; i < boards; i++) {
      const y = i * bh; let x = -R() * 140;
      while (x < w) {
        const len = 120 + R() * 150, v = 0.84 + R() * 0.26;
        g.fillStyle = `rgb(${tint[0] * v | 0},${tint[1] * v | 0},${tint[2] * v | 0})`; g.fillRect(x, y, len, bh);
        g.save(); g.beginPath(); g.rect(x, y, len, bh); g.clip();
        const sh = g.createLinearGradient(0, y, 0, y + bh); sh.addColorStop(0, 'rgba(255,220,170,0.06)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = sh; g.fillRect(x, y, len, bh);
        for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(30,15,6,${0.06 + R() * 0.08})`; g.lineWidth = 1 + R() * 2; g.beginPath(); const yy = y + 3 + R() * (bh - 6); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + (R() - 0.5) * 5, x + len * 0.7, yy + (R() - 0.5) * 5, x + len, yy + (R() - 0.5) * 3); g.stroke(); }
        if (R() < 0.3) { g.fillStyle = 'rgba(25,12,5,0.4)'; g.beginPath(); g.ellipse(x + 20 + R() * Math.max(1, len - 40), y + bh / 2, 6, 3, 0, 0, 7); g.fill(); }
        g.restore();
        g.fillStyle = gap; g.fillRect(x, y, 2, bh);
        g.fillStyle = 'rgba(20,20,20,0.6)'; g.fillRect(x + 7, y + 5, 2, 2); g.fillRect(x + 7, y + bh - 7, 2, 2);
        x += len;
      }
      g.fillStyle = gap; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(13,7,3,0.15)'; g.fillRect(0, y + 2, w, 2);
    }
    grime(g, w, h, seed, 0.25);
  }, seed);
}

export function makeTextures(quality) {
  ANISO = quality === 'low' ? 2 : quality === 'medium' ? 8 : 12; LOW = quality === 'low';
  const T = {};
  T.wall1 = wallTex('#59624a', 'rgba(255,255,230,0.05)', 'rgba(200,205,160,0.22)', '#3d2819', 11);
  T.wall2 = wallTex('#7a5c56', 'rgba(255,240,230,0.05)', 'rgba(230,200,190,0.2)', '#35231a', 22);
  T.planks = planksTex(3, [110, 72, 44]);
  T.attic = planksTex(33, [120, 96, 70], 5, 'rgba(26,16,8,0.6)');
  T.shedWall = planksTex(34, [92, 76, 60], 6, '#120a05');
  T.tile = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#2a2620'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const dark = (x + y) % 2, v = R() * 12;
      g.fillStyle = dark ? `rgb(${46 + v | 0},${66 + v | 0},${60 + v | 0})` : `rgb(${168 + v | 0},${158 + v | 0},${134 + v | 0})`;
      g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29);
    }
    grime(g, w, h, 31, 0.5);
    for (let i = 0; i < 4; i++) crack(g, R, R() * w, R() * h, 4, 'rgba(0,0,0,0.5)');
    stain(g, 170, 90, 70, 'rgba(50,35,10,1)', 0.3);
  }, 31);
  T.ceil = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#76716a'; g.fillRect(0, 0, w, h);
    grime(g, w, h, 4, 0.4);
    stain(g, 70, 80, 80, 'rgba(110,80,30,1)', 0.3); stain(g, 190, 180, 60, 'rgba(70,50,15,1)', 0.25);
    for (let i = 0; i < 3; i++) crack(g, R, R() * w, R() * 60, 14, 'rgba(30,25,20,0.5)', 1.2);
  }, 4);
  T.brick = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#2a2219'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row++) { const y = row * 256 / 12; for (let x = (row % 2) * 26 - 26; x < w; x += 52) {
      const v = 78 + R() * 30; g.fillStyle = `rgb(${v | 0},${v * 0.45 | 0},${v * 0.34 | 0})`;
      g.fillRect(x + 2, y + 2, 48, 17.3);
      g.fillStyle = 'rgba(255,210,170,0.07)'; g.fillRect(x + 2, y + 2, 48, 3);
    } }
    grime(g, w, h, 5, 0.5);
    for (let i = 0; i < 5; i++) { const x = R() * w; const gr = g.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, 'rgba(10,25,10,0.4)'); gr.addColorStop(1, 'rgba(10,25,10,0)'); g.fillStyle = gr; g.fillRect(x, 0, 8 + R() * 10, 200); }
    stain(g, 128, 230, 110, 'rgba(15,35,12,1)', 0.45);
  }, 5);
  T.stone = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#1b1916'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) for (let x = ((y / 64) % 2) * 40 - 40; x < w; x += 80) {
      const v = 58 + R() * 26; g.fillStyle = `rgb(${v | 0},${v | 0},${v - 6 | 0})`;
      g.beginPath(); if (g.roundRect) g.roundRect(x + 3, y + 3, 74, 58, 9); else g.rect(x + 3, y + 3, 74, 58); g.fill();
    }
    grime(g, w, h, 6, 0.55);
    stain(g, 60, 190, 80, 'rgba(10,25,25,1)', 0.5);
  }, 6);
  T.grass = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#1a2712'; g.fillRect(0, 0, w, h);
    grime(g, w, h, 7, 0.6, 'overlay');
    for (let i = 0; i < 900; i++) { const x = R() * w, y = R() * h; g.strokeStyle = R() < 0.5 ? 'rgba(60,95,40,0.5)' : 'rgba(10,18,6,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R() * 4 - 2, y - 5 - R() * 6); g.stroke(); }
    grime(g, w, h, 8, 0.3);
  }, 7);
  T.dirt = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#3a2c1e'; g.fillRect(0, 0, w, h); grime(g, w, h, 70, 0.6);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${90 + R() * 40 | 0},${80 + R() * 30 | 0},${70 + R() * 20 | 0},0.6)`; g.beginPath(); g.ellipse(R() * w, R() * h, 2 + R() * 3, 1.5 + R() * 2, R() * 3, 0, 7); g.fill(); }
  }, 70);
  const siding = (win, seed) => tex(256, 384, (g, w, h, R) => {
    for (let y = 0; y < h; y += 24) { const v = 64 + R() * 12; g.fillStyle = `rgb(${v | 0},${v - 4 | 0},${v - 10 | 0})`; g.fillRect(0, y, w, 24); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, y + 21, w, 3); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, y, w, 2); }
    grime(g, w, h, seed, 0.5);
    if (win) {
      g.fillStyle = '#1a1008'; g.fillRect(60, 80, 136, 190);
      const gr = g.createLinearGradient(0, 90, 0, 260); gr.addColorStop(0, '#c8984a'); gr.addColorStop(1, '#6a3a12');
      g.fillStyle = gr; g.fillRect(70, 90, 116, 170);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(70, 90, 116, 170);
      g.fillStyle = '#1a1008'; g.fillRect(124, 90, 8, 170); g.fillRect(70, 170, 116, 8);
      g.fillStyle = '#3a2614'; g.fillRect(52, 270, 152, 12);
      g.save(); g.translate(128, 175); g.rotate(0.5); g.fillStyle = '#5a3e22'; g.fillRect(-100, -9, 200, 18); g.rotate(-1.0); g.fillRect(-100, -9, 200, 18); g.restore();
    }
  }, seed);
  T.siding = siding(false, 8); T.window = siding(true, 9);
  T.fence = planksTex(10, [84, 62, 40], 1, '#0a0603');
  T.water = tex(256, 256, (g, w, h, R) => { g.fillStyle = '#081416'; g.fillRect(0, 0, w, h); grime(g, w, h, 12, 0.35, 'screen'); for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(100,160,160,${R() * 0.2})`; g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 3, x + 22, y); g.stroke(); } }, 12);
  T.roof = tex(256, 256, (g, w, h, R) => {
    for (let y = 0; y < h; y += 24) for (let x = ((y / 24) % 2) * 16 - 16; x < w; x += 32) { const v = 30 + R() * 18; g.fillStyle = `rgb(${v | 0},${v - 3 | 0},${v + 2 | 0})`; g.fillRect(x, y, 30, 22); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y + 20, 30, 4); }
    grime(g, w, h, 13, 0.4);
  }, 13);
  T.roofIn = planksTex(35, [70, 52, 38], 6, '#0e0804');
  T.wood = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#4a2e1c'; g.fillRect(0, 0, w, h);
    const n = fbm(64, 14, 3, 2); g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.6; g.drawImage(n, 0, 0, 16, 64, 0, 0, w, h); g.restore();
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(20,10,4,${0.15 + R() * 0.2})`; g.lineWidth = 1.5; g.beginPath(); const x = R() * w; g.moveTo(x, 0); g.bezierCurveTo(x + (R() - 0.5) * 20, h * 0.3, x + (R() - 0.5) * 20, h * 0.7, x + (R() - 0.5) * 10, h); g.stroke(); }
    grime(g, w, h, 15, 0.25);
  }, 14);
  T.cloth = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#4a4458'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = (x + y) % 128 ? '#5e3e3c' : '#3c4c5c'; g.fillRect(x + 3, y + 3, 58, 58); g.strokeStyle = 'rgba(255,255,255,0.15)'; g.setLineDash([3, 3]); g.lineWidth = 1.5; g.strokeRect(x + 7, y + 7, 50, 50); }
    g.setLineDash([]);
    grime(g, w, h, 16, 0.45);
    stain(g, 140, 120, 40, 'rgba(70,10,10,1)', 0.35);
  }, 15);
  T.rug = tex(256, 256, (g, w, h, R) => {
    g.fillStyle = '#5a1c1c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b08a4a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52);
    for (let i = 0; i < 6; i++) { const cx = w / 2, cy = h / 2, r = 20 + i * 14; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.lineWidth = 3; g.strokeStyle = i % 2 ? '#2a3a5a' : '#c8a060'; g.stroke(); }
    grime(g, w, h, 17, 0.55);
  }, 17);
  T.metal = tex(128, 128, (g, w, h, R) => { g.fillStyle = '#4c4e50'; g.fillRect(0, 0, w, h); grime(g, w, h, 18, 0.6); stain(g, 40, 90, 50, 'rgba(110,50,15,1)', 0.55); stain(g, 100, 30, 30, 'rgba(110,50,15,1)', 0.4); }, 18);
  T.glass = tex(128, 128, (g, w, h, R) => { g.fillStyle = 'rgba(150,190,180,0.25)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 6; g.beginPath(); g.moveTo(10, 120); g.lineTo(60, 10); g.stroke(); g.fillStyle = 'rgba(40,60,30,0.35)'; g.fillRect(0, 96, w, 32); g.strokeStyle = '#2a2a24'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); g.fillStyle = '#2a2a24'; g.fillRect(0, 62, w, 4); }, 19);
  T.capStripe = tex(32, 64, (g, w, h) => { for (let y = 0; y < h; y += 8) { g.fillStyle = (y / 8) % 2 ? '#d8d0c0' : '#6a1818'; g.fillRect(0, y, w, 8); } }, 20);
  T.web = tex(128, 128, (g, w, h, R) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(220,220,220,0.45)'; g.lineWidth = 1;
    for (let a = 0; a < 9; a++) { const an = a / 8 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * 128, Math.sin(an) * 128); g.stroke(); }
    for (let r = 12; r < 128; r += 14 + R() * 6) { g.beginPath(); for (let a = 0; a <= 8; a++) { const an = a / 8 * Math.PI / 2; const rr = r + R() * 4; a ? g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : g.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.stroke(); }
  }, 21);
  T.blood = tex(128, 128, (g, w, h, R) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${70 + R() * 30 | 0},0,0,${0.45 + R() * 0.4})`; g.beginPath(); g.arc(64 + (R() - 0.5) * 70, 64 + (R() - 0.5) * 70, 4 + R() * 20, 0, 7); g.fill(); }
  }, 22);
  T.writing = tex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(110,10,10,0.85)'; g.font = 'bold 30px Georgia'; g.textAlign = 'center';
    g.fillText('НЕ ВЕРЬ', 128, 52); g.fillText('КУКЛЕ', 128, 92);
    for (let i = 0; i < 12; i++) g.fillRect(40 + i * 15, 56 + (i % 3) * 30, 2, 10 + (i * 7) % 30);
  }, 23);
  // пасхалка: парадный портрет Тома Перла
  T.tomPearl = tex(256, 340, (g, w, h, R) => {
    g.fillStyle = '#3a2408'; g.fillRect(0, 0, w, h);
    const fr = g.createLinearGradient(0, 0, w, h); fr.addColorStop(0, '#d8b048'); fr.addColorStop(0.5, '#8a6418'); fr.addColorStop(1, '#e0c060');
    g.fillStyle = fr; g.fillRect(6, 6, w - 12, h - 12);
    g.strokeStyle = 'rgba(60,40,0,0.6)'; g.lineWidth = 2; for (let k = 10; k < 22; k += 4) g.strokeRect(k, k, w - 2 * k, h - 2 * k);
    const x0 = 22, y0 = 22, iw = w - 44, ih = h - 80;
    const bg = g.createRadialGradient(128, 120, 10, 128, 150, 170); bg.addColorStop(0, '#4a5a3a'); bg.addColorStop(1, '#141a10');
    g.fillStyle = bg; g.fillRect(x0, y0, iw, ih);
    // драпировка
    g.fillStyle = 'rgba(120,20,20,0.55)'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + 60, y0 + 40, x0 + 20, y0 + ih); g.lineTo(x0, y0 + ih); g.fill();
    // пиджак
    g.fillStyle = '#1c1c26'; g.beginPath(); g.moveTo(40, y0 + ih); g.quadraticCurveTo(50, 205, 128, 196); g.quadraticCurveTo(206, 205, 216, y0 + ih); g.fill();
    g.fillStyle = '#ece6d8'; g.beginPath(); g.moveTo(104, 200); g.lineTo(128, 260); g.lineTo(152, 200); g.fill();
    g.fillStyle = '#2a2a36'; g.beginPath(); g.moveTo(100, 200); g.lineTo(122, 262); g.lineTo(90, 230); g.fill(); g.beginPath(); g.moveTo(156, 200); g.lineTo(134, 262); g.lineTo(166, 230); g.fill();
    // бабочка
    g.fillStyle = '#9a1414'; g.beginPath(); g.moveTo(128, 210); g.lineTo(108, 200); g.lineTo(108, 222); g.fill(); g.beginPath(); g.moveTo(128, 210); g.lineTo(148, 200); g.lineTo(148, 222); g.fill(); g.fillRect(123, 205, 10, 10);
    // шея и лицо
    g.fillStyle = '#d8a888'; g.fillRect(114, 170, 28, 32);
    const sk = g.createRadialGradient(118, 120, 8, 128, 130, 52); sk.addColorStop(0, '#f0c8a8'); sk.addColorStop(1, '#b07e60');
    g.fillStyle = sk; g.beginPath(); g.ellipse(128, 132, 38, 48, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(90, 136, 7, 12, 0, 0, Math.PI * 2); g.ellipse(166, 136, 7, 12, 0, 0, Math.PI * 2); g.fill();
    // зачёсанные волосы с пробором
    g.fillStyle = '#2a1a10'; g.beginPath(); g.moveTo(88, 128); g.quadraticCurveTo(84, 78, 128, 76); g.quadraticCurveTo(174, 76, 168, 128); g.quadraticCurveTo(160, 98, 140, 96); g.quadraticCurveTo(110, 92, 92, 112); g.fill();
    g.strokeStyle = 'rgba(255,230,200,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(112, 80); g.quadraticCurveTo(108, 90, 104, 100); g.stroke();
    // глаза, очки, усы, ухмылка
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(113, 128, 7, 4.5, 0, 0, Math.PI * 2); g.ellipse(143, 128, 7, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a4a2a'; g.beginPath(); g.arc(115, 128, 3.2, 0, Math.PI * 2); g.arc(145, 128, 3.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3; g.beginPath(); g.moveTo(104, 118); g.lineTo(121, 116); g.moveTo(135, 116); g.lineTo(153, 115); g.stroke();
    g.strokeStyle = '#a08030'; g.lineWidth = 2; g.beginPath(); g.arc(113, 129, 11, 0, Math.PI * 2); g.moveTo(154, 129); g.arc(143, 129, 11, 0, Math.PI * 2); g.moveTo(124, 128); g.lineTo(132, 128); g.stroke();
    g.strokeStyle = '#8a5a40'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 132); g.lineTo(124, 150); g.lineTo(131, 151); g.stroke();
    g.fillStyle = '#2a1a10'; g.beginPath(); g.moveTo(128, 157); g.quadraticCurveTo(108, 154, 100, 166); g.quadraticCurveTo(114, 160, 128, 162); g.quadraticCurveTo(142, 160, 156, 166); g.quadraticCurveTo(148, 154, 128, 157); g.fill();
    g.strokeStyle = '#7a3a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(116, 168); g.quadraticCurveTo(132, 172, 142, 165); g.stroke();
    // лак и трещинки
    grime(g, w, h, 41, 0.18);
    g.strokeStyle = 'rgba(30,20,10,0.25)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const x = x0 + R() * iw, y = y0 + R() * ih; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R() * 14 - 7, y + R() * 14 - 7); g.stroke(); }
    // табличка
    const pl = g.createLinearGradient(0, h - 52, 0, h - 22); pl.addColorStop(0, '#e8c868'); pl.addColorStop(1, '#9a7420');
    g.fillStyle = pl; g.fillRect(62, h - 52, w - 124, 30); g.strokeStyle = '#5a400a'; g.strokeRect(62, h - 52, w - 124, 30);
    g.fillStyle = '#2a1a04'; g.font = 'bold 19px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ТОМ ПЕРЛ', 128, h - 37);
  }, 77);
  T.paintings = [0, 1, 2, 3, 4, 5].map(i => tex(128, 160, (g, w, h, R) => {
    const bg = ['#26301f', '#3a2a22', '#1f2433', '#33301f', '#2a1a1a', '#1a2a2a'][i];
    g.fillStyle = '#4a3014'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a6a2a'; g.fillRect(4, 4, w - 8, h - 8);
    g.fillStyle = bg; g.fillRect(12, 12, w - 24, h - 24);
    const gr = g.createRadialGradient(64, 70, 5, 64, 80, 70); gr.addColorStop(0, 'rgba(255,220,160,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = gr; g.fillRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#0c0807'; g.beginPath(); g.ellipse(64, 138, 40, 32, 0, Math.PI, 0); g.fill();
    g.fillStyle = ['#b8a890', '#a89878', '#c0b0a0', '#988870', '#d0c0b0', '#a0a0a0'][i]; g.beginPath(); g.ellipse(64, 72, 21, 27, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(70, 76, 14, 22, 0, 0, 7); g.fill();
    g.fillStyle = '#2a2018'; g.beginPath(); g.ellipse(64, 52, 24, 13, 0, Math.PI, 0); g.fill();
    if (i === 2 || i === 4) { g.fillStyle = '#000'; g.fillRect(48, 66, 32, 6); }
    else { g.fillStyle = '#1a1010'; g.fillRect(54, 68, 6, 3); g.fillRect(68, 68, 6, 3); }
    g.fillStyle = '#3a1010'; g.fillRect(57, 86, 14, 2);
    grime(g, w, h, 30 + i, 0.4);
    if (i === 4) { g.fillStyle = 'rgba(120,0,0,0.6)'; g.fillRect(56, 72, 2, 30); g.fillRect(72, 72, 2, 24); }
  }, 30 + i));
  T.flesh = tex(128, 128, (g, w, h, R) => {
    g.fillStyle = '#2a1230'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) stain(g, R() * w, R() * h, 6 + R() * 16, R() < 0.5 ? 'rgba(130,40,90,1)' : 'rgba(10,0,10,1)', 0.5);
    for (let i = 0; i < 25; i++) { g.strokeStyle = 'rgba(170,40,60,0.5)'; g.lineWidth = 1.5; g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += R() * 16 - 8; y += R() * 16 - 8; g.lineTo(x, y); } g.stroke(); }
  }, 41);
  const memo = (fn) => { const cache = {}; return (a, b) => cache[a] || (cache[a] = fn(a, b)); };
  T.knit = memo((base, seed) => tex(128, 128, (g, w, h, R) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 8); g.lineTo(x + 8, y); g.lineTo(x + 6, y); g.lineTo(x + 4, y + 5); g.lineTo(x + 2, y); g.fill(); }
    grime(g, w, h, seed, 0.3);
  }, seed));
  T.fabric = memo((base, seed) => tex(128, 128, (g, w, h, R) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 0, 5, h); }
    for (let y = 8; y < h; y += 16) for (let x = (y / 16 % 2) * 8; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
    grime(g, w, h, seed, 0.35);
    stain(g, 90, 100, 25, 'rgba(50,10,5,1)', 0.35);
  }, seed));
  T.porcelain = tex(128, 128, (g, w, h, R) => {
    g.fillStyle = '#ece4da'; g.fillRect(0, 0, w, h); grime(g, w, h, 42, 0.15);
    for (let i = 0; i < 3; i++) crack(g, R, 40 + R() * 50, R() * 40, 9, 'rgba(60,50,45,0.7)');
  }, 40);
  return T;
}

// ---------- сборка геометрии ----------
class Geo {
  constructor() { this.b = {}; }
  bucket(k) { return this.b[k] || (this.b[k] = { p: [], n: [], u: [] }); }
  quad(k, a, b, c, d, uw = 1, uh = 1, u0 = 0, v0 = 0) {
    const B = this.bucket(k);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const P = [a, b, c, a, c, d];
    const U = [[u0, v0], [u0 + uw, v0], [u0 + uw, v0 + uh], [u0, v0], [u0 + uw, v0 + uh], [u0, v0 + uh]];
    for (let i = 0; i < 6; i++) { B.p.push(...P[i]); B.n.push(nx, ny, nz); B.u.push(...U[i]); }
  }
  // вертикальная стена с UV в реальных метрах
  wall(k, a, b, ya, yb, ybB, vtop = 3) {
    const yb2 = ybB === undefined ? yb : ybB;
    const B = this.bucket(k);
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const pts = [[a[0], ya, a[2]], [b[0], ya, b[2]], [b[0], yb2, b[2]], [a[0], yb, a[2]]];
    const uvs = [[0, 0], [len / 2, 0], [len / 2, (yb2 - ya) / vtop], [0, (yb - ya) / vtop]];
    const ux = b[0] - a[0], uz = b[2] - a[2];
    let nx = -uz, nz = ux; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    for (const i of [0, 1, 2, 0, 2, 3]) { B.p.push(...pts[i]); B.n.push(nx, 0, nz); B.u.push(...uvs[i]); }
  }
  meshes(mats) {
    const out = [];
    for (const k in this.b) {
      const B = this.b[k];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[k]); m.name = k; out.push(m);
    }
    return out;
  }
}

const YARD = new Set(['g', 'f', 'G', 'r', 'R', 'Y', 'p', 'o']);
const MC = {};
// общий кэш материалов: одинаковые материалы склеиваются в один вызов отрисовки
export const L = (o) => {
  const key = JSON.stringify(o, (k, v) => v && v.isTexture ? v.uuid : v);
  return MC[key] || (MC[key] = new THREE.MeshLambertMaterial(o));
};

export function buildWorld(scene, maps, T) {
  const mats = {
    wall1: L({ map: T.wall1 }), wall2: L({ map: T.wall2 }), brick: L({ map: T.brick }),
    siding: L({ map: T.siding }), window: L({ map: T.window, emissiveMap: T.window, emissive: 0x8a5a20, emissiveIntensity: 0.3 }),
    planks: L({ map: T.planks }), tile: L({ map: T.tile }), stone: L({ map: T.stone }), grass: L({ map: T.grass }), dirt: L({ map: T.dirt }),
    ceil: L({ map: T.ceil }), cceil: L({ map: T.stone, color: 0x6a6a6a }),
    roof: L({ map: T.roof }), roofIn: L({ map: T.roofIn, color: 0x9a8a7a }), attic: L({ map: T.attic }), atticWall: L({ map: T.attic, color: 0xb0a090 }),
    shedIn: L({ map: T.shedWall }), shedOut: L({ map: T.shedWall, color: 0x9a9a9a }),
  };
  const glassMat = new THREE.MeshLambertMaterial({ map: T.glass, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const geo = new Geo(), glassGeo = new Geo(), waterGeo = new Geo();
  const cell = (f, x, z) => (x < 0 || z < 0 || x >= W || z >= H) ? null : maps[f][z][x];
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const inTile = (f, x, z) => TILE_ROOMS.some(([tf, x0, z0, x1, z1]) => tf === f && x >= x0 && x <= x1 && z >= z0 && z <= z1);
  const hatchCell = (x, z) => x === HATCH.x && z === HATCH.z;

  for (let f = 0; f < NFLOORS; f++) {
    const y0 = FLOOR_Y[f];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const ch = maps[f][z][x];
      const x0 = x * CS, x1 = x0 + CS, z0 = z * CS, z1 = z0 + CS;
      if (ch === '#' || ch === 'q') {
        for (const [dx, dz] of DIRS) {
          const n = cell(f, x + dx, z + dz);
          if (n === null || n === '#' || n === 'q') continue;
          const rx = dz, rz = -dx;
          const cx = (x + 0.5) * CS + dx * CS / 2, cz = (z + 0.5) * CS + dz * CS / 2;
          const a = [cx - rx * CS / 2, 0, cz - rz * CS / 2], b = [cx + rx * CS / 2, 0, cz + rz * CS / 2];
          if (ch === 'q') { glassGeo.wall('glass', a, b, y0, y0 + 3, undefined, 3); continue; }
          if (f === 3) {
            if (n === ' ') continue;
            geo.wall('atticWall', a, b, y0, roofY(a[2]) - 0.02, roofY(b[2]) - 0.02, 2); continue;
          }
          let key;
          const nIn = indoor(f, x + dx, z + dz);
          if (f === 0) key = 'brick';
          else if (inR(SHED, x, z)) key = nIn ? 'shedIn' : 'shedOut';
          else if (!nIn) key = ((x * 7 + z * 3 + f) % 3 === 0) ? 'window' : 'siding';
          else key = f === 1 ? 'wall1' : 'wall2';
          const ya = f === 0 ? y0 - 0.7 : y0, yb = y0 + 3;
          geo.wall(key, a, b, ya, yb, undefined, 3);
        }
        continue;
      }
      if (ch === ' ') continue;
      if (ch === 'w') {
        const yw = y0 - 0.45;
        waterGeo.quad('water', [x0, yw, z1], [x1, yw, z1], [x1, yw, z0], [x0, yw, z0]);
        if (z === H - 1 || maps[f][z + 1][x] === '#') for (let k = 1; k < 5; k++) waterGeo.quad('water', [x0, yw, z1 + k * CS], [x1, yw, z1 + k * CS], [x1, yw, z1 + (k - 1) * CS], [x0, yw, z1 + (k - 1) * CS]);
      } else if (ch === 'S') {
        const r = rampAt(x, z);
        if (r.low === f) {
          const steps = 6, key = f === 0 ? 'stone' : 'planks';
          for (let i = 0; i < steps; i++) {
            const t0 = i / steps, t1 = (i + 1) / steps;
            if (r.axis === 'x') {
              const sx0 = x0 + t0 * CS, sx1 = x0 + t1 * CS, sy = rampY(r, sx1, z0), prev = rampY(r, sx0, z0);
              geo.quad(key, [sx0, sy, z1], [sx1, sy, z1], [sx1, sy, z0], [sx0, sy, z0], 0.33, 1);
              geo.quad(key, [sx0, prev, z0], [sx0, prev, z1], [sx0, sy, z1], [sx0, sy, z0], 1, 0.1);
            } else {
              const sz0 = z0 + t0 * CS, sz1 = z0 + t1 * CS, sy = rampY(r, x0, sz0), prev = rampY(r, x0, sz1);
              geo.quad(key, [x0, sy, sz1], [x1, sy, sz1], [x1, sy, sz0], [x0, sy, sz0], 1, 0.33);
              geo.quad(key, [x0, prev, sz1], [x1, prev, sz1], [x1, sy, sz1], [x0, sy, sz1], 1, 0.1);
            }
          }
        }
      } else {
        const yard = f === 1 && YARD.has(ch);
        const key = f === 0 ? 'stone' : f === 3 ? 'attic' : ch === 'p' ? 'dirt' : yard ? 'grass' : inTile(f, x, z) ? 'tile' : 'planks';
        if (f === 3 && hatchCell(x, z)) ringQuads(geo, key, x0, z0, y0, true);
        else geo.quad(key, [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]);
      }
      if (f < 3) {
        const ind = f === 0 || insideHouse(x, z) || (f === 1 && inR(SHED, x, z)) || ch === 'w';
        if (ind) {
          const above = maps[f + 1][z][x];
          const r = ch === 'S' ? rampAt(x, z) : null;
          const skip = above === 'S' || (r && r.low === f);
          if (!skip) {
            const yc = y0 + 3 - 0.01;
            const key = f === 0 ? 'cceil' : (f === 1 && inR(SHED, x, z)) ? 'shedIn' : 'ceil';
            if (f === 2 && hatchCell(x, z)) ringQuads(geo, key, x0, z0, yc, false);
            else geo.quad(key, [x0, yc, z0], [x1, yc, z0], [x1, yc, z1], [x0, yc, z1]);
          }
        }
        if (f === 1 && inR(GREEN, x, z) && ch !== 'q') glassGeo.quad('glass', [x0, 3, z0], [x1, 3, z0], [x1, 3, z1], [x0, 3, z1]);
      }
    }
  }
  // крыша дома: снаружи черепица (нормаль наружу), изнутри — доски
  const rx0 = 2 * CS - 0.6, rx1 = 18 * CS + 0.6;
  if (!HOUSE_GONE) {
  geo.quad('roof', [rx0, RY0, RZ0], [rx0, RY1, RZM], [rx1, RY1, RZM], [rx1, RY0, RZ0], 3, 8);
  geo.quad('roof', [rx1, RY0, RZ1], [rx1, RY1, RZM], [rx0, RY1, RZM], [rx0, RY0, RZ1], 3, 8);
  geo.quad('roofIn', [rx0, RY0 - 0.02, RZ0], [rx1, RY0 - 0.02, RZ0], [rx1, RY1 - 0.02, RZM], [rx0, RY1 - 0.02, RZM], 8, 3);
  geo.quad('roofIn', [rx1, RY0 - 0.02, RZ1], [rx0, RY0 - 0.02, RZ1], [rx0, RY1 - 0.02, RZM], [rx1, RY1 - 0.02, RZM], 8, 3);
  // фронтоны (с обеих сторон)
  for (const gx of [rx0 + 0.6, rx1 - 0.6]) {
    geo.quad('siding', [gx, RY0, RZ1 - 0.6], [gx, RY0, RZ0 + 0.6], [gx, RY1, RZM], [gx, RY1, RZM], 6, 1.2);
    geo.quad('siding', [gx, RY0, RZ0 + 0.6], [gx, RY0, RZ1 - 0.6], [gx, RY1, RZM], [gx, RY1, RZM], 6, 1.2);
  }
  }
  // крыша сарая
  const sx0 = SHED.x0 * CS - 0.3, sx1 = (SHED.x1 + 1) * CS + 0.3, sz0 = SHED.z0 * CS - 0.3, sz1 = (SHED.z1 + 1) * CS + 0.3;
  geo.quad('roof', [sx0, 3.4, sz0], [sx1, 3.4, sz0], [sx1, 3.0, sz1], [sx0, 3.0, sz1], 6, 6);
  geo.quad('roof', [sx0, 3.0, sz1], [sx1, 3.0, sz1], [sx1, 3.4, sz0], [sx0, 3.4, sz0], 6, 6);

  const group = new THREE.Group();
  for (const m of geo.meshes(mats)) group.add(m);
  const water = waterGeo.meshes({ water: L({ map: T.water, emissive: 0x041012, transparent: true, opacity: 0.92 }) })[0];
  group.add(water);
  const glass = glassGeo.meshes({ glass: glassMat })[0]; glass.renderOrder = 2; group.add(glass);
  scene.add(group);
  return { group, water, mats };
}
function ringQuads(geo, key, x0, z0, y, up) {
  const a = 0.4, b = 1.6, X = (v) => x0 + v, Z = (v) => z0 + v;
  for (const [u0, v0, u1, v1] of [[0, 0, 2, a], [0, b, 2, 2], [0, a, a, b], [b, a, 2, b]]) {
    if (up) geo.quad(key, [X(u0), y, Z(v1)], [X(u1), y, Z(v1)], [X(u1), y, Z(v0)], [X(u0), y, Z(v0)], (u1 - u0) / 2, (v1 - v0) / 2);
    else geo.quad(key, [X(u0), y, Z(v0)], [X(u1), y, Z(v0)], [X(u1), y, Z(v1)], [X(u0), y, Z(v1)], (u1 - u0) / 2, (v1 - v0) / 2);
  }
}

// ---------- мебель, декор, коллайдеры ----------
export function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const px = pos.getX(i) + w / 2, py = pos.getY(i) + h / 2, pz = pos.getZ(i) + d / 2;
    if (nx > 0.5) uv.setXY(i, pz / 2, py / 2); else if (ny > 0.5) uv.setXY(i, px / 2, pz / 2); else uv.setXY(i, px / 2, py / 2);
  }
  const me = new THREE.Mesh(g, m); me.position.set(x, y, z); return me;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 10) { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); me.position.set(x, y, z); return me; }
function toAABB(g, lx0, lx1, lz0, lz1) {
  const r = g.rotation.y, c = Math.cos(r), s = Math.sin(r);
  const xs = [], zs = [];
  for (const [lx, lz] of [[lx0, lz0], [lx1, lz0], [lx0, lz1], [lx1, lz1]]) { xs.push(g.position.x + lx * c + lz * s); zs.push(g.position.z - lx * s + lz * c); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
export function localToWorld(g, lx, ly, lz) {
  const r = g.rotation.y, c = Math.cos(r), s = Math.sin(r);
  return new THREE.Vector3(g.position.x + lx * c + lz * s, g.position.y + ly, g.position.z - lx * s + lz * c);
}

export function buildFurniture(scene, maps, T) {
  const wood = L({ map: T.wood }), woodL = L({ map: T.wood, color: 0xc8a888 }), woodD = L({ map: T.wood, color: 0x6a5a4a });
  const dark = L({ color: 0x1a120c }), cloth = L({ map: T.cloth }), linen = L({ color: 0x8e887c });
  const white = L({ color: 0xb8b2a6 }), metal = L({ map: T.metal }), brass = L({ color: 0x9a7a30, emissive: 0x1a1000 });
  const fenceM = L({ map: T.fence }), leaf = L({ color: 0x142212, flatShading: true }), bark = L({ map: T.wood, color: 0x6a5a4a });
  const soil = L({ map: T.dirt, color: 0x6a5a4a }), plant = L({ color: 0x2a4a1a, flatShading: true }), deadPlant = L({ color: 0x4a3a1a, flatShading: true });
  const webM = new THREE.MeshBasicMaterial({ map: T.web, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const bloodM = new THREE.MeshLambertMaterial({ map: T.blood, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const hides = [], colliders = [], surfaces = [], notes = [];
  const root = new THREE.Group(); scene.add(root);
  const isOpen = (c) => c && !'#WBTfY Hq'.includes(c);
  const addCol = (f, g, lx0, lx1, lz0, lz1, h) => { const a = toAABB(g, lx0, lx1, lz0, lz1); colliders.push({ f, ...a, y0: FLOOR_Y[f], y1: FLOOR_Y[f] + h }); return a; };
  const addSurf = (f, g, lx0, lx1, lz0, lz1, top) => { const a = toAABB(g, lx0, lx1, lz0, lz1); surfaces.push({ f, ...a, top: FLOOR_Y[f] + top }); };
  const faceOf = (f, x, z) => {
    const nb = (dx, dz) => (maps[f][z + dz] || [])[x + dx];
    for (const d of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (isOpen(nb(d[0], d[1])) && (nb(-d[0], -d[1]) === '#' || nb(-d[0], -d[1]) === 'q')) return d;
    for (const d of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (isOpen(nb(d[0], d[1]))) return d;
    return [0, 1];
  };
  const placeG = (f, x, z, face) => { const g = new THREE.Group(); g.position.set((x + 0.5) * CS, FLOOR_Y[f], (z + 0.5) * CS); g.rotation.y = Math.atan2(face[0], face[1]); return g; };
  let chest = null, safe = null;

  for (let f = 0; f < NFLOORS; f++) for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = maps[f][z][x];
    const cx = (x + 0.5) * CS, cz = (z + 0.5) * CS, y = FLOOR_Y[f];
    const nb = (dx, dz) => (maps[f][z + dz] || [])[x + dx];
    if (ch === 'T') {
      const type = FURN_TYPE[f + ',' + x + ',' + z] || 'table';
      const g = placeG(f, x, z, faceOf(f, x, z));
      if (type === 'table') {
        g.rotation.y = 0;
        g.add(box(1.7, 0.07, 1.15, wood, 0, 0.8, 0));
        g.add(box(1.55, 0.1, 1.0, woodD, 0, 0.71, 0));
        for (const [lx, lz] of [[-0.72, -0.45], [0.72, -0.45], [-0.72, 0.45], [0.72, 0.45]]) g.add(cyl(0.04, 0.03, 0.76, woodD, lx, 0.38, lz, 8));
        g.add(box(1.1, 0.008, 0.7, L({ color: 0x8a7a68 }), 0, 0.84, 0));
        for (const s of [-1, 1]) { const c2 = new THREE.Group(); c2.position.set(0.3 * s, 0, 0.9 * s); c2.rotation.y = s > 0 ? Math.PI : 0; c2.add(box(0.45, 0.05, 0.45, wood, 0, 0.46, 0)); c2.add(box(0.45, 0.62, 0.04, wood, 0, 0.78, -0.2)); for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) c2.add(box(0.04, 0.46, 0.04, woodD, lx, 0.23, lz)); g.add(c2); }
        addCol(f, g, -0.85, 0.85, -0.58, 0.58, 0.84); addSurf(f, g, -0.8, 0.8, -0.52, 0.52, 0.845);
      } else if (type === 'stove') {
        g.add(box(1.8, 0.9, 0.7, white, 0, 0.45, -0.62)); g.add(box(1.85, 0.05, 0.75, dark, 0, 0.92, -0.62));
        for (const lx of [-0.5, 0.0, 0.5]) { g.add(box(0.36, 0.5, 0.02, L({ color: 0x8a847a }), lx, 0.45, -0.26)); g.add(box(0.1, 0.03, 0.03, brass, lx, 0.62, -0.25)); }
        for (const lx of [-0.55, -0.15]) g.add(cyl(0.12, 0.12, 0.02, dark, lx, 0.955, -0.62, 12));
        g.add(box(1.8, 0.04, 0.32, wood, 0, 1.75, -0.84)); g.add(box(1.8, 0.04, 0.32, wood, 0, 2.15, -0.84));
        for (let i = 0; i < 5; i++) g.add(cyl(0.05, 0.05, 0.16, L({ color: [0x3a5a2a, 0x6a3a1a, 0x8a8a7a][i % 3] }), -0.7 + i * 0.35, 1.85, -0.84, 8));
        addCol(f, g, -0.92, 0.92, -1.0, -0.25, 0.95); addSurf(f, g, -0.85, 0.85, -0.92, -0.32, 0.95);
      } else if (type === 'desk' || type === 'workbench') {
        const top = type === 'workbench' ? woodL : wood;
        g.add(box(1.5, 0.07, 0.75, top, 0, 0.82, -0.6)); g.add(box(0.06, 0.8, 0.7, woodD, -0.7, 0.4, -0.6)); g.add(box(0.06, 0.8, 0.7, woodD, 0.7, 0.4, -0.6));
        g.add(box(1.4, 0.04, 0.6, woodD, 0, 0.25, -0.6));
        if (type === 'workbench') { g.add(box(1.5, 0.9, 0.04, L({ map: T.metal, color: 0x8a8a8a }), 0, 1.45, -0.97)); for (let i = 0; i < 5; i++) g.add(box(0.03, 0.25, 0.02, metal, -0.6 + i * 0.3, 1.5, -0.94)); g.add(cyl(0.08, 0.08, 0.12, L({ color: 0x8a2020 }), 0.55, 0.92, -0.75, 10)); }
        else { g.add(box(0.3, 0.02, 0.2, white, 0.2, 0.86, -0.6)); g.add(cyl(0.03, 0.05, 0.15, brass, -0.4, 0.93, -0.75)); }
        addCol(f, g, -0.76, 0.76, -1.0, -0.22, 0.85); addSurf(f, g, -0.62, 0.62, -0.92, -0.3, 0.855);
      } else if (type === 'shelfunit') {
        g.add(box(1.6, 2.0, 0.04, woodD, 0, 1.0, -0.98));
        for (const lx of [-0.78, 0.78]) g.add(box(0.04, 2.0, 0.45, woodD, lx, 1.0, -0.78));
        for (let k = 0; k < 4; k++) g.add(box(1.56, 0.04, 0.45, woodL, 0, 0.1 + k * 0.6, -0.78));
        for (let i = 0; i < 6; i++) g.add(cyl(0.07, 0.07, 0.18, L({ color: [0x4a5a3a, 0x7a3a1a, 0x5a5a5a][i % 3] }), -0.6 + (i % 3) * 0.6, 0.79 + Math.floor(i / 3) * 0.6, -0.78, 10));
        addCol(f, g, -0.82, 0.82, -1.0, -0.54, 2.0); addSurf(f, g, -0.3, 0.3, -0.96, -0.6, 0.72);
      } else if (type === 'planter') {
        g.add(box(1.7, 0.7, 0.9, woodD, 0, 0.35, -0.5)); g.add(box(1.6, 0.05, 0.8, soil, 0, 0.71, -0.5));
        for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), (i + x) % 3 ? deadPlant : plant); p.position.set(-0.6 + i * 0.25, 0.92, -0.65); p.scale.y = 1.4; g.add(p); }
        addCol(f, g, -0.87, 0.87, -0.96, -0.04, 0.75); addSurf(f, g, 0.05, 0.8, -0.9, -0.1, 0.735);
      } else if (type === 'dresser') {
        g.add(box(1.3, 1.0, 0.55, wood, 0, 0.5, -0.7));
        for (let i = 0; i < 3; i++) { g.add(box(1.2, 0.26, 0.02, woodL, 0, 0.2 + i * 0.3, -0.42)); g.add(box(0.12, 0.03, 0.04, brass, 0, 0.22 + i * 0.3, -0.4)); }
        g.add(box(0.9, 0.9, 0.03, L({ color: 0x4a5656, emissive: 0x081010 }), 0, 1.55, -0.95));
        g.add(box(1.0, 1.0, 0.02, wood, 0, 1.55, -0.965));
        addCol(f, g, -0.67, 0.67, -1.0, -0.4, 1.0); addSurf(f, g, -0.6, 0.6, -0.92, -0.5, 1.0);
      } else if (type === 'tub') {
        const tub = L({ color: 0xc8c2b8 });
        g.add(box(1.8, 0.6, 0.1, tub, 0, 0.3, -0.25)); g.add(box(1.8, 0.6, 0.1, tub, 0, 0.3, -0.95)); g.add(box(0.1, 0.6, 0.8, tub, -0.85, 0.3, -0.6)); g.add(box(0.1, 0.6, 0.8, tub, 0.85, 0.3, -0.6));
        g.add(box(1.6, 0.08, 0.6, tub, 0, 0.12, -0.6)); g.add(box(1.5, 0.02, 0.5, L({ color: 0x2a3a2a, transparent: true, opacity: 0.85 }), 0, 0.4, -0.6));
        addCol(f, g, -0.9, 0.9, -1.0, -0.2, 0.6); addSurf(f, g, -0.7, 0.7, -0.85, -0.35, 0.16);
      } else if (type === 'bench') {
        g.add(box(1.8, 0.08, 0.8, wood, 0, 0.9, -0.58)); for (const lx of [-0.8, 0.8]) for (const lz of [-0.9, -0.25]) g.add(box(0.08, 0.9, 0.08, woodD, lx, 0.45, lz));
        g.add(box(1.7, 0.04, 0.7, woodD, 0, 0.3, -0.58)); g.add(box(0.3, 0.2, 0.2, metal, 0.6, 1.04, -0.75));
        addCol(f, g, -0.92, 0.92, -1.0, -0.16, 0.94); addSurf(f, g, -0.85, 0.4, -0.92, -0.24, 0.94);
      } else if (type === 'crates') {
        g.rotation.y = 0.3;
        g.add(box(0.8, 0.7, 0.8, woodL, -0.35, 0.35, -0.2)); g.add(box(0.7, 0.6, 0.7, woodL, 0.45, 0.3, 0.25)); g.add(box(0.6, 0.5, 0.6, woodL, -0.3, 0.95, -0.2));
        addCol(f, g, -0.8, 0.85, -0.65, 0.65, 1.2); addSurf(f, g, 0.15, 0.75, -0.05, 0.55, 0.6);
      } else if (type === 'trunk') {
        g.add(box(1.2, 0.55, 0.6, woodL, 0, 0.28, -0.6)); g.add(box(1.22, 0.06, 0.62, metal, 0, 0.12, -0.6)); g.add(box(1.22, 0.06, 0.62, metal, 0, 0.45, -0.6));
        addCol(f, g, -0.62, 0.62, -0.92, -0.28, 0.58); addSurf(f, g, -0.55, 0.55, -0.85, -0.35, 0.58);
      } else if (type === 'chest') {
        g.add(box(1.0, 0.45, 0.6, wood, 0, 0.225, -0.6)); g.add(box(1.02, 0.05, 0.62, metal, 0, 0.1, -0.6)); g.add(box(1.02, 0.05, 0.62, metal, 0, 0.35, -0.6));
        const lid = new THREE.Group(); lid.position.set(0, 0.45, -0.9); lid.userData.dyn = true; g.add(lid);
        lid.add(box(1.0, 0.12, 0.6, wood, 0, 0.06, 0.3)); lid.add(box(1.02, 0.03, 0.62, metal, 0, 0.1, 0.3));
        const lock = box(0.12, 0.14, 0.04, brass, 0, 0.38, -0.29); lock.userData.dyn = true; g.add(lock);
        addCol(f, g, -0.52, 0.52, -0.92, -0.28, 0.6);
        chest = { f, group: g, lid, lock, pos: localToWorld(g, 0, 0.5, -0.4), inside: localToWorld(g, 0, 0.12, -0.6), open: false };
      } else if (type === 'safe') {
        const sm = L({ map: T.metal, color: 0x5a6a5a });
        g.add(box(0.9, 1.1, 0.8, sm, 0, 0.55, -0.55));
        g.add(box(0.7, 0.05, 0.6, L({ color: 0x1a1a1a }), 0, 0.3, -0.6));
        const door = new THREE.Group(); door.position.set(-0.43, 0.55, -0.14); door.userData.dyn = true; g.add(door);
        door.add(box(0.84, 1.0, 0.06, L({ map: T.metal, color: 0x6a7a6a }), 0.42, 0, 0));
        const dial = cyl(0.09, 0.09, 0.05, L({ color: 0xb8b0a0 }), 0.42, 0.18, 0.04, 16); dial.rotation.x = Math.PI / 2; door.add(dial);
        door.add(box(0.2, 0.05, 0.05, brass, 0.42, -0.15, 0.05));
        addCol(f, g, -0.47, 0.47, -0.97, -0.13, 1.1); addSurf(f, g, -0.4, 0.4, -0.9, -0.2, 1.1);
        safe = { f, group: g, door, pos: localToWorld(g, 0, 0.7, -0.1), inside: localToWorld(g, 0, 0.33, -0.6), open: false };
      }
      root.add(g);
    } else if (ch === 'W' || ch === 'B') {
      const face = faceOf(f, x, z);
      const g = placeG(f, x, z, face);
      let doors = null;
      const h2 = f === 3 ? 2.0 : 2.3;
      if (ch === 'W') {
        const m = L({ map: T.wood, side: THREE.DoubleSide }), s2 = h2 / 2.3;
        g.add(box(1.5, h2, 0.04, m, 0, h2 / 2, -0.98));
        g.add(box(0.04, h2, 0.8, m, -0.73, h2 / 2, -0.6)); g.add(box(0.04, h2, 0.8, m, 0.73, h2 / 2, -0.6));
        g.add(box(1.5, 0.04, 0.8, m, 0, h2, -0.6)); g.add(box(1.5, 0.04, 0.8, m, 0, 0.04, -0.6));
        g.add(box(1.62, 0.1, 0.9, woodD, 0, h2 + 0.07, -0.58)); g.add(box(1.55, 0.1, 0.85, woodD, 0, 0.05, -0.58));
        const rod = cyl(0.015, 0.015, 1.4, metal, 0, h2 - 0.3, -0.6); rod.rotation.z = Math.PI / 2; g.add(rod);
        for (const [lx, c] of [[-0.45, 0x3a3030], [-0.25, 0x2a3040], [0.3, 0x40302a]]) { const hg = box(0.4, 0.8, 0.03, L({ color: c }), lx, h2 - 0.75, -0.6); hg.rotation.y = 1.2; g.add(hg); }
        doors = [];
        for (const s of [-1, 1]) {
          const piv = new THREE.Group(); piv.position.set(0.74 * s, h2 / 2, -0.2); g.add(piv);
          const leafG = new THREE.Group(); leafG.position.x = -0.355 * s; piv.add(leafG);
          leafG.add(box(0.7, h2 - 0.1, 0.04, m));
          leafG.add(box(0.5, 0.7 * s2, 0.02, woodL, 0, 0.5 * s2, 0.025)); leafG.add(box(0.5, 0.7 * s2, 0.02, woodL, 0, -0.45 * s2, 0.025));
          leafG.add(box(0.03, 0.14, 0.04, brass, -0.3 * s, 0, 0.04));
          piv.userData.s = s; piv.userData.dyn = true; doors.push(piv);
        }
        addCol(f, g, -0.78, 0.78, -1.0, -0.18, h2 + 0.1);
      } else {
        g.add(box(1.4, 0.1, 1.95, woodD, 0, 0.42, 0));
        for (const [lx, lz] of [[-0.66, -0.93], [0.66, -0.93], [-0.66, 0.93], [0.66, 0.93]]) g.add(box(0.08, 0.42, 0.08, woodD, lx, 0.21, lz));
        g.add(box(1.32, 0.18, 1.85, linen, 0, 0.56, 0));
        g.add(box(0.8, 0.14, 0.38, white, 0, 0.72, -0.7));
        g.add(box(1.44, 0.06, 1.3, cloth, 0, 0.68, 0.3));
        g.add(box(0.03, 0.4, 1.3, cloth, -0.72, 0.48, 0.3)); g.add(box(0.03, 0.4, 1.3, cloth, 0.72, 0.48, 0.3));
        g.add(box(1.4, 1.1, 0.08, wood, 0, 0.65, -1.0)); g.add(box(1.4, 0.6, 0.08, wood, 0, 0.4, 0.98));
        for (let i = -2; i <= 2; i++) g.add(cyl(0.025, 0.025, 0.9, woodD, i * 0.25, 0.9, -1.0, 6));
        addCol(f, g, -0.72, 0.72, -1.0, 1.0, 0.75); addSurf(f, g, -0.6, 0.6, -0.4, 0.8, 0.72);
      }
      root.add(g);
      hides.push({ f, x, z, type: ch === 'W' ? 'wardrobe' : 'bed', face, pos: new THREE.Vector3(cx, y, cz), group: g, doors, h2 });
    } else if (ch === 'f' && f === 1) {
      const isF = (c) => c === 'f' || c === 'G';
      const alongX = isF(nb(1, 0)) || isF(nb(-1, 0));
      const alongZ = isF(nb(0, 1)) || isF(nb(0, -1));
      const mk = (wx) => { const g = new THREE.Group(); g.position.set(cx, y, cz); for (let i = 0; i < 9; i++) { const t = -0.9 + i * 0.225; const hh = 1.6 + ((x * 7 + z * 3 + i) % 4) * 0.1; const p = box(wx ? 0.18 : 0.05, hh, wx ? 0.05 : 0.18, fenceM, wx ? t : 0, hh / 2, wx ? 0 : t); p.rotation.z = ((i * 13 + x) % 5 - 2) * 0.02; g.add(p); } g.add(box(wx ? 2 : 0.07, 0.09, wx ? 0.07 : 2, woodD, wx ? 0 : -0.06, 0.5, wx ? -0.06 : 0)); g.add(box(wx ? 2 : 0.07, 0.09, wx ? 0.07 : 2, woodD, wx ? 0 : -0.06, 1.3, wx ? -0.06 : 0)); return g; };
      if (alongX) root.add(mk(true)); if (alongZ) root.add(mk(false));
    } else if (ch === 'Y') {
      const g = new THREE.Group(); g.position.set(cx, y, cz); g.rotation.y = x * 1.7 + z;
      const trunk = cyl(0.16, 0.3, 4.4, bark, 0, 2.2, 0, 8); trunk.rotation.z = 0.05; g.add(trunk);
      for (let i = 0; i < 7; i++) { const len = 1.2 + (i % 3) * 0.5; const b = cyl(0.03, 0.08, len, bark, 0, len / 2, 0, 5); const p = new THREE.Group(); p.position.y = 2.2 + i * 0.35; p.rotation.set(0, i * 0.9, 0.7 + (i % 2) * 0.3); p.add(b); g.add(p); }
      if ((x + z) % 3 !== 0) for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 + (i % 2) * 0.3, 0), leaf); c.position.set(Math.sin(i * 2 + x) * 0.8, 4.3 + i * 0.5, Math.cos(i * 2 + z) * 0.8); c.scale.y = 0.7; g.add(c); }
      root.add(g);
      colliders.push({ f, x0: cx - 0.33, x1: cx + 0.33, z0: cz - 0.33, z1: cz + 0.33, y0: y, y1: y + 5 });
    } else if (ch === 'o' && f === 1) {
      const g = new THREE.Group(); g.position.set(cx, y, cz);
      const stoneM = L({ map: T.stone, color: 0x8a8a8a });
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const b = box(0.45, 0.8, 0.25, stoneM, Math.cos(a) * 0.7, 0.4, Math.sin(a) * 0.7); b.rotation.y = -a + Math.PI / 2; g.add(b); }
      g.add(cyl(0.6, 0.6, 0.02, L({ color: 0x050808 }), 0, 0.5, 0, 16));
      for (const s of [-1, 1]) g.add(box(0.1, 1.8, 0.1, woodD, s * 0.75, 0.9, 0));
      g.add(box(1.7, 0.1, 0.1, woodD, 0, 1.8, 0)); g.add(cyl(0.12, 0.1, 0.25, woodD, 0, 1.55, 0, 8));
      root.add(g); colliders.push({ f, x0: cx - 0.9, x1: cx + 0.9, z0: cz - 0.9, z1: cz + 0.9, y0: y, y1: y + 1 });
      surfaces.push({ f, x0: cx - 0.85, x1: cx + 0.85, z0: cz - 0.85, z1: cz + 0.85, top: y + 0.8 });
    } else if (ch === 'r' && f === 1) {
      root.add(box(0.08, 0.12, CS, metal, cx - 0.5, y + 0.06, cz)); root.add(box(0.08, 0.12, CS, metal, cx + 0.5, y + 0.06, cz));
      for (const o of [-0.6, 0, 0.6]) root.add(box(1.4, 0.07, 0.22, woodD, cx, y + 0.035, cz + o));
    }
  }
  // балкон
  for (let x = 8; x <= 10; x++) root.add(box(CS, 0.1, 0.1, wood, (x + 0.5) * CS, 4.0, 2 * CS + 0.05));
  root.add(box(0.1, 0.1, CS, wood, 8 * CS + 0.05, 4.0, 2.5 * CS)); root.add(box(0.1, 0.1, CS, wood, 11 * CS - 0.05, 4.0, 2.5 * CS));
  for (let i = 0; i <= 12; i++) root.add(box(0.05, 1.0, 0.05, woodD, 8 * CS + i * 0.5, 3.5, 2 * CS + 0.05));
  root.add(box(3 * CS, 0.2, CS, wood, 9.5 * CS, 2.78, 2.5 * CS));   // низ балкона (ниже пола, чтобы не мерцал)
  for (const px of [8.1, 10.9]) root.add(cyl(0.1, 0.1, 2.9, wood, px * CS, 1.45, 2.1 * CS, 8));
  root.add(box(3.2, 0.15, 1.2, wood, 9.5 * CS, 0.07, 3 * CS - 0.6));
  root.add(cyl(0.05, 0.07, 2.6, metal, 12 * CS, 1.3, 2.2 * CS, 8));
  colliders.push({ f: 1, x0: 12 * CS - 0.15, x1: 12 * CS + 0.15, z0: 2.2 * CS - 0.15, z1: 2.2 * CS + 0.15, y0: 0, y1: 2.6 });
  // кресло сторожа
  const chair = new THREE.Group(); chair.position.set(5.5 * CS, 0, 12.5 * CS);
  chair.add(box(0.85, 0.15, 0.8, cloth, 0, 0.48, 0)); chair.add(box(0.85, 1.1, 0.14, cloth, 0, 1.0, 0.38));
  chair.add(box(0.14, 0.32, 0.8, wood, -0.43, 0.68, 0)); chair.add(box(0.14, 0.32, 0.8, wood, 0.43, 0.68, 0));
  for (const [lx, lz] of [[-0.38, -0.33], [0.38, -0.33], [-0.38, 0.33], [0.38, 0.33]]) chair.add(box(0.06, 0.4, 0.06, woodD, lx, 0.2, lz));
  root.add(chair);
  colliders.push({ f: 1, x0: 5.5 * CS - 0.45, x1: 5.5 * CS + 0.45, z0: 12.5 * CS - 0.4, z1: 12.5 * CS + 0.45, y0: 0, y1: 0.6 });
  const wallMount = (f, x, z, side, hgt) => {
    const SD = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }, wallAt = (sd) => { const c = (maps[f][z + SD[sd][1]] || [])[x + SD[sd][0]]; return c === '#'; };
    if (!wallAt(side)) side = ['n', 's', 'e', 'w'].find(wallAt) || side;
    let px = (x + 0.5) * CS, pz = (z + 0.5) * CS, ry = 0;
    if (side === 'n') pz = z * CS + 0.025; else if (side === 's') { pz = (z + 1) * CS - 0.025; ry = Math.PI; }
    else if (side === 'e') { px = (x + 1) * CS - 0.025; ry = -Math.PI / 2; } else { px = x * CS + 0.025; ry = Math.PI / 2; }
    return { pos: new THREE.Vector3(px, FLOOR_Y[f] + hgt, pz), ry };
  };
  // картины и записки вешаются в самом конце, когда вся мебель уже стоит (см. hangAll)
  const PAINT_REQ = [[1, 3, 8, 'n'], [1, 12, 9, 's'], [2, 8, 9, 's'], [2, 16, 5, 'e'], [1, 10, 4, 'n'], [2, 3, 12, 'w'], [1, 13, 4, 'n'], [2, 13, 8, 'n']];
  // портрет Тома Перла — на чердаке, на торцевой стене
  const tomM = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.53), L({ map: T.tomPearl }));
  const tp = wallMount(3, 3, 9, 'w', 1.45); tomM.position.copy(tp.pos); tomM.rotation.y = tp.ry; root.add(tomM);
  const tom = { f: 3, pos: tp.pos.clone() };
  // места для записок с кодом
  const NOTE_REQ = [[1, 16, 5, 'e'], [2, 3, 5, 'w'], [0, 12, 3, 'n'], [1, 23, 5, 'w'], [2, 16, 12, 'e'], [1, 3, 12, 'w'], [3, 15, 11, 's'], [2, 8, 4, 'n'], [1, 26, 8, 'e'], [0, 15, 15, 'e']];
  [[1, 9, 5], [1, 14, 5.2], [2, 4, 5], [2, 9, 8.5], [1, 6, 8.5]].forEach(([f, x, z]) => { const r = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.5), new THREE.MeshLambertMaterial({ map: T.rug, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); r.rotation.x = -Math.PI / 2; r.position.set((x + 0.5) * CS, FLOOR_Y[f] + 0.012, (z + 0.5) * CS); root.add(r); });
  const books = [0x5a1a1a, 0x1a3a1a, 0x2a2a4a, 0x5a4a1a, 0x3a1a3a];
  const shelf = (f, x, z, side) => {
    const g = new THREE.Group(); g.position.set((x + 0.5) * CS, FLOOR_Y[f], (z + 0.5) * CS);
    g.rotation.y = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 }[side];
    g.add(box(1.4, 2.0, 0.04, wood, 0, 1.0, -0.98)); g.add(box(0.05, 2.0, 0.38, wood, -0.68, 1.0, -0.8)); g.add(box(0.05, 2.0, 0.38, wood, 0.68, 1.0, -0.8));
    for (let k = 0; k < 4; k++) {
      g.add(box(1.36, 0.04, 0.38, wood, 0, 0.1 + k * 0.5, -0.8));
      let bx = -0.62, i = 0; while (bx < 0.6) { const bw = 0.05 + (i * 7 % 4) * 0.015; const bh = 0.3 + (i * 5 % 5) * 0.03; g.add(box(bw, bh, 0.25, L({ color: books[(i + k) % 5] }), bx + bw / 2, 0.12 + k * 0.5 + bh / 2, -0.82)); bx += bw + 0.01; i++; }
    }
    root.add(g); const a = toAABB(g, -0.72, 0.72, -1.0, -0.6); colliders.push({ f, ...a, y0: FLOOR_Y[f], y1: FLOOR_Y[f] + 2 });
  };
  shelf(1, 11, 8, 'n'); shelf(2, 11, 8, 'n'); shelf(1, 4, 11, 'n');
  const clock = (f, x, z) => { const g = new THREE.Group(); g.position.set((x + 0.5) * CS, FLOOR_Y[f], z * CS + 0.25); g.add(box(0.5, 2.0, 0.35, wood, 0, 1.0, 0)); const face = cyl(0.18, 0.18, 0.03, white, 0, 1.6, 0.18, 16); face.rotation.x = Math.PI / 2; g.add(face); g.add(box(0.02, 0.12, 0.01, dark, 0, 1.64, 0.2)); const pend = new THREE.Group(); pend.userData.dyn = true; pend.position.set(0, 1.25, 0.18); pend.add(box(0.02, 0.5, 0.01, brass, 0, -0.25, 0)); const bob = cyl(0.07, 0.07, 0.02, brass, 0, -0.5, 0, 12); bob.rotation.x = Math.PI / 2; pend.add(bob); g.add(pend); root.add(g); colliders.push({ f, x0: g.position.x - 0.28, x1: g.position.x + 0.28, z0: g.position.z - 0.2, z1: g.position.z + 0.2, y0: FLOOR_Y[f], y1: FLOOR_Y[f] + 2 }); return pend; };
  const pendulums = [clock(1, 15, 8)];
  const web = (f, x, z, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), webM); m.position.set(x, FLOOR_Y[f] + 2.45, z); m.rotation.y = rot; root.add(m); };
  web(1, 3 * CS + 0.5, 4 * CS + 0.04, 0); web(2, 3 * CS + 0.5, 11 * CS + 0.04, 0); web(0, 8 * CS + 0.5, 3 * CS + 0.04, 0); web(0, 15 * CS + 0.5, 3 * CS + 0.04, 0);
  web(1, 23 * CS + 0.5, 4 * CS + 0.04, 0);
  const decal = (f, x, z, s, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), bloodM); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, FLOOR_Y[f] + 0.015, z); root.add(m); };
  decal(1, 9.6 * CS, 9 * CS, 1.2, 0.4); decal(2, 4.5 * CS, 12.6 * CS, 1.0, 1.3); decal(0, 11.5 * CS, 10 * CS, 1.4, 2); decal(0, 16.5 * CS, 4.5 * CS, 1.0, 0.2); decal(3, 12 * CS, 9.5 * CS, 1.1, 0.8);
  const wr = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshLambertMaterial({ map: T.writing, transparent: true, depthWrite: false })); wr.position.set(19 * CS - 0.03, -3 + 1.7, 4.5 * CS); wr.rotation.y = -Math.PI / 2; root.add(wr);
  root.add(cyl(0.7, 0.7, 2.2, metal, 10.5 * CS, -3 + 1.1, 3.4 * CS, 14));
  colliders.push({ f: 0, x0: 10.5 * CS - 0.75, x1: 10.5 * CS + 0.75, z0: 3.4 * CS - 0.75, z1: 3.4 * CS + 0.75, y0: -3, y1: -0.8 });
  root.add(box(0.3, 0.3, 0.1, new THREE.MeshBasicMaterial({ color: 0xff5a10 }), 10.5 * CS, -3 + 0.6, 3.4 * CS + 0.7));
  root.add(cyl(0.12, 0.12, 1.0, metal, 10.5 * CS, -0.5, 3.4 * CS, 8));
  for (let x = 5; x < 15; x++) { const p = cyl(0.07, 0.07, CS, metal, (x + 0.5) * CS, -0.35, 15.15 * CS, 6); p.rotation.z = Math.PI / 2; root.add(p); }
  for (let z = 6; z < 15; z++) { const p = cyl(0.05, 0.05, CS, metal, 11.15 * CS, -0.3, (z + 0.5) * CS, 6); p.rotation.x = Math.PI / 2; root.add(p); }
  [[0, 5, 10, 0.2], [0, 8, 9.3, 0.6], [0, 13, 5.3, 1], [0, 4.5, 8.3, 0.1]].forEach(([f, x, z, r]) => {
    const b = box(0.8, 0.7, 0.8, L({ map: T.wood, color: 0xb0a080 }), x * CS + 0.5, FLOOR_Y[f] + 0.35, z * CS + 0.5); b.rotation.y = r; root.add(b);
    colliders.push({ f, x0: b.position.x - 0.5, x1: b.position.x + 0.5, z0: b.position.z - 0.5, z1: b.position.z + 0.5, y0: FLOOR_Y[f], y1: FLOOR_Y[f] + 0.7 });
    surfaces.push({ f, x0: b.position.x - 0.3, x1: b.position.x + 0.3, z0: b.position.z - 0.3, z1: b.position.z + 0.3, top: FLOOR_Y[f] + 0.7 });
  });
  for (let z = 11; z <= 16; z++) root.add(box(0.95, 0.1, CS, wood, 3.55 * CS, -3 + 0.02, (z + 0.5) * CS));
  // чердак: балки, манекен, кресло-качалка
  for (let x = 3; x <= 16; x += 2) root.add(box(0.15, 0.15, 12, woodD, x * CS, roofY(18) - 0.2, 18));
  const man = new THREE.Group(); man.position.set(7 * CS, 6, 10.4 * CS);
  man.add(cyl(0.02, 0.15, 1.0, woodD, 0, 0.5, 0, 8));
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), L({ color: 0xc8b8a0 })); torso.position.y = 1.25; torso.scale.set(1, 1.3, 0.7); man.add(torso);
  man.add(cyl(0.08, 0.06, 0.25, L({ color: 0xc8b8a0 }), 0, 1.65, 0, 8)); root.add(man);
  colliders.push({ f: 3, x0: man.position.x - 0.35, x1: man.position.x + 0.35, z0: man.position.z - 0.35, z1: man.position.z + 0.35, y0: 6, y1: 8 });
  const rock = new THREE.Group(); rock.position.set(12 * CS, 6, 7.6 * CS); rock.rotation.y = 0.6; rock.userData.dyn = true;
  rock.add(box(0.6, 0.06, 0.55, wood, 0, 0.45, 0)); rock.add(box(0.6, 0.8, 0.06, wood, 0, 0.85, -0.26));
  for (const s of [-1, 1]) { rock.add(box(0.04, 0.04, 1.0, woodD, 0.28 * s, 0.02, 0)); rock.add(box(0.04, 0.45, 0.04, woodD, 0.28 * s, 0.22, 0.2)); rock.add(box(0.04, 0.45, 0.04, woodD, 0.28 * s, 0.22, -0.2)); }
  root.add(rock);
  colliders.push({ f: 3, x0: rock.position.x - 0.4, x1: rock.position.x + 0.4, z0: rock.position.z - 0.4, z1: rock.position.z + 0.4, y0: 6, y1: 7 });
  for (let i = 0; i < 4; i++) root.add(cyl(0.12, 0.09, 0.2, L({ color: 0x8a4a2a }), (24 + i * 0.8) * CS, 0.1, 17.6 * CS, 10));
  // тайный стеллаж
  const sec = new THREE.Group(); sec.position.set(14.5 * CS, -3, 4.5 * CS); sec.userData.dyn = true; root.add(sec);
  const sh = new THREE.Group(); sec.add(sh);
  sh.add(box(0.5, 2.9, 1.96, wood, 0, 1.45, 0));
  for (let k = 0; k < 5; k++) { sh.add(box(0.42, 0.04, 1.9, woodL, -0.06, 0.2 + k * 0.6, 0)); for (let j = 0; j < 4; j++) sh.add(cyl(0.06, 0.06, 0.2, L({ color: [0x3a5a2a, 0x5a3a1a, 0x2a2a3a, 0x6a6a5a][(j + k) % 4] }), -0.12, 0.32 + k * 0.6, -0.7 + j * 0.45, 8)); }
  const socket = new THREE.Group(); socket.position.set(14 * CS - 0.03, -3 + 1.4, 3.6 * CS); socket.userData.dyn = true; root.add(socket);
  socket.add(box(0.06, 0.5, 0.5, metal)); const sk = cyl(0.12, 0.12, 0.08, dark, 0.02, 0, 0, 12); sk.rotation.z = Math.PI / 2; socket.add(sk);
  const secret = { shelf: sh, socket, pos: new THREE.Vector3(14 * CS - 0.1, -3 + 1.2, 4.5 * CS), open: false, t: 0 };
  const rack = new THREE.Group(); rack.position.set(19 * CS - 0.1, -3, 3.5 * CS); rack.rotation.y = -Math.PI / 2; root.add(rack);
  rack.add(box(1.6, 1.4, 0.06, wood, 0, 1.3, 0)); rack.add(box(1.6, 0.06, 0.25, wood, 0, 0.9, 0.12)); rack.add(box(1.6, 0.06, 0.25, wood, 0, 1.5, 0.12));
  // люк на чердак
  const hatch = { f: 2, x: HATCH.x, z: HATCH.z, open: false, t: 0 };
  const hx = (HATCH.x + 0.5) * CS, hz = (HATCH.z + 0.5) * CS;
  for (const [w2, d2, ox, oz] of [[1.3, 0.08, 0, -0.61], [1.3, 0.08, 0, 0.61], [0.08, 1.3, -0.61, 0], [0.08, 1.3, 0.61, 0]]) { root.add(box(w2, 0.06, d2, woodD, hx + ox, 5.96, hz + oz)); root.add(box(w2, 0.04, d2, woodD, hx + ox, 6.02, hz + oz)); }
  const hp = new THREE.Group(); hp.position.set(hx - 0.6, 5.97, hz); hp.userData.dyn = true; root.add(hp);
  hp.add(box(1.2, 0.05, 1.2, wood, 0.6, 0, 0)); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10), metal); ring.position.set(1.05, -0.04, 0); ring.rotation.x = Math.PI / 2; hp.add(ring);
  const ladder = new THREE.Group(); ladder.position.set(hx, 3, hz + 0.45); ladder.rotation.x = -0.2; ladder.userData.dyn = true; ladder.visible = false; root.add(ladder);
  for (const s of [-1, 1]) ladder.add(box(0.06, 3.1, 0.06, woodL, 0.3 * s, 1.55, 0));
  for (let i = 0; i < 9; i++) ladder.add(box(0.6, 0.04, 0.06, woodL, 0, 0.2 + i * 0.33, 0));
  hatch.panel = hp; hatch.ladder = ladder;
  hatch.below = new THREE.Vector3(hx, 3, hz - 0.5); hatch.above = new THREE.Vector3(hx, 6, hz + 1.2);
  // свечи
  const candle = L({ color: 0xe8e0c8, emissive: 0x302010 }), flameM = new THREE.MeshBasicMaterial({ color: 0xffb040 });
  const flames = [];
  [[0, 16.2, 3.3], [0, 18.4, 5.6], [2, 3.4, 6.6], [3, 4.0, 9.2]].forEach(([f, x, z]) => { const yy = FLOOR_Y[f] + (f === 2 ? 1.0 : 0.0); root.add(cyl(0.03, 0.03, 0.2, candle, x * CS, yy + 0.1, z * CS, 6)); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 5), flameM); fl.position.set(x * CS, yy + 0.24, z * CS); fl.userData.dyn = true; root.add(fl); flames.push(fl); });
  bakeStatic(root);
  // ---- вешаем картины и записки: только на настоящую стену, не за мебелью и не друг на друга ----
  const hung = [{ f: tom.f, pos: tom.pos }];
  const SDIR = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  const tryMount = (f, x, z, side, hgt, half) => {
    const c = (maps[f][z] || [])[x];
    if (c == null || !'.cgp'.includes(c)) return null;
    const nb = (maps[f][z + SDIR[side][1]] || [])[x + SDIR[side][0]];
    if (nb !== '#') return null;
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (maps[f][z + az] || [])[x + ax]; if (q === 'D' || q === 'L') return null; }   // открытая дверь закрыла бы
    const { pos, ry } = wallMount(f, x, z, side, hgt);
    // мебель у стены закрывает место?
    const y0 = pos.y - half - 0.1, y1 = pos.y + half + 0.1, nx = Math.sin(ry), nz = Math.cos(ry);
    const px = pos.x + nx * 0.3, pz = pos.z + nz * 0.3;
    for (const k of colliders) { if (k.f !== f) continue; const ky0 = k.y0 !== undefined ? k.y0 : FLOOR_Y[f], ky1 = k.y1 !== undefined ? k.y1 : FLOOR_Y[f] + 3; if (ky1 < y0 || ky0 > y1) continue; if (px > k.x0 - 0.45 && px < k.x1 + 0.45 && pz > k.z0 - 0.45 && pz < k.z1 + 0.45) return null; }
    for (const h of hides) { if (h.f !== f) continue; if (Math.hypot(h.pos.x - pos.x, h.pos.z - pos.z) < 1.3) return null; }
    for (const o of hung) if (o.f === f && o.pos.distanceTo(pos) < 1.25) return null;
    return { f, pos, ry };
  };
  const findMount = (f, x, z, side, hgt, half) => {
    const sides = [side, 'n', 's', 'e', 'w'];
    for (let r = 0; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      for (const sd of sides) { const m = tryMount(f, x + dx, z + dz, sd, hgt, half); if (m) { hung.push(m); return m; } }
    }
    return null;
  };
  PAINT_REQ.forEach(([f, x, z, side], i) => {
    const mt = findMount(f, x, z, side, 1.75, 0.5); if (!mt) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), L({ map: T.paintings[i % 6] }));
    m.position.copy(mt.pos); m.rotation.y = mt.ry; m.rotation.z = ((i * 7) % 5 - 2) * 0.03; root.add(m);
  });
  NOTE_REQ.forEach(([f, x, z, side]) => { const mt = findMount(f, x, z, side, 1.35, 0.25); if (mt) notes.push(mt); });
  return { root, hides, colliders, surfaces, secret, chest, safe, hatch, notes, pendulums, flames, tom };
}

// Лампы: в сцене всего несколько источников света, они «переезжают» к ближайшим лампам.
export function lampDefs() {
  return [
    { f: 1, x: 4, z: 5, col: 0xffb060, i: 9, d: 11, flick: false },
    { f: 1, x: 9, z: 8, col: 0xffc070, i: 8, d: 14, flick: true },
    { f: 1, x: 14, z: 5, col: 0xffa050, i: 7, d: 10, flick: true },
    { f: 1, x: 5, z: 12, col: 0xffa860, i: 6, d: 10, flick: false },
    { f: 2, x: 12, z: 8, col: 0xff9a60, i: 7, d: 14, flick: false },
    { f: 2, x: 4, z: 5, col: 0xffb080, i: 6, d: 10, flick: true },
    { f: 2, x: 14, z: 12, col: 0xffb080, i: 5, d: 9, flick: false },
    { f: 2, x: 5, z: 11, col: 0xffb070, i: 5, d: 9, flick: false },
    { f: 1, x: 25, z: 15, col: 0xc0e0b0, i: 4, d: 8, flick: false },
    { f: 0, x: 10, z: 4, col: 0xff6a20, i: 10, d: 12, flick: true },
    { f: 0, x: 6, z: 14, col: 0x60a0a0, i: 5, d: 10, flick: false },
    { f: 0, x: 17, z: 4, col: 0xff8a30, i: 5, d: 7, flick: true },
    { f: 0, x: 11, z: 11, col: 0xffa040, i: 5, d: 9, flick: true },
    { f: 3, x: 9, z: 9, col: 0xffc080, i: 6, d: 11, flick: true },
    { f: 3, x: 14, z: 9, col: 0xffb070, i: 5, d: 9, flick: false },
    { f: 1, x: 24, z: 5, col: 0xffd090, i: 6, d: 8, flick: true },
    { f: 1, x: 12, z: 2, col: 0xffd8a0, i: 7, d: 12, flick: false, out: true },
  ];
}
export function buildLampMeshes(scene, defs) {
  const onMat = new THREE.MeshBasicMaterial({ color: 0xffd890 });
  const offMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const shadeM = L({ color: 0x6a3a1a, side: THREE.DoubleSide, emissive: 0x2a1000 });
  for (const d of defs) {
    const y = FLOOR_Y[d.f] + (d.f === 3 ? 2.4 : 2.45);
    d.pos = d.out ? new THREE.Vector3(12 * CS, 2.7, 2.2 * CS) : new THREE.Vector3((d.x + 0.5) * CS, y, (d.z + 0.5) * CS);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), onMat); b.position.copy(d.pos); scene.add(b);
    if (!d.out) {
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 12, 1, true), shadeM); sh.position.copy(d.pos); sh.position.y += 0.08; scene.add(sh);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5), onMat); w.position.copy(d.pos); w.position.y += 0.33; scene.add(w);
    } else { const cage = box(0.22, 0.3, 0.22, L({ color: 0x1a1a1a, transparent: true, opacity: 0.6 }), d.pos.x, d.pos.y, d.pos.z); scene.add(cage); }
    d.bulb = b; d.onMat = onMat; d.offMat = offMat; d.meshes = [b, ...scene.children.slice(-2).filter(m => m !== b)];
  }
}

export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map(), victims = [];
  const walk = (o) => {
    if (o.userData && o.userData.dyn) return;
    if (o.isMesh && !Array.isArray(o.material)) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(o.matrixWorld);
      const k = o.material.uuid;
      if (!groups.has(k)) groups.set(k, { mat: o.material, geos: [] });
      groups.get(k).geos.push(g); victims.push(o);
    }
    for (const c of o.children) walk(c);
  };
  for (const c of root.children) walk(c);
  for (const v of victims) v.parent.remove(v);
  const baked = new THREE.Group(); baked.name = 'baked';
  for (const { mat: m, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    baked.add(new THREE.Mesh(merged, m));
  }
  root.parent.add(baked);
}
