// ================= ГЛАВА 2 · КВАРТИРА =================
// Ночь, ливень. Заставка: фургон едет по городу (раскладка камеры — по присланному ролику), под железнодорожным мостом с красной аркой,
// и останавливается у панельной девятиэтажки. Дальше от первого лица: забрать ключ из почтового ящика, подняться на 9 этаж,
// открыть квартиру 27 и включить свет (свет дают только из щитка на лестнице).
// Графика здесь своя: PBR-материалы, мокрый асфальт с лужами и отражениями, свечение (bloom), тени от фар и фонаря.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeKid } from './models.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const addTo = (parent, m) => { parent.add(m); return m; };
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function canvasTex(w, h, draw, seed = 1, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h, rng(seed));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noiseFill(g, w, h, R, a, n = 2000, s = 3) { for (let i = 0; i < n; i++) { const v = R() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${R() * a})`; g.fillRect(R() * w, R() * h, R() * s + 1, R() * s + 1); } }

export function createCh2(ctx) {
  const { renderer, T, P, joy, keys, sfx, sfx2, rain, playTrack, trackVol, stopTracks, toast, showFade, hideFade, $, quality, Net, say } = ctx;
  const HIGH = quality === 'high', LOW = quality === 'low';
  const S = { on: false, built: false, mode: 'off', t: 0, cutT: 0, paused: false };
  let scene, cam, composer, bloom;

  // ============ материалы ============
  const M = {};
  function makeMaterials() {
    const asphaltC = canvasTex(512, 512, (g, w, h, R) => {
      g.fillStyle = '#1d1e21'; g.fillRect(0, 0, w, h); noiseFill(g, w, h, R, 0.18, 9000, 2);
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(40,42,46,0.6)'; g.beginPath(); g.ellipse(R() * w, R() * h, 30 + R() * 50, 15 + R() * 30, R() * 3, 0, 7); g.fill(); }
    }, 11);
    // карта шероховатости: тёмные пятна — лужи (почти зеркало)
    const asphaltR = canvasTex(512, 512, (g, w, h, R) => {
      g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, w, h); noiseFill(g, w, h, R, 0.25, 6000, 3);
      for (let i = 0; i < 9; i++) { const x = R() * w, y = R() * h, r = 25 + R() * 70; const gr = g.createRadialGradient(x, y, r * 0.3, x, y, r); gr.addColorStop(0, 'rgba(10,10,10,1)'); gr.addColorStop(1, 'rgba(10,10,10,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 1.6, r, R() * 3, 0, 7); g.fill(); }
    }, 12, false);
    asphaltC.repeat.set(1, 1); asphaltR.repeat.set(1, 1);
    M.road = new THREE.MeshStandardMaterial({ map: asphaltC, roughnessMap: asphaltR, roughness: 1, metalness: 0, envMapIntensity: 1.2 });
    const tiles = canvasTex(256, 256, (g, w, h, R) => {
      g.fillStyle = '#2a2a2c'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 70 + R() * 25; g.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
      noiseFill(g, w, h, R, 0.2, 2500, 2);
    }, 13);
    M.walk = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35, metalness: 0, envMapIntensity: 1 });
    M.curb = new THREE.MeshStandardMaterial({ color: 0x6a6a68, roughness: 0.5 });
    M.line = new THREE.MeshStandardMaterial({ color: 0xc8c0a0, roughness: 0.4 });
    M.concrete = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h, R) => { g.fillStyle = '#6a6862'; g.fillRect(0, 0, w, h); noiseFill(g, w, h, R, 0.22, 5000, 3); for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(30,25,20,0.25)'; g.fillRect(R() * w, 0, 3 + R() * 10, h); } }, 14), roughness: 0.75 });
    M.brick = new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (g, w, h, R) => {
      g.fillStyle = '#2a1a14'; g.fillRect(0, 0, w, h);
      for (let y = 0, r = 0; y < h; y += 32, r++) for (let x = -(r % 2) * 32; x < w; x += 64) { const v = 0.7 + R() * 0.35; g.fillStyle = `rgb(${120 * v | 0},${52 * v | 0},${34 * v | 0})`; g.fillRect(x + 2, y + 2, 60, 28); }
      noiseFill(g, w, h, R, 0.2, 4000, 2);
    }, 15), roughness: 0.6, envMapIntensity: 0.8 });
    M.metal = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.45, metalness: 0.8 });
    M.dark = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 });
    M.black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    M.sodium = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa040, emissiveIntensity: 6 });
    M.redLed = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff1010, emissiveIntensity: 7 });
    M.bulb = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe0b0, emissiveIntensity: 5 });
    M.bulbOff = new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.3 });
    M.glassDark = new THREE.MeshPhysicalMaterial({ color: 0x05080c, roughness: 0.05, metalness: 0, clearcoat: 1, envMapIntensity: 1.5 });
    // фасад панельки: 8 окон × 6 этажей на одну текстуру, часть окон горит
    const FW = 1024, FH = 1536, cw = FW / 8, ch = FH / 6;
    const R0 = rng(77); const lit = []; for (let i = 0; i < 48; i++) lit.push(R0() < 0.24 ? (R0() < 0.75 ? 1 : 2) : 0);
    M.facadeMap = canvasTex(FW, FH, (g, w, h, R) => {
      g.fillStyle = '#8a8680'; g.fillRect(0, 0, w, h); noiseFill(g, w, h, R, 0.12, 30000, 3);
      for (let i = 0; i < 40; i++) { const x = R() * w; const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(40,36,30,0)'); gr.addColorStop(1, 'rgba(40,36,30,0.35)'); g.fillStyle = gr; g.fillRect(x, R() * h, 4 + R() * 12, 200 + R() * 400); }
      for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
        const x = c * cw, y = r * ch;
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, cw, 3); g.fillRect(x, y, 3, ch);   // швы панелей
        const balcony = (c % 4 === 1);
        g.fillStyle = '#d8d4cc'; g.fillRect(x + 26, y + 50, 76, 120); g.fillStyle = '#0c1016'; g.fillRect(x + 31, y + 55, 66, 110);
        g.fillStyle = '#d8d4cc'; g.fillRect(x + 62, y + 55, 4, 110); g.fillRect(x + 31, y + 95, 66, 4);
        if (balcony) { g.fillStyle = '#6a6660'; g.fillRect(x + 8, y + 160, 112, 80); g.fillStyle = 'rgba(0,0,0,0.4)'; for (let k = 0; k < 9; k++) g.fillRect(x + 12 + k * 12, y + 160, 3, 80); }
      }
    }, 31);
    M.facadeEm = canvasTex(FW, FH, (g, w, h, R) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
        const L = lit[r * 8 + c]; if (!L) continue;
        const x = c * cw, y = r * ch;
        const gr = g.createLinearGradient(0, y + 55, 0, y + 165); if (L === 1) { gr.addColorStop(0, '#ffd8a0'); gr.addColorStop(1, '#c87a30'); } else { gr.addColorStop(0, '#9ab8ff'); gr.addColorStop(1, '#3050a0'); }
        g.fillStyle = gr; g.fillRect(x + 31, y + 55, 66, 110);
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x + 31, y + 55, 14 + R() * 20, 110); g.fillRect(x + 97 - 10 - R() * 20, y + 55, 30, 110);   // шторы
        g.fillStyle = '#000'; g.fillRect(x + 62, y + 55, 4, 110); g.fillRect(x + 31, y + 95, 66, 4);
      }
    }, 32);
    M.facade = new THREE.MeshStandardMaterial({ map: M.facadeMap, emissiveMap: M.facadeEm, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.7, metalness: 0, envMapIntensity: 0.6 });
    // подъезд: снизу масляная краска, сверху побелка
    M.podWall = new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (g, w, h, R) => {
      g.fillStyle = '#c9c6b8'; g.fillRect(0, 0, w, h); noiseFill(g, w, h, R, 0.12, 6000, 3);
      const py = h * 0.5; g.fillStyle = '#2e4a42'; g.fillRect(0, py, w, h - py); g.fillStyle = '#1e302a'; g.fillRect(0, py - 4, w, 6);
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(20,15,10,${R() * 0.25})`; g.beginPath(); g.ellipse(R() * w, py + R() * (h - py), 10 + R() * 40, 4 + R() * 20, 0, 0, 7); g.fill(); }
      for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(40,30,25,0.5)'; g.lineWidth = 1; g.beginPath(); let x = R() * w, y = R() * py; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += R() * 30; g.lineTo(x, y); } g.stroke(); }
    }, 41), roughness: 0.55, envMapIntensity: 0.5 });
    M.podFloor = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h, R) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const t = (x + y) % 3; const c = ['#7a4a30', '#b8a080', '#5a3a28'][t]; g.fillStyle = c; g.fillRect(x * 16, y * 16, 15, 15); }
      noiseFill(g, w, h, R, 0.25, 3000, 2);
    }, 42), roughness: 0.4, envMapIntensity: 0.6 });
    M.stairs = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h, R) => { g.fillStyle = '#7a776e'; g.fillRect(0, 0, w, h); noiseFill(g, w, h, R, 0.25, 5000, 3); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 64 + 60, w, 4); }, 43), roughness: 0.8 });
    M.rail = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.35, metalness: 0.1 });
    M.railMetal = new THREE.MeshStandardMaterial({ color: 0x2a3a34, roughness: 0.5, metalness: 0.6 });
    M.leather = new THREE.MeshStandardMaterial({ map: canvasTex(128, 256, (g, w, h, R) => { g.fillStyle = '#4a2a1c'; g.fillRect(0, 0, w, h); for (let y = 16; y < h; y += 40) for (let x = 16; x < w; x += 32) { const gr = g.createRadialGradient(x, y, 1, x, y, 18); gr.addColorStop(0, 'rgba(255,220,180,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(x - 16, y - 20, 32, 40); g.fillStyle = '#c8a860'; g.fillRect(x - 1, y - 1, 3, 3); } }, 44), roughness: 0.4 });
    M.liftDoor = new THREE.MeshStandardMaterial({ color: 0x6a6a64, roughness: 0.35, metalness: 0.7 });
    M.wallpaper = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h, R) => {
      g.fillStyle = '#a89878'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(120,80,50,0.25)'; g.fillRect(x, 0, 10, h); }
      for (let y = 16, r = 0; y < h; y += 40, r++) for (let x = (r % 2) * 16 + 8; x < w; x += 32) { g.fillStyle = 'rgba(110,60,40,0.35)'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
      noiseFill(g, w, h, R, 0.12, 2000, 3);
    }, 45), roughness: 0.85 });
    M.lino = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h, R) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#6a4a30' : '#8a6040'; g.fillRect(x * 32, y * 32, 32, 32); } noiseFill(g, w, h, R, 0.2, 2000, 2); }, 46), roughness: 0.45 });
    M.wood = new THREE.MeshStandardMaterial({ map: T.wood, color: 0x8a6040, roughness: 0.6 });
    M.carpet = new THREE.MeshStandardMaterial({ map: T.rug, roughness: 0.95 });
    M.fabric = new THREE.MeshStandardMaterial({ color: 0x4a3a40, roughness: 0.95 });
    M.ceilingW = new THREE.MeshStandardMaterial({ color: 0xbab6aa, roughness: 0.9 });
    M.windowRain = new THREE.MeshStandardMaterial({ color: 0x0a0e14, emissive: 0x2a3a50, emissiveIntensity: 0.25, roughness: 0.05, metalness: 0.2,
      emissiveMap: canvasTex(128, 128, (g, w, h, R) => { g.fillStyle = '#556'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,0.6)'; const x = R() * w, y = R() * h; g.fillRect(x, y, 1.5, 3 + R() * 9); } }, 47) });
  }

  // ============ геометрия: склейка статики по материалам ============
  let ACC = new Map();
  const COL = [];   // {x0,x1,y0,y1,z0,z1}
  function worldUV(g, sx, sy, sz, s) {
    const uv = g.attributes.uv, pos = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
      const px = pos.getX(i) + sx / 2, py = pos.getY(i) + sy / 2, pz = pos.getZ(i) + sz / 2;
      if (nx > 0.5) uv.setXY(i, pz / s, py / s); else if (ny > 0.5) uv.setXY(i, px / s, pz / s); else uv.setXY(i, px / s, py / s);
    }
  }
  function sbox(mat, x0, x1, y0, y1, z0, z1, uvs = 2, collide = false) {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    const g = new THREE.BoxGeometry(sx, sy, sz); worldUV(g, sx, sy, sz, uvs);
    // мировые UV: чтобы узор продолжался между соседними коробками
    const uv = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)); if (nx > 0.5) uv.setXY(i, uv.getX(i) + z0 / uvs, uv.getY(i) + y0 / uvs); else if (ny > 0.5) uv.setXY(i, uv.getX(i) + x0 / uvs, uv.getY(i) + z0 / uvs); else uv.setXY(i, uv.getX(i) + x0 / uvs, uv.getY(i) + y0 / uvs); }
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    addGeo(mat, g);
    if (collide) COL.push({ x0, x1, y0, y1, z0, z1 });
  }
  function addGeo(mat, g) { if (!ACC.has(mat)) ACC.set(mat, []); ACC.get(mat).push(g.index ? g.toNonIndexed() : g); }
  function flushStatic(parent) {
    for (const [mat, list] of ACC) {
      for (const g of list) { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); }
      const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = m.receiveShadow = HIGH; m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m);
    }
    ACC = new Map();
  }
  function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || scene).add(m); return m; }

  // ============ свет: пул точечных источников переезжает к ближайшим лампам ============
  const LAMPS = [];   // {pos, col, i, d, on, flick, mesh, inside}
  const POOL = [], BLINK = [];
  let flash, headL = [], hemi, moonL, lightning;
  function lamp(pos, col, i, d, opts = {}) {
    const l = Object.assign({ pos, col, i, d, on: true, flick: 0, inside: false, mesh: null, offMat: M.bulbOff, onMat: null }, opts);
    LAMPS.push(l); if (l.flick >= 4) BLINK.push(l); return l;
  }
  function setLamp(l, on) { l.on = on; if (l.mesh) l.mesh.material = on ? l.onMat : l.offMat; }

  // ============ МИР ============
  const B = { x0: -3, x1: 3, zf: 10, zv: 12, zl: 14.2, zm: 17, zb: 18.4, FH: 3, NF: 9 };   // подъезд
  const APT = { x0: 3.25, x1: 9.4, z0: 10.8, z1: 16.4 };
  const APTS = [{ f: 2, n: 9, kind: 'tv' }, { f: 5, n: 18, kind: 'old' }, { f: 8, n: 27, kind: 'home' }];   // открытые квартиры (дверь справа на площадке)
  let van, vanDoor, driver, rainLines, rainPos, splashes = [], skyMat, entranceLamp;
  const OBJ = {};

  const CONES = [];   // световые конусы под фонарями (дешёвый «объёмный свет» в дожде)
  const STEAM = [];

  function build() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0b0f17, 0.016);
    cam = new THREE.PerspectiveCamera(62, 1, 0.05, 600); cam.rotation.order = 'YXZ'; scene.add(cam);
    makeMaterials();
    // окружение для отражений: тёмное небо с рыжими огнями города
    {
      const env = new THREE.Scene();
      const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: canvasTex(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05070c'); gr.addColorStop(0.45, '#1a1a22'); gr.addColorStop(0.52, '#3a2a20'); gr.addColorStop(1, '#050505'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = Math.random() < 0.7 ? '#ffb060' : '#c0d8ff'; g.fillRect(Math.random() * w, h * 0.42 + Math.random() * h * 0.12, 3, 3); } }) }));
      env.add(sky);
      for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: i % 4 ? 0xffa040 : 0xff2020 })); const a = i / 10 * Math.PI * 2; b.position.set(Math.cos(a) * 30, 8 + (i % 3) * 3, Math.sin(a) * 30); env.add(b); }
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.04).texture; pm.dispose();
      scene.environmentIntensity = 0.55;
    }
    skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: canvasTex(512, 256, (g, w, h, R) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#06080e'); gr.addColorStop(0.42, '#141822'); gr.addColorStop(0.5, '#2a2420'); gr.addColorStop(1, '#0a0a0a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h * 0.45, r = 20 + R() * 60; const c = g.createRadialGradient(x, y, 0, x, y, r); c.addColorStop(0, 'rgba(40,44,56,0.5)'); c.addColorStop(1, 'rgba(40,44,56,0)'); g.fillStyle = c; g.fillRect(x - r, y - r, r * 2, r * 2); }
    }) });
    const skyM = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat); scene.add(skyM); OBJ.sky = skyM;
    hemi = new THREE.HemisphereLight(0x2a3448, 0x0a0806, 0.35); scene.add(hemi);
    moonL = new THREE.DirectionalLight(0x6a80b0, 0.12); moonL.position.set(-30, 60, -20); scene.add(moonL);
    lightning = new THREE.DirectionalLight(0xc8d8ff, 0); lightning.position.set(40, 80, -60); scene.add(lightning);
    for (let i = 0; i < (LOW ? 4 : 6); i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); POOL.push(l); }
    flash = new THREE.SpotLight(0xfff4e0, 0, 22, 0.48, 0.55, 1.6); flash.castShadow = HIGH; if (HIGH) { flash.shadow.mapSize.set(1024, 1024); flash.shadow.bias = -0.0006; }
    cam.add(flash); flash.position.set(0.25, -0.2, 0); flash.target.position.set(0.1, -0.15, -3); cam.add(flash.target);

    buildStreet();
    buildStreetExtras();
    buildBridge();
    buildBuildings();
    buildStairwell();
    for (const a of APTS) buildApt(a);
    buildBooth();
    buildVan();
    buildMonsters(); buildGraph(); buildStory();
    buildRain();
    buildCones();
    flushStatic(scene);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, cam));
    if (!LOW) { bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.35, 0.96); composer.addPass(bloom); }
    composer.addPass(new OutputPass());
    S.built = true;
  }
  // прогрев: собрать все шейдеры заранее, чтобы заставка не дёргалась
  function warmup() {
    try {
      const vis = []; scene.traverse(o => { if (o.isMesh || o.isLineSegments || o.isSprite || o.isPoints) { vis.push([o, o.visible]); o.visible = true; } });
      POOL.forEach(l => l.intensity = 1); headL.forEach(l => l.intensity = 1); flash.intensity = 1;
      cam.position.set(0, 5, -5); cam.lookAt(0, 3, 10);
      renderer.compile(scene, cam);
      composer.render(0.016);
      for (const [o, v] of vis) o.visible = v;
      flash.intensity = 0;
    } catch (e) { }
  }

  // ---------- улица: наполнение ----------
  function txtTex(w, h, draw) { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
  function glowSign(text, w, h, bg, fg, x, y, z, ry, intensity = 2.5, font = 'bold 40px Arial') {
    const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: intensity, emissiveMap: txtTex(256, Math.round(256 * h / w), (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 2); }) }), x, y, z);
    m.rotation.y = ry; return m;
  }
  function buildStreetExtras() {
    // поперечная улица с перекрёстком (x ≈ −60) и мигающим светофором
    const cr = new THREE.PlaneGeometry(10, 120); cr.rotateX(-Math.PI / 2); { const uv = cr.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 10 / 8, uv.getY(i) * 120 / 8); }
    const crm = new THREE.Mesh(cr, M.road.clone()); Object.assign(crm.material, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); crm.position.set(-60, -0.148, 0); scene.add(crm);
    for (let i = 0; i < 7; i++) sbox(M.line, -66.5 + i * 0.6 * 1.6, -66.5 + i * 0.6 * 1.6 + 0.6, -0.146, -0.137, -3.8, 3.8, 2);   // зебра
    for (let i = 0; i < 7; i++) sbox(M.line, -55 + 0.1 - i * 0.96, -55 + 0.7 - i * 0.96, -0.146, -0.137, -3.8, 3.8, 2);
    const tl = (x, z) => {
      sbox(M.metal, x - 0.06, x + 0.06, 0, 3.4, z - 0.06, z + 0.06, 1, true);
      sbox(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }), x - 0.17, x + 0.17, 3.2, 4.1, z - 0.15, z + 0.15, 1);
      const y = mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb000, emissiveIntensity: 6 }), x, 3.65, z + (z > 0 ? -0.16 : 0.16));
      const l = lamp(V(x, 3.6, z + (z > 0 ? -0.5 : 0.5)), 0xffa000, 18, 9, { mesh: y, onMat: y.material, offMat: M.bulbOff, flick: 4 });
    };
    tl(-65.5, 4.9); tl(-54.5, -4.9);
    // табличка с названием улицы на углу нашего дома и знак
    const plate = (text, sub, x, y, z, ry) => { const m = mesh(new THREE.PlaneGeometry(1.2, 0.42), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3, map: txtTex(256, 90, (g, W, H) => { g.fillStyle = '#1e3a6e'; g.fillRect(0, 0, W, H); g.strokeStyle = '#e8e8e8'; g.lineWidth = 4; g.strokeRect(5, 5, W - 10, H - 10); g.fillStyle = '#fff'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText(text, W / 2, 42); g.font = '22px Arial'; g.fillText(sub, W / 2, 74); }) }), x, y, z); m.rotation.y = ry; };
    plate('ул. Заводская', 'дом 9', -29.6, 3.4, 9.98, Math.PI);
    plate('ул. Заводская', 'дом 9', 29.6, 3.4, 9.98, Math.PI);
    // остановка с рекламой
    const bs = new THREE.Group(); bs.position.set(-82, 0, -6.4); scene.add(bs);
    sbox(M.metal, -84, -80, 2.5, 2.62, -7.5, -5.6, 1); sbox(M.glassDark, -84, -80, 0.2, 2.5, -7.6, -7.5, 1); sbox(M.metal, -84.05, -83.95, 0, 2.5, -7.6, -5.6, 1, true); sbox(M.metal, -80.05, -79.95, 0, 2.5, -7.6, -5.6, 1, true);
    sbox(M.wood, -83.5, -80.5, 0.45, 0.52, -7.3, -6.9, 1);
    glowSign('ПРОПАЛ ЧЕЛОВЕК', 1.3, 1.7, '#e8e4d8', '#111', -82, 1.35, -7.45, 0, 1.2, 'bold 22px Arial');
    lamp(V(-82, 2.3, -6.6), 0xd8e8ff, 10, 6);
    // аптека и магазин на первых этажах через дорогу (светятся вывески)
    glowSign('АПТЕКА', 2.4, 0.6, '#0a3a10', '#40ff70', -40, 3.4, -13.95, 0, 3);
    { const c = mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x30ff60, emissiveIntensity: 4, emissiveMap: txtTex(64, 64, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.fillRect(24, 6, 16, 52); g.fillRect(6, 24, 52, 16); }) }), -38.3, 3.4, -13.94); }
    lamp(V(-40, 3.0, -12.8), 0x40ff70, 18, 8, { flick: 1 });
    glowSign('ПРОДУКТЫ', 2.6, 0.55, '#3a0a0a', '#ff5040', -150, 3.4, -13.95, 0, 3);
    lamp(V(-150, 3.0, -12.8), 0xff5040, 16, 8);
    glowSign('ШАУРМА 24', 2.4, 0.55, '#2a1a00', '#ffc040', 60, 3.4, -13.95, 0, 3);
    lamp(V(60, 3.0, -12.8), 0xffb040, 16, 8, { flick: 1 });
    // гаражи напротив нашего дома (через дорогу)
    const garM = new THREE.MeshStandardMaterial({ color: 0x5a6058, roughness: 0.5, metalness: 0.6, map: canvasTex(128, 128, (g, w, h, R) => { g.fillStyle = '#6a706a'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 0, 2, h); } for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(120,60,20,0.4)'; g.beginPath(); g.ellipse(R() * w, R() * h, 4 + R() * 14, 3 + R() * 10, 0, 0, 7); g.fill(); } }) });
    for (let i = 0; i < 12; i++) {
      const x = 4 + i * 3.6;
      sbox(M.concrete, x - 1.75, x + 1.75, 0, 2.5, -20, -14, 2); sbox(garM, x - 1.4, x + 1.4, 0.05, 2.2, -14.03, -13.98, 1);
      sbox(M.concrete, x - 1.9, x + 1.9, 2.5, 2.65, -20.2, -13.7, 2);
    }
    COL.push({ x0: 2, x1: 48, y0: -1, y1: 3, z0: -20.5, z1: -13.7 });
    glowSign('ГАРАЖИ', 1.6, 0.4, '#202020', '#c8c8c8', 1.6, 2.2, -13.97, 0, 0.6);
    sbox(M.metal, 0, 50, 0, 2.0, -12.2, -12.1, 1, true);   // забор из сетки
    // скамейки и велосипед у подъезда, коробки, тележка
    for (const sx of [-2.6, 2.6]) { sbox(M.wood, sx - 0.8, sx + 0.8, 0.45, 0.5, 8.6, 9.0, 1, true); sbox(M.wood, sx - 0.8, sx + 0.8, 0.5, 0.95, 8.95, 9.02, 1); sbox(M.metal, sx - 0.75, sx - 0.7, 0, 0.45, 8.65, 8.95, 1); sbox(M.metal, sx + 0.7, sx + 0.75, 0, 0.45, 8.65, 8.95, 1); }
    for (let i = 0; i < 5; i++) sbox(new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 }), 12 + i * 0.6 - 0.25, 12 + i * 0.6 + 0.25, 0, 0.35 + (i % 2) * 0.3, 7.5 + (i % 3) * 0.3, 7.9 + (i % 3) * 0.3, 1, true);
    { const cart = new THREE.Group(); cart.position.set(-16, -0.15, -1.5); cart.rotation.set(0, 0.6, 1.3); scene.add(cart);
      for (const [w, h, d, x, y, z] of [[0.9, 0.04, 0.55, 0, 0.7, 0], [0.9, 0.5, 0.02, 0, 0.95, 0.27], [0.9, 0.5, 0.02, 0, 0.95, -0.27], [0.02, 0.5, 0.55, 0.45, 0.95, 0]]) mesh(new THREE.BoxGeometry(w, h, d), M.metal, x, y, z, cart); }
    // брошенная машина с аварийкой
    OBJ.parkCar(22, -3.3, Math.PI / 2 + 0.1, OBJ.carMats[1]);
    for (const [dx, dz] of [[2.05, -0.75], [2.05, 0.75], [-2.05, -0.75], [-2.05, 0.75]]) { const b = mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff8000, emissiveIntensity: 6 }), 22 + dx, 0.55, -3.3 + dz * 1.05); lamp(V(22 + dx * 1.2, 0.7, -3.3 + dz * 1.1), 0xff8000, 10, 6, { mesh: b, onMat: b.material, offMat: M.bulbOff, flick: 5 }); }
    // провода через улицу
    const wireM = new THREE.LineBasicMaterial({ color: 0x050505 });
    for (let x = -300; x < 60; x += 40) for (const dy of [0, 0.3]) { const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(V(x + t * 6, 11 + dy - Math.sin(t * Math.PI) * 1.4, -14 + t * 24)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM)); }
    // люки с паром
    for (const x of [-180, -95, -30, 14]) { const m = mesh(new THREE.CircleGeometry(0.4, 16), M.metal, x, -0.145, -1.2); m.rotation.x = -Math.PI / 2; STEAM.push(V(x, 0, -1.2)); }
    // газета у подъезда
    const paper = mesh(new THREE.PlaneGeometry(0.62, 0.44), new THREE.MeshStandardMaterial({ roughness: 0.35, map: txtTex(256, 180, (g, W, H) => {
      g.fillStyle = '#d8d0bc'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.font = 'bold 13px Georgia'; g.fillText('ВЕЧЕРНИЙ ВЕСТНИК', 8, 16);
      g.font = 'bold 24px Georgia'; g.fillText('ВЗРЫВ', 8, 46); g.fillText('В ГЛУХОВО', 8, 72);
      g.fillStyle = '#666'; g.fillRect(150, 26, 96, 70); g.fillStyle = '#222'; g.beginPath(); g.moveTo(160, 90); g.lineTo(200, 40); g.lineTo(240, 90); g.fill();
      g.fillStyle = '#333'; for (let i = 0; i < 9; i++) g.fillRect(8, 86 + i * 9, 130 + (i % 3) * 30, 3);
      g.fillStyle = 'rgba(40,30,20,0.35)'; g.beginPath(); g.ellipse(200, 150, 70, 30, 0.3, 0, 7); g.fill();
    }) }), 1.3, 0.012, 7.4);
    paper.rotation.set(-Math.PI / 2, 0, 0.45); OBJ.paper = V(1.3, 0.2, 7.4); OBJ.paperMesh = paper;   // видна, только если в главе 1 дом взорвали
    // объявление на двери подъезда
    const ad = mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ roughness: 0.8, map: txtTex(96, 128, (g, W, H) => { g.fillStyle = '#eee'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.font = 'bold 12px Arial'; g.textAlign = 'center'; g.fillText('ВНИМАНИЕ!', W / 2, 18); g.font = '9px Arial'; ['После 23:00', 'дверь подъезда', 'ЗАПИРАЕТСЯ.', 'Ключ у вахтёра.', '', 'На 10 этаж', 'НЕ ПОДНИМАТЬСЯ'].forEach((t, i) => g.fillText(t, W / 2, 36 + i * 13)); }) }), -1.1, 1.5, 9.97);
    ad.rotation.y = Math.PI;
  }

  function buildCones() {
    if (LOW) return;
    const tex = canvasTex(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,190,110,0.32)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const parts = [];
    for (const p of CONES) { const g = new THREE.ConeGeometry(2.6, 7.2, 16, 1, true); g.translate(0, -3.6, 0); g.translate(p.x, p.y, p.z); parts.push(g.toNonIndexed()); }
    if (!parts.length) return;
    const coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(1.0, 0.68, 0.38) }, uK: { value: 0.085 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform float uK; varying vec3 vN; varying vec3 vV; varying float vH; void main(){ float e = abs(dot(normalize(vN), normalize(vV))); e = e * e * e; float h = pow(vH, 1.8); gl_FragColor = vec4(uCol * e * h * uK, 1.0); }',
    });
    void tex;
    const m = new THREE.Mesh(mergeGeometries(parts), coneMat);
    m.renderOrder = 3; scene.add(m); OBJ.cones = m;
    // пар из люков
    const st = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(200,200,210,0.35)'); gr.addColorStop(1, 'rgba(200,200,210,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    OBJ.steam = [];
    for (const p of STEAM) for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.5 })); s.userData = { base: p, t: i / 4 }; scene.add(s); OBJ.steam.push(s); }
  }
  function buildStreet() {
    // дорога: длинная полоса, UV в метрах
    const road = new THREE.PlaneGeometry(440, 9); road.rotateX(-Math.PI / 2);
    { const uv = road.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 440 / 8, uv.getY(i) * 9 / 8); }
    const r = new THREE.Mesh(road, M.road); r.position.set(-130, -0.15, 0); r.receiveShadow = HIGH; scene.add(r);
    // разметка: прерывистая линия
    for (let x = -340; x < 80; x += 9) sbox(M.line, x, x + 4, -0.149, -0.14, -0.08, 0.08, 4);
    // тротуары и бордюры
    for (const s of [-1, 1]) {
      const z0 = s > 0 ? 4.5 : -10, z1 = s > 0 ? 10 : -4.5;
      const w = new THREE.PlaneGeometry(440, z1 - z0); w.rotateX(-Math.PI / 2);
      { const uv = w.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 440 / 2, uv.getY(i) * (z1 - z0) / 2); }
      const m = new THREE.Mesh(w, M.walk); m.position.set(-130, 0, (z0 + z1) / 2); m.receiveShadow = HIGH; scene.add(m);
      sbox(M.curb, -350, 90, -0.15, 0.02, s > 0 ? 4.35 : -4.65, s > 0 ? 4.65 : -4.35, 1);
    }
    // лужи: почти зеркальные пятна
    const pud = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.04, metalness: 0.3, envMapIntensity: 1.6 });
    const R = rng(5);
    for (let i = 0; i < 40; i++) { const g = new THREE.CircleGeometry(1, 20); g.scale(1.2 + R() * 2.5, 0.6 + R() * 1.4, 1); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, pud); m.position.set(-300 + R() * 360, -0.143, -3.8 + R() * 7.6); m.rotation.y = R() * 3; m.receiveShadow = HIGH; scene.add(m); }
    for (let i = 0; i < 12; i++) { const g = new THREE.CircleGeometry(1, 16); g.scale(0.8 + R(), 0.5 + R() * 0.6, 1); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, pud); m.position.set(-40 + R() * 80, 0.006, 5 + R() * 4); scene.add(m); }
    // фонари вдоль улицы (натриевые, рыжие)
    for (let x = -330; x <= 70; x += 26) for (const s of [-1, 1]) {
      if (s > 0 && Math.abs(x - 0) < 6) continue;
      const pz = s * 5.2, xx = x + (s > 0 ? 13 : 0);
      sbox(M.metal, xx - 0.09, xx + 0.09, 0, 7.4, pz - 0.09, pz + 0.09, 1, true);
      sbox(M.metal, xx - 0.06, xx + 0.06, 7.3, 7.42, Math.min(pz, pz - s * 1.9), Math.max(pz, pz - s * 1.9), 1);
      sbox(M.metal, xx - 0.25, xx + 0.25, 7.22, 7.38, pz - s * 1.9 - 0.14, pz - s * 1.9 + 0.14, 1);
      const fl = (Math.abs(x) % 78 === 0) ? 1 : 0;
      let bulb = null; if (fl) bulb = mesh(new THREE.BoxGeometry(0.38, 0.05, 0.2), M.sodium, xx, 7.2, pz - s * 1.9); else sbox(M.sodium, xx - 0.19, xx + 0.19, 7.175, 7.225, pz - s * 1.9 - 0.1, pz - s * 1.9 + 0.1, 1);
      lamp(V(xx, 6.9, pz - s * 1.9), 0xffa050, 90, 24, { mesh: bulb, onMat: M.sodium, flick: fl });
      CONES.push(V(xx, 7.15, pz - s * 1.9));
    }
    // голые деревья
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.9 });
    const parts = [new THREE.CylinderGeometry(0.12, 0.22, 4.5, 6).translate(0, 2.25, 0)];
    for (let i = 0; i < 7; i++) { const b = new THREE.CylinderGeometry(0.02, 0.07, 2.4, 4).translate(0, 1.2, 0); b.rotateZ(0.5 + (i % 3) * 0.3); b.rotateY(i * 0.9); b.translate(0, 2.6 + i * 0.3, 0); parts.push(b); }
    const treeG = mergeGeometries(parts.map(g => g.toNonIndexed()));
    const R2 = rng(9), spots = [];
    for (let x = -320; x < 60; x += 17) { if (R2() < 0.3) continue; spots.push([x + R2() * 6, s1(R2)]); }
    function s1(R) { return R() < 0.5 ? -8.6 : 8.6; }
    const im = new THREE.InstancedMesh(treeG, trunkM, spots.length); const m4 = new THREE.Matrix4();
    spots.forEach(([x, z], i) => { if (Math.abs(x) < 8 && z > 0) z = -8.6; m4.makeRotationY(i * 1.7); m4.setPosition(x, 0, z); im.setMatrixAt(i, m4); COL.push({ x0: x - 0.25, x1: x + 0.25, y0: 0, y1: 4, z0: z - 0.25, z1: z + 0.25 }); });
    scene.add(im);
    // ларёк «Продукты 24» (кадр у будки)
    const k = new THREE.Group(); k.position.set(-199, 0, -7.6); scene.add(k);
    addTo(k, new THREE.Mesh(new RoundedBoxGeometry(3.2, 2.7, 2.3, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.4, metalness: 0.3 }))).position.y = 1.35;
    const win = mesh(new THREE.PlaneGeometry(2.4, 1.1), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff0d0, emissiveIntensity: 2.2, map: canvasTex(256, 128, (g, w, h, R) => { g.fillStyle = '#d8d0b8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = ['#a03020', '#2050a0', '#e0b030', '#308040'][(R() * 4) | 0]; g.fillRect(R() * w, 20 + ((R() * 3) | 0) * 34, 10, 22); } }), emissiveMap: null }), 0, 1.45, 1.16, k);
    win.material.emissiveMap = win.material.map;
    const sign = mesh(new THREE.PlaneGeometry(2.6, 0.45), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 3, emissiveMap: canvasTex(256, 48, (g, w, h) => { g.fillStyle = '#c01818'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 32px Arial'; g.textAlign = 'center'; g.fillText('ПРОДУКТЫ 24', w / 2, 36); }) }), 0, 2.45, 1.17, k);
    lamp(V(-199, 1.6, -5.9), 0xfff0d0, 25, 9);
    COL.push({ x0: -200.7, x1: -197.3, y0: 0, y1: 3, z0: -8.8, z1: -6.4 });
    // припаркованные машины (склеены в статику)
    const carCols = [0x2a2a30, 0x5a1a1a, 0x1a3a2a, 0x3a3a40, 0x6a6a60];
    const carMats = carCols.map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 }));
    const R3 = rng(21);
    const parkCar = (x, z, ry, mat) => {
      const m4 = new THREE.Matrix4().makeRotationY(ry); m4.setPosition(x, -0.15, z);
      const add = (g, m) => { g.applyMatrix4(m4); addGeo(m, g); };
      add(new RoundedBoxGeometry(1.7, 0.7, 4.1, 2, 0.15).translate(0, 0.62, 0), mat);
      add(new RoundedBoxGeometry(1.5, 0.55, 2.1, 2, 0.15).translate(0, 1.18, -0.2), M.glassDark);
      for (const [wx, wz] of [[-0.8, 1.3], [0.8, 1.3], [-0.8, -1.3], [0.8, -1.3]]) add(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 14).rotateZ(Math.PI / 2).translate(wx, 0.33, wz), M.dark);
      COL.push({ x0: x - 2.1, x1: x + 2.1, y0: -0.2, y1: 1.5, z0: z - 0.9, z1: z + 0.9 });
    };
    for (let x = -300; x < 40; x += 22 + R3() * 30) { if (x > -14 && x < 12) continue; if (Math.abs(x + 60) < 10) continue; parkCar(x, -3.3, Math.PI / 2 + (R3() - 0.5) * 0.05, carMats[(R3() * 5) | 0]); }
    OBJ.parkCar = parkCar; OBJ.carMats = carMats;
    // мусорные баки у нашего дома
    for (let i = 0; i < 3; i++) { const bx = 9 + i * 1.5; sbox(new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.5, metalness: 0.4 }), bx - 0.6, bx + 0.6, 0, 1.2, 8.2, 9.4, 1, true); }
  }

  function buildBridge() {
    // железнодорожный мост над дорогой: кирпичный свод с красными огнями по арке
    const X0 = -127, X1 = -113, R = 6.2;
    const vault = new THREE.CylinderGeometry(R, R, X1 - X0, 28, 1, true, 0, Math.PI); vault.rotateZ(Math.PI / 2);
    { const uv = vault.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 3); }
    const v = new THREE.Mesh(vault, new THREE.MeshStandardMaterial({ map: M.brick.map, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.6 })); v.position.set((X0 + X1) / 2, -0.15, 0); scene.add(v);
    // порталы с аркой
    const shape = new THREE.Shape(); shape.moveTo(-14, -0.15); shape.lineTo(14, -0.15); shape.lineTo(14, 10); shape.lineTo(-14, 10); shape.lineTo(-14, -0.15);
    const hole = new THREE.Path(); hole.moveTo(-R, -0.15); hole.lineTo(-R, 0); hole.absarc(0, 0, R, Math.PI, 0, true); hole.lineTo(R, -0.15); hole.lineTo(-R, -0.15); shape.holes.push(hole);
    const pg = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false, curveSegments: 24 });
    { const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3); }
    for (const px of [X0, X1]) { const p = new THREE.Mesh(pg, M.brick); p.rotation.y = Math.PI / 2; p.position.set(px + (px === X0 ? 0 : -1.2) + (px === X0 ? 0 : 0), -0.15 * 0, 0); p.position.x = px === X0 ? X0 - 1.2 + 1.2 : X1; scene.add(p); }
    // красная светодиодная лента по арке и сигнальные лампы
    for (const px of [X0 - 0.05, X1 + 1.25]) {
      const curve = new THREE.EllipseCurve(0, 0, R - 0.05, R - 0.05, 0, Math.PI, false);
      const pts = curve.getPoints(40).map(p => V(px, p.y, p.x));
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.06, 6), M.redLed);
      lamp(V(px, R - 0.4, 0), 0xff2020, 70, 16);
      lamp(V(px, 2.0, -R + 0.8), 0xff2020, 25, 8, { flick: 2 });
    }
    // пролёт моста сверху и насыпь
    sbox(M.concrete, X0 - 1.5, X1 + 1.5, 9.4, 10.6, -40, 40, 3);
    sbox(M.metal, X0, X0 + 0.1, 10.6, 11.6, -40, 40, 1); sbox(M.metal, X1 - 0.1, X1, 10.6, 11.6, -40, 40, 1);
    for (const s of [-1, 1]) sbox(M.concrete, X0 - 1.15, X1 + 1.15, -0.15, 9.4, s > 0 ? 14 : -40, s > 0 ? 40 : -14, 3);
    COL.push({ x0: X0 - 1.2, x1: X1 + 1.2, y0: -1, y1: 10, z0: 10, z1: 40 }, { x0: X0 - 1.2, x1: X1 + 1.2, y0: -1, y1: 10, z0: -40, z1: -10 });
  }

  // фасад панельного дома: плоскость с мировыми UV (окно — 3 м)
  function facade(x0, x1, y0, y1, z, face, uOff = 0) {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { const px = pos.getX(i) + (x0 + x1) / 2, py = pos.getY(i) + (y0 + y1) / 2; uv.setXY(i, (px + uOff) / 24, py / 18); }
    if (face < 0) g.rotateY(Math.PI);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, z); addGeo(M.facade, g);
  }
  function facadeX(z0, z1, y0, y1, x, face) {   // торец
    const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0); const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { const pz = pos.getX(i) + (z0 + z1) / 2, py = pos.getY(i) + (y0 + y1) / 2; uv.setXY(i, pz / 24 + 0.3, py / 18); }
    g.rotateY(face > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2); addGeo(M.facade, g);
  }
  function block(x0, x1, z0, z1, h, frontZ, uOff) {
    facade(x0, x1, 0, h, frontZ, frontZ === z0 ? -1 : 1, uOff);
    facade(x0, x1, 0, h, frontZ === z0 ? z1 : z0, frontZ === z0 ? 1 : -1, uOff + 7);
    facadeX(z0, z1, 0, h, x0, -1); facadeX(z0, z1, 0, h, x1, 1);
    sbox(M.concrete, x0 - 0.3, x1 + 0.3, h, h + 0.6, z0 - 0.3, z1 + 0.3, 3);
    COL.push({ x0, x1, y0: -1, y1: h, z0, z1 });
  }
  function buildBuildings() {
    // наш дом: 9 этажей, x от −30 до 30, подъезд по центру (x −3..3)
    const H = 27.4;
    // фасад со стороны улицы: дыра под дверь подъезда
    facade(-30, -1, 0, H, 10, -1, 0); facade(1, 30, 0, H, 10, -1, 0); facade(-1, 1, 2.3, H, 10, -1, 0);
    facade(-30, 30, 0, H, 22, 1, 7); facadeX(10, 22, 0, H, -30, -1); facadeX(10, 22, 0, H, 30, 1);
    sbox(M.concrete, -30.3, 30.3, H, H + 0.6, 9.7, 22.3, 3);
    COL.push({ x0: -30, x1: -3.2, y0: -1, y1: 40, z0: 10, z1: 22 }, { x0: 3.2, x1: 30, y0: -1, y1: 2.5, z0: 10, z1: 22 }, { x0: -3.3, x1: 3.3, y0: -1, y1: 40, z0: 18.6, z1: 22 });
    // козырёк подъезда, дверь, лампа, табличка
    sbox(M.concrete, -2, 2, 2.65, 2.85, 8.6, 10, 2);
    sbox(M.metal, -1.95, -1.85, 0, 2.65, 8.7, 8.8, 1, true); sbox(M.metal, 1.85, 1.95, 0, 2.65, 8.7, 8.8, 1, true);
    entranceLamp = lamp(V(0, 2.5, 9.4), 0xfff0d0, 16, 11, { flick: 3 });
    entranceLamp.mesh = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), M.bulb, 0, 2.58, 9.4); entranceLamp.onMat = M.bulb;
    { const door = new THREE.Group(); door.position.set(-0.6, 0, 10.0); scene.add(door); OBJ.frontDoor = door;
      const dm = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.45, metalness: 0.7 });
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.08), dm); leaf.position.set(0.6, 1.1, 0); door.add(leaf);
      const pad = mesh(new THREE.BoxGeometry(0.16, 0.24, 0.04), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x30ff60, emissiveIntensity: 0.6 }), 1.0, 1.4, -0.06, door);
      door.rotation.y = 1.3; }   // дверь приоткрыта (домофон сломан)
    { const plate = mesh(new THREE.PlaneGeometry(0.9, 0.35), new THREE.MeshStandardMaterial({ map: canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#20406a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.fillText('Подъезд 3', w / 2, 40); g.font = '26px Arial'; g.fillText('кв. 1–27', w / 2, 78); }), roughness: 0.5 }), 1.6, 2.4, 9.98); plate.rotation.y = Math.PI; }
    // соседние подъезды — заколочены, у каждого лампа (как фонари на стене в ролике)
    for (const ex of [-18, 18]) { sbox(M.concrete, ex - 1.6, ex + 1.6, 2.65, 2.85, 8.8, 10, 2); sbox(new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.8 }), ex - 0.6, ex + 0.6, 0, 2.2, 9.9, 9.98, 1);
      const lm = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), M.bulb, ex, 2.58, 9.4); lamp(V(ex, 2.5, 9.4), 0xffe0b0, 22, 10, { mesh: lm, onMat: M.bulb }); }
    // улица: панельки по обе стороны
    const R = rng(3);
    for (let x = -330; x < -40; ) { let w = 30 + R() * 30; const gap = 8 + R() * 14; if (x + w > -128 - 8 && x < -112 + 8) { x = -104; continue; } if (x + w > -66 && x < -54) { if (x < -66 - 12) w = -66 - x; else { x = -52; continue; } } if (x + w > -38) w = -38 - x; if (w < 12) { x += w + gap; continue; } const h = (5 + ((R() * 5) | 0)) * 3; block(x, x + w, 10, 22, h, 10, R() * 20); for (let ex = x + 8; ex < x + w - 4; ex += 14) { sbox(M.bulb, ex - 0.15, ex + 0.15, 2.52, 2.64, 9.5, 9.7, 1); lamp(V(ex, 2.5, 9.6), 0xffe0b0, 22, 10); sbox(M.concrete, ex - 1.4, ex + 1.4, 2.65, 2.85, 8.9, 10, 2); sbox(M.wood, ex - 0.55, ex + 0.55, 0, 2.15, 9.92, 9.99, 1); } x += w + gap; }
    for (let x = -330; x < 70; ) { let w = 30 + R() * 30; const gap = 8 + R() * 14; if (x + w > -128 - 8 && x < -112 + 8) { x = -104; continue; } if (x + w > -66 && x < -54) { if (x < -66 - 12) w = -66 - x; else { x = -52; continue; } } if (x + w > 2 && x < 52) { if (x < -10) w = 2 - x; else { x = 52; continue; } } const h = (5 + ((R() * 5) | 0)) * 3; block(x, x + w, -26, -14, h, -14, R() * 20); x += w + gap; }
    for (let x = 34; x < 80; ) { const w = 30; block(x, x + w, 10, 22, 27, 10, 3); x += w + 12; }
    // дальние дома (силуэты с огоньками)
    for (let i = 0; i < 26; i++) { const x = -330 + i * 16, z = (i % 2 ? 1 : -1) * (60 + R() * 40), h = 20 + R() * 40; facade(x, x + 12 + R() * 10, 0, h, z, z > 0 ? -1 : 1, R() * 30); }
  }


  // ---------- подъезд ----------
  const LIFT = { x0: -4.75, x1: -3.25, z0: 12.45, z1: 13.75 };
  function geoAt(g, x, y, z, ry = 0) { if (ry) g.rotateY(ry); g.translate(x, y, z); return g; }
  function buildStairwell() {
    const { x0, x1, zf, zv, zl, zm, zb, FH, NF } = B;
    const TOP = NF * FH + 0.4;
    // атлас номеров квартир: одна текстура на все таблички
    const atlas = canvasTex(512, 512, (g, w, h) => { for (let n = 1; n <= 30; n++) { const c = (n - 1) % 6, r = ((n - 1) / 6) | 0; const x = c * 85, y = r * 100; g.fillStyle = '#c8a850'; g.fillRect(x, y, 85, 100); g.fillStyle = '#2a1a08'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.fillText(String(n), x + 42, y + 68); } });
    atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
    M.numAtlas = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.3, metalness: 0.6 });
    OBJ.doorNumber = (n, x, y, z, ry) => {
      const g = new THREE.PlaneGeometry(0.16, 0.11), uv = g.attributes.uv, c = (n - 1) % 6, r = ((n - 1) / 6) | 0;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (c + uv.getX(i)) * 85 / 512, 1 - (r + 1 - uv.getY(i)) * 100 / 512);
      addGeo(M.numAtlas, geoAt(g, x, y, z, ry));
    };
    // левая стена с проёмами лифта на каждом этаже
    sbox(M.podWall, x0 - 0.25, x0, 0, TOP, zf + 0.02, LIFT.z0, 3, true); sbox(M.podWall, x0 - 0.25, x0, 0, TOP, LIFT.z1, zb + 0.25, 3, true);
    for (let f = 0; f < NF; f++) { sbox(M.podWall, x0 - 0.25, x0, f * FH + 2.25, f * FH + 3, LIFT.z0, LIFT.z1, 3); COL.push({ x0: x0 - 0.3, x1: x0, y0: f * FH - 0.5, y1: f * FH + 2.25, z0: LIFT.z0, z1: LIFT.z1 }); }
    // шахта лифта
    const shaftM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    sbox(shaftM, LIFT.x0 - 0.1, LIFT.x0, 0, TOP, LIFT.z0 - 0.2, LIFT.z1 + 0.2, 2); sbox(shaftM, LIFT.x0, x0 - 0.25, 0, TOP, LIFT.z0 - 0.2, LIFT.z0 - 0.1, 2); sbox(shaftM, LIFT.x0, x0 - 0.25, 0, TOP, LIFT.z1 + 0.1, LIFT.z1 + 0.2, 2);
    // кабина, которая ездит по шахте (в ней Лифтёр)
    const cab = new THREE.Group(); scene.add(cab); OBJ.cab = cab;
    const cabM = new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 0.5, map: canvasTex(128, 128, (g, w, h, R) => { g.fillStyle = '#7a6a4a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(30,20,10,${R() * 0.5})`; g.beginPath(); g.moveTo(R() * w, R() * h); g.lineTo(R() * w, R() * h); g.stroke(); } }) });
    mesh(new THREE.BoxGeometry(1.45, 0.06, 1.25), M.dark, -4.0, 0.03, 13.1, cab);
    mesh(new THREE.BoxGeometry(0.04, 2.3, 1.25), cabM, -4.7, 1.15, 13.1, cab);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(1.45, 2.3, 0.04), cabM, -4.0, 1.15, 13.1 + s * 0.62, cab);
    mesh(new THREE.BoxGeometry(1.45, 0.05, 1.25), M.dark, -4.0, 2.3, 13.1, cab);
    const cabBulb = mesh(new THREE.BoxGeometry(0.3, 0.03, 0.15), M.bulb, -4.0, 2.26, 13.1, cab);
    OBJ.cabLamp = lamp(V(-4, 2, 13.1), 0xfff0c0, 3, 5, { inside: true, mesh: cabBulb, onMat: M.bulb, flick: 1, on: false });
    // правая стена: проёмы в открытые квартиры
    const holes = APTS.map(a => a.f);
    const dz0 = 12.6, dz1 = 13.6;
    sbox(M.podWall, x1, x1 + 0.25, 0, TOP, zf + 0.02, dz0, 3, true); sbox(M.podWall, x1, x1 + 0.25, 0, TOP, dz1, zb + 0.25, 3, true);
    for (let f = 0; f < NF; f++) {
      const y = f * FH;
      if (holes.includes(f)) sbox(M.podWall, x1, x1 + 0.25, y + 2.2, y + 3, dz0, dz1, 3, true);
      else sbox(M.podWall, x1, x1 + 0.25, y, y + 3, dz0, dz1, 3, true);
    }
    sbox(M.podWall, x0 - 0.25, x1 + 0.25, 0, TOP, zb, zb + 0.25, 3, true);
    // тамбур
    sbox(M.podWall, x0, -0.6, 0, 2.8, zf + 0.02, zf + 0.2, 3, true); sbox(M.podWall, 0.6, x1, 0, 2.8, zf + 0.02, zf + 0.2, 3, true); sbox(M.podWall, -0.6, 0.6, 2.2, 2.8, zf + 0.02, zf + 0.2, 3);
    COL.push(OBJ.frontCol = { x0: -0.6, x1: 0.6, y0: 3, y1: 3, z0: zf - 0.05, z1: zf + 0.2 });
    sbox(M.podFloor, x0, x1, -0.2, 0, zf, zv, 2);
    sbox(M.podFloor, x0, x1, -0.22, 0, zl, zm, 2);   // пол под маршами первого этажа
    sbox(M.ceilingW, x0, x1, 2.8, 3.0, zf + 0.02, zv, 2);
    sbox(M.podWall, x0, -1, 0, 2.8, zv - 0.2, zv, 3, true); sbox(M.podWall, 1, x1, 0, 2.8, zv - 0.2, zv, 3, true); sbox(M.podWall, -1, 1, 2.3, 2.8, zv - 0.2, zv, 3);
    sbox(M.podWall, x0, x1, 3.0, TOP, zv - 0.2, zv, 3);
    sbox(M.ceilingW, x0, x1, TOP - 0.2, TOP, zv, zb, 2);
    // почтовые ящики
    const mb = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.5, map: canvasTex(384, 256, (g, w, h) => {
      g.fillStyle = '#2a4a6a'; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { const n = r * 9 + c + 1; const x = c * 42 + 4, y = r * 84 + 6; g.fillStyle = n === 27 ? '#3a6a9a' : '#345a80'; g.fillRect(x, y, 36, 74); g.fillStyle = '#0a1420'; g.fillRect(x + 6, y + 10, 24, 6); g.fillStyle = '#e8e0c8'; g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.fillText(String(n), x + 18, y + 60); }
    }) }));
    mb.position.set(x0 + 0.02, 1.4, 10.95); mb.rotation.y = Math.PI / 2; scene.add(mb);
    OBJ.mailbox = V(x0 + 0.3, 1.15, 11.35);
    lamp(V(0, 2.6, 11), 0xffe8c8, 5, 7, { inside: true, mesh: mesh(new THREE.SphereGeometry(0.06, 8, 6), M.bulb, 0, 2.7, 11), onMat: M.bulb, flick: 1 });
    // этажи
    const steps = 9, tr = (zm - zl) / steps, ri = 1.5 / steps;
    OBJ.lifts = [];
    OBJ.lampsF = [];
    for (let f = 0; f < NF; f++) {
      const y = f * FH;
      sbox(M.podFloor, x0, x1, y - 0.22, y, zv, zl, 2);
      if (f < NF - 1) {
        sbox(M.podFloor, x0, x1, y + 1.5 - 0.22, y + 1.5, zm, zb, 2);
        for (let i = 0; i < steps; i++) {
          const ta = y + (i + 1) * ri, tb = y + 1.5 + (i + 1) * ri;
          sbox(M.stairs, x0 + 0.05, -0.15, ta - 0.17, ta, zl + i * tr, zl + (i + 1) * tr + 0.01, 1);
          sbox(M.stairs, 0.15, x1 - 0.05, tb - 0.17, tb, zm - (i + 1) * tr - 0.01, zm - i * tr, 1);
        }
        // наклонные плиты под маршами (снизу побелка)
        for (const [ax0, ax1, za, ya, zb2, yb] of [[x0 + 0.05, -0.15, zl, y, zm, y + 1.5], [0.15, x1 - 0.05, zm, y + 1.5, zl, y + 3]]) {
          const len = Math.hypot(zb2 - za, yb - ya), g = new THREE.BoxGeometry(ax1 - ax0 - 0.02, 0.14, len);
          g.rotateX(-Math.atan2(yb - ya, zb2 - za)); g.translate((ax0 + ax1) / 2, (ya + yb) / 2 - 0.1, (za + zb2) / 2); addGeo(M.ceilingW, g);
        }
        for (const [sx, a, b2] of [[-0.12, y, y + 1.5], [0.12, y + 3, y + 1.5]]) {
          for (let i = 0; i <= 8; i++) { const zz = zl + i * (zm - zl) / 8, yy = lerp(a, b2, i / 8); sbox(M.railMetal, sx - 0.015, sx + 0.015, yy, yy + 0.95, zz - 0.015, zz + 0.015, 1); }
          const len = Math.hypot(zm - zl, b2 - a), g = new THREE.BoxGeometry(0.07, 0.05, len); g.rotateX(-Math.atan2(b2 - a, zm - zl)); g.translate(sx, (a + b2) / 2 + 0.97, (zl + zm) / 2); addGeo(M.rail, g);
        }
        COL.push({ x0: -0.2, x1: 0.2, y0: y - 1, y1: y + 4, z0: zl, z1: zm });
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), M.windowRain); w.position.set(0, y + 1.5 + 1.4, zb - 0.02); w.rotation.y = Math.PI; scene.add(w);
        sbox(M.ceilingW, -0.85, 0.85, y + 1.5 + 0.72, y + 1.5 + 0.78, zb - 0.15, zb, 1);
        const mlOn = !(f === 2 || f === 5 || f === 7);
        const mm = mesh(new THREE.SphereGeometry(0.06, 8, 6), mlOn ? M.bulb : M.bulbOff, 1.6, y + 1.5 + 2.5, zb - 0.15);
        lamp(V(1.6, y + 1.5 + 2.4, zb - 0.3), 0xffe8c8, 6, 7, { inside: true, mesh: mm, onMat: M.bulb, on: mlOn, flick: f === 3 ? 2 : 0, stair: true });
      }
      const lm = mesh(new THREE.SphereGeometry(0.07, 8, 6), M.bulb, 0, y + 2.75, 13.1);
      const ll = lamp(V(0, y + 2.6, 13.1), 0xffe8c8, 7, 8, { inside: true, mesh: lm, onMat: M.bulb, flick: f === 4 ? 1 : 0, stair: true });
      OBJ.lampsF[f] = ll;
      sbox(M.dark, -0.03, 0.03, y + 2.82, y + 3, 13.07, 13.13, 1);
      // квартиры на стене к улице
      const nums = [3 * f + 1, 3 * f + 2, 3 * f + 3];
      for (const [dx, n] of [[-2, nums[0]], [2, nums[1]]]) {
        addGeo(M.leather, geoAt(new THREE.BoxGeometry(0.9, 2.05, 0.06), dx, y + 1.03, zv + 0.03));
        OBJ.doorNumber(n, dx, y + 1.75, zv + 0.065, 0);
        addGeo(M.metal, geoAt(new THREE.SphereGeometry(0.03, 8, 6), dx + 0.35, y + 1.0, zv + 0.08));
        OBJ['door' + n] = { pos: V(dx, y + 1.2, zv + 0.3), n, f };
      }
      if (!holes.includes(f)) { addGeo(M.leather, geoAt(new THREE.BoxGeometry(0.06, 2.05, 0.9), x1 - 0.03, y + 1.03, 13.1)); OBJ.doorNumber(nums[2], x1 - 0.065, y + 1.75, 13.1, -Math.PI / 2); OBJ['door' + nums[2]] = { pos: V(x1 - 0.3, y + 1.2, 13.1), n: nums[2], f }; }
      // двери лифта (раздвижные)
      sbox(M.metal, x0, x0 + 0.08, y, y + 2.3, LIFT.z0 - 0.1, LIFT.z0, 1); sbox(M.metal, x0, x0 + 0.08, y, y + 2.3, LIFT.z1, LIFT.z1 + 0.1, 1); sbox(M.metal, x0, x0 + 0.08, y + 2.2, y + 2.3, LIFT.z0, LIFT.z1, 1);
      const dl = mesh(new THREE.BoxGeometry(0.04, 2.2, 0.66), M.liftDoor, x0 - 0.12, y + 1.1, 12.78), dr = mesh(new THREE.BoxGeometry(0.04, 2.2, 0.66), M.liftDoor, x0 - 0.12, y + 1.1, 13.42);
      OBJ.lifts[f] = { dl, dr, open: 0 };
      addGeo(new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0.6 }), geoAt(new THREE.BoxGeometry(0.03, 0.08, 0.05), x0 + 0.04, y + 1.25, 14.05));
      if (f > 0) { const g = new THREE.PlaneGeometry(0.35, 0.25); g.rotateY(Math.PI / 2); g.translate(x0 + 0.01, y + 1.5, 14.35); addGeo(M.liftNote || (M.liftNote = new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(128, 96, (g2, w, h) => { g2.fillStyle = '#e8e4d8'; g2.fillRect(0, 0, w, h); g2.fillStyle = '#222'; g2.font = 'bold 15px Arial'; g2.textAlign = 'center'; g2.fillText('ЛИФТ', w / 2, 30); g2.fillText('НЕ РАБОТАЕТ', w / 2, 52); g2.font = '11px Arial'; g2.fillText('ЖЭК', w / 2, 78); }) })), g); }
    }
    // надписи
    const graf = (text, x, y, z, ry, col = 'rgba(20,20,20,0.75)', size = 40) => { const t = txtTex(512, 96, (g) => { g.font = 'bold ' + size + 'px Arial'; g.fillStyle = col; g.textAlign = 'center'; g.translate(256, 60); g.rotate(-0.04); g.fillText(text, 0, 0); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); };
    graf('ТУТ БЫЛ ВАСЯ', x0 + 0.01, 1.2, 15.8, Math.PI / 2);
    graf('НЕ ХОДИ НАВЕРХ', x1 - 0.01, 3 * 3 + 1.0, 15.6, -Math.PI / 2, 'rgba(120,10,10,0.8)');
    graf('ОН СМОТРИТ', 0, 6 * 3 + 1.5 + 0.6, zb - 0.01, Math.PI, 'rgba(20,20,20,0.8)');
    graf('27 НЕ ОТКРЫВАТЬ', x0 + 0.01, 8 * 3 + 1.1, 15.4, Math.PI / 2, 'rgba(120,10,10,0.85)', 36);
    graf('10 ЭТАЖ ЕСТЬ', x1 - 0.01, 7 * 3 + 1.0, 15.4, -Math.PI / 2, 'rgba(20,20,20,0.8)', 36);
    // щитки: на 9 этаже (свет квартиры 27) и у лифта на 1 этаже (домофон)
    const shield = (pos, ry, label) => {
      const sh = new THREE.Group(); sh.position.copy(pos); sh.rotation.y = ry; scene.add(sh);
      sh.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.22), new THREE.MeshStandardMaterial({ color: 0x5a6a6a, roughness: 0.5, metalness: 0.5 })));
      const door = new THREE.Group(); door.position.set(-0.45, 0, 0.115); sh.add(door);
      const sdm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.025), new THREE.MeshStandardMaterial({ color: 0x6a7a7a, roughness: 0.45, metalness: 0.5, map: txtTex(128, 128, (g, w, h) => { g.fillStyle = '#6a7a7a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8d020'; g.beginPath(); g.moveTo(64, 26); g.lineTo(92, 78); g.lineTo(36, 78); g.fill(); g.fillStyle = '#111'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.fillText('!', 64, 72); g.font = 'bold 12px Arial'; g.fillText(label, 64, 104); }) }));
      sdm.position.x = 0.45; door.add(sdm);
      const brk = new THREE.Group(); brk.position.set(0, 0, 0.04); sh.add(brk);
      for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(0.08, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: i === 5 ? 0xd02020 : 0xe0e0d8, roughness: 0.5 }), -0.3 + i * 0.12, 0.1, 0, brk);
      const sw = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.04), M.dark, 0.3, 0.02, 0.03, brk);
      const fwd = V(Math.sin(ry), 0, Math.cos(ry));
      return { g: sh, door, sw, pos: pos.clone().addScaledVector(fwd, 0.35) };
    };
    OBJ.shield = shield(V(0, 8 * FH + 1.5, zv + 0.12), 0, 'ЭТАЖ 9');
    OBJ.shield0 = shield(V(x0 + 0.12, 1.6, 15.4), Math.PI / 2, 'ДОМОФОН');
    // люк на крышу («10 этаж») и лестница к нему
    sbox(M.dark, 0.55, 1.45, TOP - 0.21, TOP - 0.19, 12.9, 13.8, 1);
    for (const sx of [0.62, 1.38]) sbox(M.railMetal, sx - 0.02, sx + 0.02, 24, TOP - 0.2, 12.1, 12.14, 1);
    for (let i = 0; i < 9; i++) sbox(M.railMetal, 0.62, 1.38, 24.3 + i * 0.32, 24.33 + i * 0.32, 12.1, 12.16, 1);
  }

  // ---------- открытые квартиры (9, 18, 27) ----------
  const WARD = { x0: 8.6, x1: 9.38, z0: 11.0, z1: 12.6 };
  function buildApt(a) {
    const y = a.f * B.FH, H = 2.7, { x1, z0, z1 } = APT;
    const hallX = 5.4;
    const wp = a.kind === 'home' ? M.wallpaper : a.kind === 'tv' ? (M.wpGreen || (M.wpGreen = M.wallpaper.clone(), M.wpGreen.color.setHex(0x9ab09a), M.wpGreen)) : (M.wpBlue || (M.wpBlue = M.wallpaper.clone(), M.wpBlue.color.setHex(0x9aa8c0), M.wpBlue));
    sbox(M.lino, 3.25, x1, y - 0.2, y, z0, z1, 2);
    sbox(M.ceilingW, 3.25, x1, y + H, y + H + 0.2, z0, z1, 2);
    sbox(wp, x1, x1 + 0.2, y, y + H, z0, z1, 2.5, true);
    sbox(wp, 3.2, x1 + 0.2, y, y + H, z1, z1 + 0.2, 2.5, true);
    const wx0 = 6.6, wx1 = 8.4, wy0 = y + 0.9, wy1 = y + 2.3;
    sbox(wp, 3.2, wx0, y, y + H, z0 - 0.25, z0, 2.5, true); sbox(wp, wx1, x1 + 0.2, y, y + H, z0 - 0.25, z0, 2.5, true);
    sbox(wp, wx0, wx1, y, wy0, z0 - 0.25, z0, 2.5, true); sbox(wp, wx0, wx1, wy1, y + H, z0 - 0.25, z0, 2.5);
    addGeo(M.aptGlass || (M.aptGlass = new THREE.MeshPhysicalMaterial({ color: 0x8090a0, roughness: 0.05, transparent: true, opacity: 0.18, envMapIntensity: 2 })), geoAt(new THREE.PlaneGeometry(wx1 - wx0, wy1 - wy0), (wx0 + wx1) / 2, (wy0 + wy1) / 2, z0 - 0.12));
    sbox(M.wood, wx0, wx1, wy0 - 0.06, wy0, z0 - 0.3, z0 + 0.15, 1);
    sbox(M.wood, (wx0 + wx1) / 2 - 0.03, (wx0 + wx1) / 2 + 0.03, wy0, wy1, z0 - 0.14, z0 - 0.1, 1);
    // прихожая
    sbox(wp, hallX, hallX + 0.15, y, y + H, z0, 12.4, 2.5, true); sbox(wp, hallX, hallX + 0.15, y, y + H, 13.8, z1, 2.5, true); sbox(wp, hallX, hallX + 0.15, y + 2.15, y + H, 12.4, 13.8, 2.5);
    sbox(wp, 3.2, hallX, y, y + H, 11.4, 11.55, 2.5, true); sbox(wp, 3.2, hallX, y, y + H, 14.8, 14.95, 2.5, true);
    sbox(wp, 3.25, 3.35, y, y + H, 11.4, 12.6, 2.5); sbox(wp, 3.25, 3.35, y, y + H, 13.6, 14.95, 2.5);
    sbox(M.wood, 2.99, 3.26, y - 0.2, y + 0.01, 12.6, 13.6, 1);   // порог
    sbox(M.doorW || (M.doorW = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.5 })), 4.02, 4.78, y, y + 2.0, 14.75, 14.8, 1);
    sbox(M.doorW, 4.02, 4.78, y, y + 2.0, 11.55, 11.6, 1);
    // дверь квартиры (на петлях, открывается внутрь)
    const dp = new THREE.Group(); dp.position.set(3.05, y, 12.6); scene.add(dp);
    const dl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.15, 1.0), M.leather); dl.position.set(0, 1.08, 0.5); dp.add(dl);
    OBJ.doorNumber(a.n, 2.985, y + 1.75, 13.1, -Math.PI / 2);
    addGeo(M.metal, geoAt(new THREE.SphereGeometry(0.035, 8, 6), 2.96, y + 1.0, 13.45));
    const col = { x0: 2.95, x1: 3.3, y0: y, y1: y + 2.2, z0: 12.55, z1: 13.65 }; COL.push(col);
    a.door = { piv: dp, open: 0, col, pos: V(2.7, y + 1.2, 13.1), posIn: V(3.6, y + 1.2, 13.1) };
    a.y = y;
    // шкаф — в нём можно спрятаться
    sbox(M.wood, WARD.x0, WARD.x1, y, y + 2.1, WARD.z0, WARD.z1, 1, true);
    sbox(M.dark, WARD.x0 - 0.01, WARD.x0, y + 0.1, y + 2.0, 11.79, 11.81, 1);
    a.ward = V(8.3, y + 1.2, 11.8);
    // свет
    const chand = new THREE.Group(); chand.position.set(7.4, y + H - 0.05, 13.6); scene.add(chand);
    addTo(chand, new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5), M.dark)).position.y = -0.25;
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a5a30, side: THREE.DoubleSide, roughness: 0.6 })); shade.position.y = -0.4; shade.rotation.x = Math.PI; chand.add(shade);
    const cb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.bulbOff); cb.position.y = -0.5; chand.add(cb);
    a.chand = lamp(V(7.4, y + 2.1, 13.6), 0xffc890, 11, 10, { inside: true, mesh: cb, onMat: M.bulb, on: false });
    const hb = mesh(new THREE.SphereGeometry(0.06, 8, 6), M.bulbOff, 4.3, y + H - 0.1, 13.1);
    a.hall = lamp(V(4.3, y + 2.5, 13.1), 0xffd8a8, 7, 7, { inside: true, mesh: hb, onMat: M.bulb, on: false });
    const tv = (on) => { sbox(M.wood, 6.4, 7.6, y, y + 0.55, 11.0, 11.5, 1, true); sbox(M.tvBody || (M.tvBody = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 })), 6.55, 7.45, y + 0.55, y + 1.2, 11.05, 11.6, 1); const scr = mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x8090a0, emissiveIntensity: on ? 1.4 : 0, roughness: 0.1, emissiveMap: canvasTex(64, 64, (g, w, h, R) => { for (let i = 0; i < 700; i++) { const v = R() * 255 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * w, R() * h, 2, 2); } }) }), 7.0, y + 0.88, 11.61); return scr; };
    if (a.kind === 'home') {
      sbox(M.fabric, 6.0, 8.6, y, y + 0.45, 15.5, 16.35, 1, true); sbox(M.fabric, 6.0, 8.6, y + 0.45, y + 1.0, 16.1, 16.35, 1); sbox(M.fabric, 5.95, 6.15, y + 0.45, y + 0.7, 15.5, 16.35, 1); sbox(M.fabric, 8.45, 8.65, y + 0.45, y + 0.7, 15.5, 16.35, 1);
      addGeo(M.carpet, geoAt(new THREE.PlaneGeometry(2.6, 1.8), 7.5, y + 1.6, 16.37, Math.PI));
      OBJ.tv27 = tv(false);
      OBJ.bathLight = mesh(new THREE.PlaneGeometry(0.72, 0.04), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff0d0, emissiveIntensity: 0 }), 4.4, y + 0.02, 14.74); OBJ.bathLight.rotation.x = -Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.03, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: 0xe8e4d8 }), 3.36, y + 1.35, 12.3);
      OBJ.switch = V(3.45, y + 1.35, 12.3);
      sbox(M.wood, 3.4, 3.6, y + 1.6, y + 1.7, 13.9, 14.7, 1);
      const mir = mesh(new THREE.PlaneGeometry(0.5, 1.0), new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.02, metalness: 1, envMapIntensity: 2 }), 5.38, y + 1.5, 12.0); mir.rotation.y = -Math.PI / 2;
    }
    if (a.kind === 'tv') {   // кв. 9: телевизор шипит, кресло, недоеденный ужин
      a.tvScr = tv(true);
      lamp(V(7.0, y + 1.1, 12.2), 0x8090c0, 10, 6, { inside: true, flick: 1 });
      sbox(M.fabric, 6.6, 7.5, y, y + 0.5, 13.6, 14.4, 1, true); sbox(M.fabric, 6.6, 7.5, y + 0.5, y + 1.15, 14.25, 14.45, 1);
      sbox(M.wood, 5.8, 6.6, y, y + 0.72, 15.2, 16.2, 1, true);
      for (let i = 0; i < 3; i++) addGeo(M.ceilingW, geoAt(new THREE.CylinderGeometry(0.12, 0.1, 0.03, 14), 6.0 + i * 0.25, y + 0.74, 15.6 + (i % 2) * 0.3));
    }
    if (a.kind === 'old') {   // кв. 18: темно, свечи, кровать, на столе — трёхгранник
      sbox(M.fabric, 6.2, 8.4, y, y + 0.55, 14.6, 16.35, 1, true); sbox(M.ceilingW, 6.25, 8.35, y + 0.55, y + 0.62, 14.65, 16.3, 1);
      sbox(M.wood, 6.4, 7.4, y, y + 0.75, 11.2, 12.0, 1, true);
      const candle = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 8), M.ceilingW, 6.6, y + 0.83, 11.5);
      const fl = mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffa040, emissiveIntensity: 8 }), 6.6, y + 0.93, 11.5);
      lamp(V(6.6, y + 1.1, 11.6), 0xff9040, 5, 6, { inside: true, flick: 1, mesh: fl, onMat: fl.material });
      a.item = V(7.1, y + 0.8, 11.6);
      OBJ.triMesh = mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), M.metal, 7.1, y + 0.77, 11.6); OBJ.triMesh.rotation.y = 0.4;
      // фотографии на стене
      for (let i = 0; i < 4; i++) addGeo(M.photo || (M.photo = new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTex(64, 80, (g, w, h, R) => { g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#4a4440'; g.fillRect(6, 6, w - 12, h - 20); g.fillStyle = '#1a1612'; g.beginPath(); g.arc(w / 2, 34, 12, 0, 7); g.fill(); g.fillRect(w / 2 - 14, 46, 28, 22); }) })), geoAt(new THREE.PlaneGeometry(0.3, 0.38), 6.2 + i * 0.6, y + 1.7 + (i % 2) * 0.2, 16.37, Math.PI));
    }
  }

  // ---------- будка вахтёрши в тамбуре ----------
  function buildBooth() {
    const bx0 = 1.2, bx1 = 3, bz0 = 10.2, bz1 = 11.8;
    const panel = new THREE.MeshStandardMaterial({ color: 0x6a5038, roughness: 0.55, map: T.wood });
    sbox(panel, bx0, bx0 + 0.08, 0, 0.95, bz0, bz1, 1); sbox(panel, bx0, bx0 + 0.08, 2.15, 2.8, bz0, bz1, 1);
    sbox(panel, bx0, bx1, 0, 2.8, bz1 - 0.06, bz1, 1);
    addGeo(M.aptGlass || (M.aptGlass = new THREE.MeshPhysicalMaterial({ color: 0x8090a0, roughness: 0.05, transparent: true, opacity: 0.18, envMapIntensity: 2 })), geoAt(new THREE.PlaneGeometry(1.6, 1.2), bx0 + 0.04, 1.55, (bz0 + bz1) / 2, -Math.PI / 2));
    COL.push({ x0: bx0, x1: bx1, y0: -1, y1: 3, z0: bz0, z1: bz1 });
    sbox(M.wood, bx0 + 0.1, bx0 + 0.6, 0.8, 0.85, bz0 + 0.1, bz1 - 0.1, 1);   // стол
    const lampG = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x80ff90, emissiveIntensity: 2 }), bx0 + 0.35, 1.05, bz0 + 0.3);
    OBJ.boothLamp = lamp(V(bx0 + 0.4, 1.2, bz0 + 0.4), 0xb0ffb0, 3, 4, { inside: true, mesh: lampG, onMat: lampG.material });
    // доска с ключами
    sbox(M.wood, bx0 + 0.6, bx0 + 1.4, 1.2, 1.8, bz0 + 0.02, bz0 + 0.06, 1);
    OBJ.keyMesh = mesh(new THREE.BoxGeometry(0.03, 0.1, 0.02), new THREE.MeshStandardMaterial({ color: 0xd0b050, roughness: 0.3, metalness: 0.9 }), bx0 + 0.9, 1.45, bz0 + 0.09);
    OBJ.booth = V(bx0 - 0.2, 1.3, 10.6);
  }

  // ============ МОНСТРЫ (модели) ============
  // общий скелет: бёдра → корпус → шея → голова, руки и ноги из двух звеньев (для анимации ходьбы)
  function rig(o) {
    const root = new THREE.Group();
    const hips = new THREE.Group(); hips.position.y = o.hip; root.add(hips);
    const spine = new THREE.Group(); hips.add(spine);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(o.tw, o.th, 6, 12), o.top); torso.position.y = o.th / 2 + o.tw * 0.6; torso.scale.set(1, 1, o.td || 0.7); spine.add(torso);
    const neck = new THREE.Group(); neck.position.y = o.th + o.tw * 1.2; spine.add(neck);
    addTo(neck, new THREE.Mesh(new THREE.CylinderGeometry(o.nw || 0.05, o.nw || 0.06, o.nl || 0.14, 8), o.skin)).position.y = (o.nl || 0.14) / 2;
    const head = new THREE.Group(); head.position.y = (o.nl || 0.14); neck.add(head);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(o.hr || 0.13, 24, 16), o.face || o.skin); hm.position.y = (o.hr || 0.13); hm.scale.set(0.9, 1.15, 0.95); head.add(hm);
    const limb = (parent, x, y, l1, l2, r, mat, matB) => {
      const a = new THREE.Group(); a.position.set(x, y, 0); parent.add(a);
      const s1 = new THREE.Mesh(new THREE.CapsuleGeometry(r, l1, 4, 8), mat); s1.position.y = -l1 / 2; a.add(s1);
      const b = new THREE.Group(); b.position.y = -l1; a.add(b);
      const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.85, l2, 4, 8), matB || mat); s2.position.y = -l2 / 2; b.add(s2);
      const end = new THREE.Group(); end.position.y = -l2; b.add(end);
      return { a, b, end };
    };
    const legs = [-1, 1].map(s => limb(hips, s * (o.lw || 0.1), 0, o.ll1, o.ll2, o.lr || 0.07, o.pants, o.pants));
    const arms = [-1, 1].map(s => limb(spine, s * (o.tw + 0.06), o.th + o.tw * 0.7, o.al1, o.al2, o.ar || 0.05, o.sleeve || o.skin, o.skin));
    root.userData = { hips, spine, neck, head, hm, legs, arms, torso };
    return root;
  }
  const finish = (r) => { r.traverse(m => { if (m.isMesh) m.castShadow = HIGH; }); return r; };
  // лицо на сфере головы: центр лица — четверть ширины текстуры (там «перед» сферы)
  const faceTex = (bg, draw) => canvasTex(256, 128, (g, w, h, R) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.08})`; g.fillRect(R() * w, R() * h, 2, 2); } g.save(); g.translate(64, 0); draw(g, R); g.restore(); });
  // пальцы: тонкие длинные цилиндры на кисти
  const fingers = (end, mat, len, n = 4) => { for (let i = 0; i < n; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, len, 5), mat); f.position.set((i - (n - 1) / 2) * 0.022, -len / 2 - 0.02, 0.01); f.rotation.x = 0.15 + i * 0.05; end.add(f); } };
  function walk(m, sp) {
    const U = m.mesh.userData, a = m.anim, k = Math.min(1, sp / 2);
    U.legs.forEach((l, i) => { const ph = Math.sin(a + i * Math.PI); l.a.rotation.x = ph * 0.6 * k; l.b.rotation.x = Math.max(0, -Math.cos(a + i * Math.PI)) * 0.8 * k; });
    U.arms.forEach((ar, i) => { ar.a.rotation.x = -Math.sin(a + i * Math.PI) * 0.45 * k + (U.armBase || 0); ar.b.rotation.x = -0.25 + (U.foreBase || 0); });
  }
  const MON = {};
  function buildMonsters() {
    // МОКРЫЙ (Миша): утопленник. Серо-синяя мокрая кожа, мокрые чёрные волосы до груди, рваная рубашка, длинные пальцы, с него капает
    {
      const skin = new THREE.MeshPhysicalMaterial({ color: 0x6a7478, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
      const face = new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 1, map: faceTex('#8a969a', (g) => {
        g.fillStyle = 'rgba(40,60,80,.5)'; for (let i = 0; i < 12; i++) { g.fillRect(-40 + i * 7, 20 + (i % 3) * 30, 1, 40); }
        for (const x of [-15, 15]) { g.fillStyle = '#050608'; g.beginPath(); g.ellipse(x, 56, 10, 13, 0, 0, 7); g.fill(); g.fillStyle = '#c8d8e8'; g.beginPath(); g.arc(x, 58, 2, 0, 7); g.fill(); }
        g.fillStyle = '#0a0606'; g.beginPath(); g.ellipse(0, 92, 9, 17, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(30,40,60,.6)'; g.lineWidth = 1.5; for (const x of [-30, 30]) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x * 0.8, 100); g.stroke(); }
      }) });
      const cloth = new THREE.MeshPhysicalMaterial({ color: 0x14181a, roughness: 0.4, clearcoat: 0.6, side: THREE.DoubleSide });
      const r = rig({ hip: 0.95, tw: 0.14, th: 0.58, td: 0.6, top: cloth, skin, face, pants: cloth, sleeve: cloth, al1: 0.5, al2: 0.6, ll1: 0.46, ll2: 0.5, hr: 0.12, nl: 0.08, ar: 0.042, lr: 0.06 });
      const U = r.userData; U.spine.rotation.x = 0.28; U.neck.rotation.x = 0.35; U.head.rotation.z = 0.18;
      const hairM = new THREE.MeshPhysicalMaterial({ color: 0x020203, roughness: 0.15, clearcoat: 1, side: THREE.DoubleSide });
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2, len = 0.45 + Math.random() * 0.4, front = Math.sin(a) > 0;
        if (front && Math.abs(Math.cos(a)) < 0.5 && i % 2) continue;   // между прядями видно лицо
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, len, 0.012), hairM);
        s.position.set(Math.cos(a) * 0.1, 0.24 - len / 2, Math.sin(a) * 0.1 + (front ? 0.03 : 0)); s.rotation.y = -a + Math.PI / 2; s.rotation.x = front ? 0.12 : -0.05; U.head.add(s);
      }
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 10, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.5), hairM); cap.position.y = 0.15; U.head.add(cap);
      for (let i = 0; i < 7; i++) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.25 + Math.random() * 0.2), cloth); const a = (i / 7) * Math.PI * 2; st.position.set(Math.cos(a) * 0.15, -0.12, Math.sin(a) * 0.1); st.rotation.y = -a + Math.PI / 2; U.spine.add(st); }
      for (const arm of U.arms) fingers(arm.end, skin, 0.17);
      for (const x of [-0.045, 0.045]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xc0e0ff, emissiveIntensity: 2.5 })); e.position.set(x, 0.16, 0.108); U.head.add(e); }
      // капли
      const dg = new THREE.BufferGeometry(); const dp = new Float32Array(16 * 3); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      const drops = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x9ab8d0, size: 0.03, transparent: true, opacity: 0.8 })); drops.frustumCulled = false; r.add(drops);
      U.drops = drops; U.dropV = Array.from({ length: 16 }, () => [(Math.random() - 0.5) * 0.4, Math.random() * 1.8, (Math.random() - 0.5) * 0.3]);
      U.armBase = -0.15; U.foreBase = -0.2;
      scene.add(finish(r)); r.visible = false;
      MON.wet = { k: 'wet', name: 'Мокрый', mesh: r, pos: V(), yaw: 0, path: [], state: 'off', timer: 0, anim: 0, speedNow: 0, vis: false, lastSeen: null, burn: 0 };
    }
    // СОСЕД С 10 ЭТАЖА: высокий, худой, лысый, в грязной майке и пижамных штанах. Огромные чёрные глаза, улыбка до ушей, шея набок
    {
      const skin = new THREE.MeshStandardMaterial({ color: 0x9a9480, roughness: 0.6 });
      const face = new THREE.MeshStandardMaterial({ roughness: 0.55, map: faceTex('#a09a86', (g) => {
        g.strokeStyle = 'rgba(40,30,20,.5)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-40 + i * 4, 4); g.quadraticCurveTo(-30 + i * 10, -2, -20 + i * 12, 14); g.stroke(); }
        for (const x of [-17, 17]) { g.fillStyle = '#000'; g.beginPath(); g.arc(x, 54, 13, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x - 4, 50, 2.5, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,40,30,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(x, 56, 16, 0.2, Math.PI - 0.2); g.stroke(); }
        g.fillStyle = '#1a0606'; g.beginPath(); g.moveTo(-44, 82); g.quadraticCurveTo(0, 112, 44, 82); g.quadraticCurveTo(0, 96, -44, 82); g.fill();
        g.fillStyle = '#d8d0b0'; for (let x = -38; x <= 38; x += 5.5) { const yy = 84 + (1 - Math.abs(x) / 44) * 10; g.fillRect(x, yy - 4, 3.5, 6); }
        g.fillStyle = '#3a2a20'; g.fillRect(-4, 70, 2, 5); g.fillRect(2, 70, 2, 5);
      }) });
      const vest = new THREE.MeshStandardMaterial({ roughness: 0.85, map: canvasTex(64, 64, (g, w, h, R) => { g.fillStyle = '#c8c0a8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(${90 + R() * 40},60,30,${0.2 + R() * 0.3})`; g.beginPath(); g.arc(R() * w, R() * h, 3 + R() * 8, 0, 7); g.fill(); } }) });
      const pj = new THREE.MeshStandardMaterial({ roughness: 0.85, map: canvasTex(32, 64, (g, w, h) => { g.fillStyle = '#6a7a9a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a3a5a'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h); }) });
      const r = rig({ hip: 0.9, tw: 0.13, th: 0.5, top: vest, skin, face, pants: pj, al1: 0.42, al2: 0.5, ll1: 0.43, ll2: 0.47, hr: 0.11, nl: 0.3, nw: 0.033, ar: 0.035, lr: 0.055 });
      const U = r.userData; U.neck.rotation.z = 0.55; U.head.rotation.z = 0.3; U.spine.rotation.x = 0.12;
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), skin); ear.scale.set(0.5, 1.2, 1); ear.position.set(s * 0.1, 0.12, 0); U.head.add(ear); }
      for (const leg of U.legs) addTo(leg.end, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.9 }))).position.set(0, -0.03, 0.05);
      for (const arm of U.arms) fingers(arm.end, skin, 0.15);
      U.armBase = 0.05;
      scene.add(finish(r)); r.visible = false;
      MON.sosed = { k: 'sosed', name: 'Сосед с 10 этажа', mesh: r, pos: V(), yaw: 0, path: [], state: 'off', timer: 0, anim: 0, speedNow: 0, vis: false };
    }
    // ЛИФТЁР (Семёныч): сгорбленный, в синем комбинезоне и кепке. Вместо глаз — светящиеся точки, рот зашит. Правая рука до пола, на ней крюк
    {
      const skin = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.6 });
      const face = new THREE.MeshStandardMaterial({ roughness: 0.6, map: faceTex('#8a7a6a', (g) => {
        for (const x of [-15, 15]) { g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(x, 56, 11, 8, 0, 0, 7); g.fill(); }
        g.strokeStyle = '#1a0a0a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 86); g.lineTo(18, 86); g.stroke();
        g.lineWidth = 1.5; for (let x = -15; x <= 15; x += 5) { g.beginPath(); g.moveTo(x - 2, 80); g.lineTo(x + 2, 92); g.stroke(); }
        g.strokeStyle = 'rgba(40,20,10,.5)'; g.beginPath(); g.moveTo(-30, 30); g.lineTo(-10, 70); g.stroke();
      }) });
      const over = new THREE.MeshStandardMaterial({ color: 0x1e2a4a, roughness: 0.75 });
      const glove = new THREE.MeshStandardMaterial({ color: 0x2a2a20, roughness: 0.5 });
      const r = rig({ hip: 0.82, tw: 0.19, th: 0.5, top: over, skin, face, pants: over, sleeve: over, al1: 0.42, al2: 0.48, ll1: 0.4, ll2: 0.44, hr: 0.13 });
      const U = r.userData; U.spine.rotation.x = 0.5; U.neck.rotation.x = -0.4;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 14), over); cap.position.y = 0.25; U.head.add(cap);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), over); visor.position.set(0, 0.21, 0.15); U.head.add(visor);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffe0a0, emissiveIntensity: 6 })); e.position.set(s * 0.045, 0.145, 0.118); U.head.add(e); }
      U.arms[1].a.scale.y = 1.7;
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16, Math.PI * 1.3), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.9, roughness: 0.3 })); hook.position.y = -0.1; hook.rotation.y = Math.PI / 2; U.arms[1].end.add(hook);
      fingers(U.arms[0].end, glove, 0.1);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 14), new THREE.MeshStandardMaterial({ color: 0xa08a50, metalness: 0.8, roughness: 0.3 })); ring.position.set(0.16, 0.05, 0.12); U.hips.add(ring);
      for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.004), ring.material); k.position.set(0.16 + (i - 1.5) * 0.015, 0.0, 0.13); k.rotation.z = (i - 1.5) * 0.3; U.hips.add(k); }
      scene.add(finish(r)); r.visible = false;
      MON.lifter = { k: 'lifter', name: 'Лифтёр', mesh: r };
    }
    // ВАХТЁРША (Зинаида Петровна): сидит в будке в вязаной кофте и платке. Спит — с открытым ртом; проснётся — глаза навыкате и улыбка
    {
      const skin = new THREE.MeshStandardMaterial({ color: 0xc0a898, roughness: 0.6 });
      const fSleep = faceTex('#c0a898', (g) => {
        g.strokeStyle = '#3a2a20'; g.lineWidth = 2.5; for (const x of [-16, 16]) { g.beginPath(); g.arc(x, 52, 8, 0.2, Math.PI - 0.2); g.stroke(); }
        g.fillStyle = '#2a0a0a'; g.beginPath(); g.ellipse(0, 88, 8, 6, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(80,50,40,.6)'; g.lineWidth = 1; for (const y of [36, 40]) { g.beginPath(); g.moveTo(-26, y); g.lineTo(26, y); g.stroke(); }
        g.fillStyle = 'rgba(160,60,60,.3)'; for (const x of [-26, 26]) { g.beginPath(); g.arc(x, 74, 8, 0, 7); g.fill(); }
      });
      const fAwake = faceTex('#c0a898', (g) => {
        for (const x of [-16, 16]) { g.fillStyle = '#f0ece0'; g.beginPath(); g.arc(x, 52, 10, 0, 7); g.fill(); g.fillStyle = '#100808'; g.beginPath(); g.arc(x, 53, 2.6, 0, 7); g.fill(); g.strokeStyle = 'rgba(160,40,40,.6)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x - 10, 52 + i * 2 - 3); g.lineTo(x - 5, 53); g.stroke(); } }
        g.fillStyle = '#4a0a10'; g.beginPath(); g.moveTo(-28, 82); g.quadraticCurveTo(0, 104, 28, 82); g.quadraticCurveTo(0, 90, -28, 82); g.fill();
        g.fillStyle = '#e8e0c0'; for (let x = -22; x <= 22; x += 6) g.fillRect(x, 84 + (1 - Math.abs(x) / 28) * 4, 4, 5);
        g.strokeStyle = 'rgba(80,50,40,.7)'; g.lineWidth = 1.5; for (const y of [32, 37]) { g.beginPath(); g.moveTo(-26, y); g.lineTo(26, y); g.stroke(); }
      });
      const face = new THREE.MeshStandardMaterial({ roughness: 0.55, map: fSleep });
      const knit = new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTex(32, 32, (g, w, h) => { g.fillStyle = '#6a1a24'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y + 3); g.lineTo(x + 4, y); g.stroke(); } }) });
      const skirt = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
      const r = rig({ hip: 0.5, tw: 0.21, th: 0.48, top: knit, skin, face, pants: skirt, sleeve: knit, al1: 0.3, al2: 0.32, ll1: 0.42, ll2: 0.44, hr: 0.13 });
      const U = r.userData; U.faceSleep = fSleep; U.faceAwake = fAwake; U.faceMat = face;
      U.legs.forEach(l => { l.a.rotation.x = -1.5; l.b.rotation.x = 1.5; });
      const hairM = new THREE.MeshStandardMaterial({ color: 0xc8c8c4, roughness: 0.8 });
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), hairM); bun.position.set(0, 0.28, -0.07); U.head.add(bun);
      const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.133, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM); hairCap.position.y = 0.155; U.head.add(hairCap);
      for (const s of [-1, 1]) { const gl = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 })); gl.position.set(s * 0.047, 0.155, 0.122); U.head.add(gl); const ln = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 0.02, metalness: 0.5 })); ln.position.set(s * 0.047, 0.155, 0.125); U.head.add(ln); }
      const shawl = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3a5a, roughness: 0.95, side: THREE.DoubleSide })); shawl.position.y = 0.5; U.spine.add(shawl);
      r.position.set(2.45, 0, 11.0); r.rotation.y = -Math.PI / 2; scene.add(finish(r));
      sbox(M.wood, 2.25, 2.65, 0.4, 0.46, 10.8, 11.2, 1);   // стул
      MON.vah = { k: 'vah', name: 'Вахтёрша', mesh: r, state: 'sleep', timer: 30, yellCD: 0 };
    }
    // мокрые следы
    MON.prints = [];
    const pm = new THREE.MeshStandardMaterial({ color: 0x020304, roughness: 0.03, metalness: 0.4, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -3, envMapIntensity: 2 });
    for (let i = 0; i < 40; i++) { const g = new THREE.CircleGeometry(0.09, 10); g.scale(0.8, 1.7, 1); const m = new THREE.Mesh(g, pm.clone()); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData.t = 0; scene.add(m); MON.prints.push(m); }
    MON.printI = 0;
  }
  // капли с Мокрого (локальные координаты модели)
  function animDrops(dt) {
    const U = MON.wet.mesh.userData; if (!MON.wet.mesh.visible) return;
    const a = U.drops.geometry.attributes.position;
    U.dropV.forEach((d, i) => { d[1] -= dt * 3.2; if (d[1] < 0) { d[0] = (Math.random() - 0.5) * 0.4; d[1] = 0.8 + Math.random() * 1.0; d[2] = (Math.random() - 0.5) * 0.3; } a.setXYZ(i, d[0], d[1], d[2]); });
    a.needsUpdate = true;
  }

  function buildVan() {
    // фургон из первой главы: грузовой кузов сзади, спереди — настоящая кабина со стёклами, сиденьями и приборной панелью
    van = new THREE.Group(); scene.add(van);
    const paint = new THREE.MeshPhysicalMaterial({ color: 0xd4d0c4, roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });
    const stripe = new THREE.MeshPhysicalMaterial({ color: 0x8a1a1a, roughness: 0.4, clearcoat: 1 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.15, metalness: 1 });
    const plastic = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.6 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.75 });
    const seatM = new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(64, 64, (g, w, h, R) => { g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 2); } for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(90,70,50,${R() * 0.2})`; g.fillRect(R() * w, R() * h, 2, 2); } }) });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9ab0c0, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false });
    const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); van.add(o); return o; };
    // кузов (x −2.8…1.0) и капот (x 2.0…2.95)
    add(new RoundedBoxGeometry(3.85, 2.0, 2.05, 4, 0.16), paint, -0.88, 1.38, 0);
    add(new RoundedBoxGeometry(1.05, 1.0, 2.0, 4, 0.18), paint, 2.45, 0.9, 0);
    add(new THREE.BoxGeometry(5.04, 0.18, 2.08), stripe, -0.3, 1.05, 0);
    // кабина (x 1.0…2.2): пол, крыша, низ дверей, стойки — между ними стёкла
    add(new THREE.BoxGeometry(1.25, 0.1, 1.98), trim, 1.6, 0.62, 0);
    add(new RoundedBoxGeometry(1.3, 0.14, 2.05, 2, 0.05), paint, 1.6, 2.31, 0);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(1.2, 0.98, 0.06), paint, 1.6, 1.06, s * 0.995);   // низ двери
      add(new THREE.BoxGeometry(1.18, 0.95, 0.02), trim, 1.6, 1.06, s * 0.955);   // обшивка изнутри
      add(new THREE.BoxGeometry(0.08, 0.78, 0.07), paint, 1.04, 1.93, s * 0.995);   // средняя стойка
      add(new THREE.BoxGeometry(0.08, 0.78, 0.07), paint, 2.16, 1.93, s * 0.995);   // передняя стойка
      const w = add(new THREE.PlaneGeometry(1.06, 0.74), glass, 1.6, 1.93, s * 1.0); w.rotation.y = s > 0 ? 0 : Math.PI;
      add(new THREE.BoxGeometry(0.08, 0.2, 0.12), M.dark, 2.18, 1.72, s * 1.12);   // зеркало
    }
    // лобовое стекло наклонное и рама
    const ws = add(new THREE.PlaneGeometry(1.92, 0.82), glass, 2.12, 1.92, 0); ws.rotation.order = 'YXZ'; ws.rotation.y = Math.PI / 2; ws.rotation.x = -0.25;
    add(new THREE.BoxGeometry(0.1, 0.06, 2.0), paint, 2.2, 1.52, 0); add(new THREE.BoxGeometry(0.1, 0.06, 2.0), paint, 2.03, 2.3, 0);
    // перегородка между кабиной и кузовом
    add(new THREE.BoxGeometry(0.04, 1.65, 1.9), trim, 1.0, 1.45, 0);
    // приборная панель
    add(new THREE.BoxGeometry(0.42, 0.34, 1.9), plastic, 2.0, 1.3, 0);
    add(new THREE.BoxGeometry(0.2, 0.06, 1.9), plastic, 1.85, 1.46, 0);
    const clusterTex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#060606'; g.fillRect(0, 0, w, h);
      const gauge = (cx, cy, r, label, ang, red) => {
        g.strokeStyle = '#d8d0b8'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
        for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.8 + i * Math.PI * 1.4 / 8; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
        g.fillStyle = '#d8d0b8'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText(label, cx, cy + r * 0.55);
        g.strokeStyle = red ? '#ff3020' : '#ff9a30'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang) * r * 0.85, cy + Math.sin(ang) * r * 0.85); g.stroke();
      };
      gauge(80, 64, 46, 'км/ч', Math.PI * 0.8, false);
      gauge(190, 64, 40, 'Е     F', Math.PI * 0.82, true);   // бензин: стрелка на нуле
      g.fillStyle = '#ff2a10'; g.font = 'bold 11px Arial'; g.fillText('ТОПЛИВО', 190, 118);
    });
    const cl = add(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ color: 0x000000, map: clusterTex, emissive: 0xffffff, emissiveMap: clusterTex, emissiveIntensity: 0.35, roughness: 0.3 }), 1.79, 1.38, -0.45);
    cl.rotation.order = 'YXZ'; cl.rotation.y = -Math.PI / 2; cl.rotation.x = -0.35;
    van.userData.fuelLamp = add(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff2010, emissiveIntensity: 0 }), 1.78, 1.29, -0.33);
    // руль на колонке
    const wheel = new THREE.Group(); wheel.position.set(1.62, 1.38, -0.45); wheel.rotation.z = 0.5; van.add(wheel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 28), plastic); rim.rotation.y = Math.PI / 2; wheel.add(rim);
    for (const a of [0, 2.1, 4.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.03), plastic); sp.position.set(0, Math.cos(a) * 0.085, Math.sin(a) * 0.085); sp.rotation.x = -a; wheel.add(sp); }
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.42, 10), plastic); col.rotation.z = Math.PI / 2 - 0.5; col.position.set(1.82, 1.27, -0.45); van.add(col);
    // сиденья
    for (const z of [-0.45, 0.45]) {
      add(new RoundedBoxGeometry(0.5, 0.18, 0.5, 2, 0.05), seatM, 1.4, 0.98, z);
      const back = add(new RoundedBoxGeometry(0.14, 0.75, 0.5, 2, 0.05), seatM, 1.12, 1.45, z); back.rotation.z = -0.12;
      add(new RoundedBoxGeometry(0.1, 0.18, 0.3, 2, 0.04), seatM, 1.08, 1.92, z);
      add(new THREE.BoxGeometry(0.45, 0.3, 0.45), trim, 1.4, 0.75, z);
    }
    // мелочи: ключ в замке, иконка на панели
    add(new THREE.BoxGeometry(0.02, 0.06, 0.015), chrome, 1.78, 1.2, -0.2);
    add(new THREE.BoxGeometry(0.01, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.7, roughness: 0.3 }), 1.81, 1.47, 0.1);
    addTo(van, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 1.9), chrome)).position.set(2.97, 0.62, 0);   // бампер
    addTo(van, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 1.2), M.dark)).position.set(2.98, 1.05, 0);   // решётка
    const hlM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff4d8, emissiveIntensity: 3 }); const tlM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff1010, emissiveIntensity: 4 });
    van.userData.hl = [];
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), hlM); h.position.set(2.985, 1.05, s * 0.72); h.rotation.y = Math.PI / 2; van.add(h); van.userData.hl.push(h); const t = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.35), tlM); t.position.set(-2.81, 1.2, s * 0.85); t.rotation.y = -Math.PI / 2; van.add(t); }
    van.userData.wheels = [];
    for (const [x, z] of [[1.75, -0.95], [1.75, 0.95], [-1.85, -0.95], [-1.85, 0.95]]) {
      const w = new THREE.Group(); w.position.set(x, 0.42, z); van.add(w);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7 })); tire.rotation.x = Math.PI / 2; w.add(tire);
      const rimW = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 10), chrome); rimW.rotation.x = Math.PI / 2; w.add(rimW);
      van.userData.wheels.push(w);
    }
    // сдвижная дверь кузова справа (со стороны тротуара)
    vanDoor = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.75, 0.06, 2, 0.02), paint); vanDoor.position.set(0.3, 1.35, 1.04); van.add(vanDoor);
    addTo(van, new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.7, 0.02), M.black)).position.set(0.3, 1.35, 1.03);
    // фары — настоящий свет с тенями
    for (const s of [-1, 1]) {
      const sl = new THREE.SpotLight(0xfff0d0, 0, 70, 0.42, 0.45, 1.3); sl.position.set(3.0, 1.05, s * 0.72); sl.target.position.set(12, -1.2, s * 0.9); van.add(sl); van.add(sl.target);
      sl.castShadow = HIGH && s > 0; if (sl.castShadow) { sl.shadow.mapSize.set(1024, 1024); sl.shadow.bias = -0.0005; }
      headL.push(sl);
    }
    const tl = new THREE.PointLight(0xff2010, 0, 6, 2); tl.position.set(-3.1, 1.1, 0); van.add(tl); van.userData.tail = tl;
    van.traverse(o => { if (o.isMesh) { o.castShadow = HIGH && !o.material.transparent; o.receiveShadow = HIGH; } });
    // столкновение с фургоном (включается, когда он припаркован)
    COL.push(OBJ.vanCol = { x0: 0, x1: 0, y0: 99, y1: 99, z0: 0, z1: 0 });
    // водитель (наш герой) — выходит из фургона в конце заставки
    driver = makeKid(T, 0x2a5a9a, 'Ты'); const U = driver.userData; [U.tag, U.help, U.beam].forEach(o => o && (o.visible = false)); driver.visible = false; scene.add(driver);
  }
  const vanLocal = (x, y, z) => V(van.position.x + x, van.position.y + y, van.position.z + z);
  function parkVan() {
    van.position.set(-2.6, -0.15, 2.0); van.rotation.set(0, 0, 0);
    Object.assign(OBJ.vanCol, { x0: van.position.x - 2.85, x1: van.position.x + 3.0, y0: -1, y1: 2.4, z0: van.position.z - 1.08, z1: van.position.z + 1.08 });
  }
  function buildRain() {
    const N = LOW ? 1500 : 3200;
    rainPos = new Float32Array(N * 6);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xa8b8d0, transparent: true, opacity: 0.32, depthWrite: false }));
    rainLines.frustumCulled = false; rainLines.userData.drops = [];
    for (let i = 0; i < N; i++) rainLines.userData.drops.push([rand(-22, 22), rand(0, 22), rand(-22, 22), rand(16, 22)]);
    scene.add(rainLines);
    // брызги на земле
    const sc = document.createElement('canvas'); sc.width = sc.height = 32; const sg = sc.getContext('2d'); sg.strokeStyle = 'rgba(200,215,235,0.9)'; sg.lineWidth = 2; sg.beginPath(); sg.arc(16, 16, 12, 0, 7); sg.stroke();
    const stx = new THREE.CanvasTexture(sc);
    for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: stx, transparent: true, depthWrite: false, opacity: 0 })); m.rotation.x = -Math.PI / 2; m.userData.t = Math.random(); scene.add(m); splashes.push(m); }
  }
  function updateRain(dt, cp, inside) {
    rainLines.visible = !inside;
    for (const s of splashes) s.visible = !inside;
    if (inside) return;
    const d = rainLines.userData.drops, p = rainPos;
    for (let i = 0; i < d.length; i++) {
      const r = d[i]; r[1] -= r[3] * dt;
      if (r[1] < -0.2) { r[1] = rand(14, 22); r[0] = rand(-22, 22); r[2] = rand(-22, 22); }
      const x = cp.x + r[0], z = cp.z + r[2];
      // в доме дождя нет
      let y = r[1] + (cp.y > 10 ? cp.y - 8 : 0);
      if (z > 10 && z < 22 && x > -30 && x < 30 && y < 27.6) y = -999;
      if (PL.seat && Math.abs(x - van.position.x - 0.1) < 3.1 && Math.abs(z - van.position.z) < 1.15 && y < 2.9) y = -999;   // в кабине фургона сухо
      const o = i * 6; p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x - 0.08; p[o + 4] = y - 0.55; p[o + 5] = z;
    }
    rainLines.geometry.attributes.position.needsUpdate = true;
    for (const s of splashes) { s.userData.t += dt * 3; if (s.userData.t > 1) { s.userData.t = 0; const a = Math.random() * 6.28, rr = 1 + Math.random() * 14; s.position.set(cp.x + Math.cos(a) * rr, 0.01, cp.z + Math.sin(a) * rr); if (s.position.z > 10 && s.position.z < 22 && Math.abs(s.position.x) < 30) s.position.y = -50; if (Math.abs(s.position.z) < 4.5) s.position.y = -0.13; } const t = s.userData.t; s.scale.setScalar(0.3 + t * 1.2); s.material.opacity = (1 - t) * 0.3; }
  }

  // ============ свет: каждый кадр (раз в 0.12 с) — ближайшие лампы ============
  let lightT = 0, sel = [];
  function updateLights(dt, cp, inside) {
    lightT -= dt;
    const t = S.t;
    if (lightT <= 0) {
      lightT = 0.12;
      sel = LAMPS.filter(l => l.on && (inside ? l.inside || Math.abs(l.pos.z - 9.4) < 1.2 && Math.abs(l.pos.x) < 2 : !l.inside)).map(l => ({ l, s: l.pos.distanceTo(cp) + (inside ? Math.abs(l.pos.y - cp.y) * 3 : 0) })).sort((a, b) => a.s - b.s).slice(0, POOL.length).map(o => o.l);
    }
    POOL.forEach((pl, i) => {
      const l = sel[i]; if (!l) { pl.intensity = 0; return; }
      pl.position.copy(l.pos); pl.color.setHex(l.col); pl.distance = l.d;
      let k = 1;
      if (l.flick === 1) k = Math.random() < 0.04 ? 0.1 : 0.9 + Math.sin(t * 17 + i) * 0.1;
      if (l.flick === 2) k = (Math.sin(t * 3 + i) > 0.6) ? 0.15 : 1;
      if (l.flick === 3) k = Math.random() < 0.08 ? 0.2 : 1;
      pl.intensity = l.i * k;
      if (l.flick === 4) k = (t % 1.2) < 0.6 ? 1 : 0.03;
      if (l.flick === 5) k = (t % 0.8) < 0.4 ? 1 : 0.03;
      pl.intensity = l.i * k;
      if (l.mesh && l.flick && l.flick < 4) l.mesh.material = k > 0.5 ? l.onMat : l.offMat;
    });
    for (const l of BLINK) if (l.mesh) l.mesh.material = ((l.flick === 4 ? (t % 1.2) < 0.6 : (t % 0.8) < 0.4) && l.on) ? l.onMat : l.offMat;
    // конусы света и пар из люков
    if (OBJ.cones) OBJ.cones.visible = !inside;
    if (OBJ.steam) for (const s of OBJ.steam) { s.visible = !inside; s.userData.t += dt * 0.25; if (s.userData.t > 1) s.userData.t -= 1; const k = s.userData.t; s.position.set(s.userData.base.x + Math.sin(k * 6 + s.id) * 0.3, -0.1 + k * 2.6, s.userData.base.z); s.scale.setScalar(0.6 + k * 2.2); s.material.opacity = Math.sin(k * Math.PI) * 0.45; }
  }

  // ============ молния ============
  let boltT = 8, boltF = 0;
  function updateLightning(dt, inside) {
    boltT -= dt;
    if (boltT <= 0) { boltT = rand(12, 26); boltF = 0.45; sfx2.thunder(rand(0.1, 0.9)); }
    let k = 0;
    if (boltF > 0) { boltF -= dt; k = (boltF > 0.35 || (boltF > 0.12 && boltF < 0.22)) ? 1 : 0; }
    lightning.intensity = k * (inside ? 0.8 : 4.5);
    M.windowRain.emissiveIntensity = 0.25 + k * 3;
    skyMat.color.setScalar(1 + k * 2.5);
  }

  // ============ ЗАСТАВКА ============
  // кадры: время начала, положение камеры и машины — по раскадровке присланного ролика
  const CUT_LEN = 14.0;
  function carX(t) {
    if (t < 3.65) return -275 + t * 24;                       // проезд мимо камеры и ларька
    if (t < 4.9) return -170 + (t - 3.65) * 10;                 // крупно спереди
    if (t < 6.4) return -140 + (t - 4.9) * 16;                  // из-под красной арки
    if (t < 9.15) return -92 + (t - 6.4) * 10;                  // камера едет перед машиной
    const k = clamp((t - 9.15) / 1.9, 0, 1); return lerp(-32, -2.6, 1 - (1 - k) * (1 - k));   // подъезжает к дому и тормозит
  }
  function carSpeed(t) { return t < 3.65 ? 24 : t < 4.9 ? 10 : t < 6.4 ? 16 : t < 9.15 ? 10 : Math.max(0, 15.6 * (1 - (t - 9.15) / 1.9)); }
  function shot(t) {
    const cx = van.position.x;
    if (t < 1.4) return { p: V(-246, 0.45, 0.4), l: V(-300, 0.8, 1.4) };
    if (t < 1.65) return { p: V(-238.5, 0.85, -0.6), l: V(-238.5, 0.9, 6) };
    if (t < 2.15) { const k = (t - 1.65) / 0.5; return { p: V(-236.5, 0.9, 0.6), l: V(cx + 4, 1.0, 2), roll: 0.12 * (1 - k) }; }
    if (t < 3.65) return { p: V(-203.5, 1.45, -5.3), l: V(-150, 2.2, 1.2) };
    if (t < 4.9) return { p: V(cx + 6.2 - (t - 3.65) * 0.6, 0.6, 3.0), l: V(cx, 1.0, 1.8) };
    if (t < 5.1) return { p: V(-100, 1.1, 0.9), l: V(-160, 2.5, 1.5) };
    if (t < 6.4) { const k = (t - 5.1) / 1.3; return { p: V(-104, 0.5, 1.0), l: V(cx, 1.0 + k * 0.2, 2 + k * 0.6) }; }
    if (t < 9.15) return { p: V(cx + 9, 1.15, 1.7), l: V(cx, 1.2, 2.0) };
    if (t < 11.4) return { p: V(14, 1.8, -6.5), l: V(-1.5, 5.5 + (t - 9.15) * 0.6, 9) };
    return { p: V(1.6, 1.65, 8.4), l: V(-2.5, 1.2, 2.5) };
  }
  function updateCut(dt) {
    S.cutT += dt;
    const t = S.cutT;
    van.position.set(carX(t), -0.15, 2.0);
    const sp = carSpeed(t); for (const w of van.userData.wheels) w.rotation.z -= sp * dt / 0.42;
    const on = t < 12.0;
    headL.forEach(l => l.intensity = on ? 150 : 0); van.userData.hl.forEach(h => h.material.emissiveIntensity = on ? 3 : 0.2); van.userData.tail.intensity = on ? 3 : 0;
    // в конце: дверь отъезжает, герой выходит и идёт к подъезду
    const door = clamp((t - 12.2) / 0.6, 0, 1); vanDoor.position.x = 0.3 - door * 1.25; vanDoor.position.z = 1.04 + Math.min(door * 4, 1) * 0.08;
    if (t > 12.7) {
      driver.visible = true; const k = clamp((t - 12.7) / 1.3, 0, 1);
      driver.position.set(van.position.x + 0.3 + k * 1.6, 0, 2.9 + k * 2.4); driver.rotation.y = 0.55;
      const U = driver.userData, a = t * 9;
      U.legs.forEach((l, i) => { l.a.rotation.x = Math.sin(a + i * Math.PI) * 0.5; l.b.rotation.x = Math.max(0, Math.sin(a + i * Math.PI)) * 0.6; });
      U.arms.forEach((ar, i) => { ar.a.rotation.x = -Math.sin(a + i * Math.PI) * 0.4; });
    }
    const s = shot(t);
    cam.position.copy(s.p); cam.lookAt(s.l); if (s.roll) cam.rotation.z += s.roll;
    cam.fov = t < 1.4 ? 58 : t > 9.15 && t < 11.4 ? 50 : 62; cam.updateProjectionMatrix();
    if (t > 13.2 && !S.titled) { S.titled = true; showFade('ГЛАВА 2', 'КВАРТИРА'); }
    if (t > CUT_LEN + 1.6) endCut();
  }
  function endCut() {
    S.mode = 'play'; hideFade(); document.body.classList.remove('ch2cut');
    $('ch2skip').classList.add('hidden'); stopTracks();
    driver.visible = false; vanDoor.position.set(-0.95, 1.35, 1.12);
    parkVan(); headL.forEach(l => l.intensity = 0); van.userData.hl.forEach(h => h.material.emissiveIntensity = 0.2); van.userData.tail.intensity = 0;
    const me = RP.get(myId), i = me ? me.idx : 0;
    PL.pos.set(-0.6 + (i % 2) * 1.2, 0, 5.4 + ((i / 2) | 0) * 0.9); PL.y = 0; P.yaw = Math.PI - 0.1; P.pitch = 0.08; cam.fov = 70; cam.updateProjectionMatrix();
    toast('Подъезд 3. Ключ от квартиры, как всегда, в почтовом ящике' + (ST.boom ? '. У двери — обрывок газеты' : ''), 4.5);
  }


  // ============ ИГРОКИ ============
  const PL = { pos: V(), y: 0, bob: 0, stepT: 0, moving: false, hidden: -1, hideAt: -99, sprint: false, seat: false };
  const RP = new Map();   // id → { id, name, color, idx, local, pos, yaw, pitch, crouch, light, hidden, lives, ghost, moving, av }
  let myId = 'me';
  const isHost = () => !Net || Net.role !== 'client';
  const MPON = () => RP.size > 1;
  function setupPlayers(list) {
    for (const p of RP.values()) if (p.av) scene.remove(p.av);
    RP.clear();
    myId = ctx.myId ? ctx.myId() : 'me';
    for (const it of list) {
      const p = { id: it.id, name: it.name, color: it.color, idx: it.idx, local: it.id === myId, pos: V(-0.6 + (it.idx % 2) * 1.2, 0, 5.4), yaw: Math.PI, pitch: 0, crouch: false, light: false, hidden: -1, lives: list.length > 1 ? 2 : DF().lives, ghost: false, moving: 0, hideAt: -99, av: null };
      if (!p.local) { p.av = makeKid(T, it.color, it.name); scene.add(p.av); p.av.userData.help.visible = false; }
      RP.set(it.id, p);
    }
    if (!RP.has(myId)) RP.set(myId, { id: myId, name: 'Ты', color: 0x2a5a9a, idx: 0, local: true, pos: V(), yaw: 0, pitch: 0, lives: 3, ghost: false, hidden: -1 });
  }
  const me = () => RP.get(myId);
  // высота пола под точкой (лестница — по маршам, квартиры — по этажам)
  function stairY(x, z, y) {
    const { zv, zl, zm, FH } = B;
    const pick = (base, fmin, fmax) => { const f = Math.round((y - base) / FH); if (f < fmin || f > fmax) return null; const v = f * FH + base; return Math.abs(v - y) < 0.75 ? v : null; };
    if (z < zv) return Math.abs(y) < 0.75 ? 0 : null;
    if (z < zl) return pick(0, 0, 8);
    if (z < zm) { const t = (z - zl) / (zm - zl); return x < 0 ? pick(1.5 * t, 0, 7) : pick(3 - 1.5 * t, 0, 7); }
    return pick(1.5, 0, 7);
  }
  function surfY(x, z, y) {
    if (x > B.x0 && x < B.x1 && z > B.zf + 0.1 && z < B.zb) return stairY(x, z, y);
    if (x >= B.x1 && x < APT.x1 && z > APT.z0 && z < APT.z1) { for (const a of APTS) if (Math.abs(y - a.f * B.FH) < 0.9) return a.f * B.FH; return null; }
    if (y > 2) return null;
    return Math.abs(z) < 4.5 ? -0.15 : 0;
  }
  function hitCol(x, z, y, r) {
    for (const c of COL) { if (y + 1.6 < c.y0 || y + 0.3 > c.y1) continue; if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return true; }
    return false;
  }
  function freeAt(x, z, y, r = 0.28) {
    if (x < -60 || x > 60 || z < -12 || z > 22) return null;
    let ny = null;
    for (const [ox, oz] of [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r]]) { const s = surfY(x + ox, z + oz, y); if (s === null) return null; if (ox === 0 && oz === 0) ny = s; }
    if (hitCol(x, z, ny, r)) return null;
    return ny;
  }
  function updatePlayer(dt) {
    if (PL.hidden >= 0 || S.caught || PL.seat) { PL.moving = false; return; }
    let mx = joy.x, mz = joy.y;
    if (keys.KeyW) mz -= 1; if (keys.KeyS) mz += 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    const m = Math.min(1, Math.hypot(mx, mz));
    const sprint = !P.crouch && ((m > 0.95 && Math.hypot(joy.x, joy.y) > 0.95) || keys.ShiftLeft);
    PL.sprint = sprint && m > 0.05;
    const speed = P.crouch ? 1.4 : sprint ? 4.4 : 2.7;
    if (m > 0.05) {
      const l = Math.hypot(mx, mz); mx /= l; mz /= l;
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      const vx = (fx * -mz + rx * mx) * speed * m * dt, vz = (fz * -mz + rz * mx) * speed * m * dt;
      const p = PL.pos;
      const stuck = hitCol(p.x, p.z, p.y, 0.2);   // застрял в закрывшейся двери — выпускаем
      const fa = (x, z, y) => stuck ? surfY(x, z, y) : freeAt(x, z, y);
      let y = fa(p.x + vx, p.z, p.y); if (y !== null) { p.x += vx; p.y = y; }
      y = fa(p.x, p.z + vz, p.y); if (y !== null) { p.z += vz; p.y = y; }
      PL.bob += dt * (sprint ? 13 : 9);
      PL.stepT -= dt * speed; if (PL.stepT <= 0) { PL.stepT = 1.9; sfx2.step(P.crouch); if (!me().ghost) emitNoise(PL.pos, sprint ? 9 : P.crouch ? 0 : 2.5); }
    }
    PL.y += (PL.pos.y - PL.y) * Math.min(1, dt * 14);
    PL.moving = m > 0.05;
  }
  function placeCam() {
    if (S.caught) return;
    if (PL.seat) { cam.position.copy(vanLocal(1.36, 1.83, -0.45)); cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); flash.intensity = P.light ? 28 * flashK() : 0; return; }
    if (PL.hidden >= 0) { const a = APTS[PL.hidden]; cam.position.set(8.95, a.y + 1.5, 11.8); cam.rotation.set(P.pitch * 0.3, Math.PI / 2 + clamp(P.yaw - Math.PI / 2, -0.4, 0.4), 0, 'YXZ'); flash.intensity = 0; return; }
    const eye = P.crouch ? 1.0 : 1.62;
    cam.position.set(PL.pos.x, PL.y + eye + (PL.moving ? Math.sin(PL.bob) * 0.035 : 0), PL.pos.z);
    cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    flash.intensity = P.light ? 28 * flashK() : 0;
  }
  // аватары других игроков
  function animAvatars(dt) {
    for (const p of RP.values()) {
      if (p.local || !p.av) continue;
      const av = p.av, U = av.userData;
      av.visible = p.hidden < 0 && (!p.ghost || me().ghost);
      if (av.position.distanceTo(p.pos) > 3) av.position.copy(p.pos); else av.position.lerp(p.pos, Math.min(1, dt * 10));
      av.rotation.y = p.yaw + Math.PI;
      p.anim = (p.anim || 0) + (p.moving ? dt * 9 : 0);
      const s = p.moving ? Math.sin(p.anim) : 0;
      U.legs.forEach((l, i) => { l.a.rotation.x = (i ? -s : s) * 0.6 + (p.crouch ? -0.9 : 0); l.b.rotation.x = p.crouch ? 1.6 : Math.max(0, (i ? s : -s)) * 0.6; });
      U.hips.position.y = p.crouch ? 0.5 : 0.82;
      U.arms[1].a.rotation.x = -1.2 - p.pitch * 0.6; U.beam.visible = !!p.light;
      U.tag.visible = true;
    }
  }

  // ============ СЕТЬ ============
  // хозяин игры считает монстров, двери, предметы и сюжет; остальные шлют позы и действия и рисуют то, что пришло
  let netT = 0;
  function send(o, rel = true, to = null) { if (Net && Net.role !== 'single') Net.send(o, rel, to); }
  function netTick(dt) {
    if (!Net || Net.role === 'single') return;
    netT -= dt; if (netT > 0) return;
    if (Net.role === 'client') { netT = 1 / 15; const p = me(); send({ t: 'c2p', a: [r2(PL.pos.x), r2(PL.pos.y), r2(PL.pos.z), r2(P.yaw), r2(P.pitch), P.crouch ? 1 : 0, P.light ? 1 : 0, PL.hidden, PL.moving ? 1 : 0, r2(PL.hideAt)] }, false); return; }
    netT = 0.1;
    const mp = (m) => m ? [r2(m.pos.x), r2(m.pos.y), r2(m.pos.z), r2(m.yaw), m.vis ? 1 : 0, m.state, r2(m.speedNow || 0)] : 0;
    send({ t: 'c2s', st: ST, w: mp(MON.wet), s: mp(MON.sosed), lf: [r2(LF.y), r2(LF.open), LF.lifter ? 1 : 0, LF.f], vh: MON.vah.state,
      pl: [...RP.values()].map(p => [p.id, r2(p.pos.x), r2(p.pos.y), r2(p.pos.z), r2(p.yaw), r2(p.pitch), p.crouch ? 1 : 0, p.light ? 1 : 0, p.hidden, p.lives, p.ghost ? 1 : 0, p.moving ? 1 : 0]) }, false);
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  function onNet(m, from) {
    if (!S.on) { if (m.t === 'c2go') return; return; }
    if (isHost()) {
      const p = RP.get(from); if (!p) return;
      if (m.t === 'c2p') { const a = m.a; p.pos.set(a[0], a[1], a[2]); p.yaw = a[3]; p.pitch = a[4]; p.crouch = !!a[5]; p.light = !!a[6]; if (a[7] >= 0 && p.hidden < 0) p.hideAt = S.t; p.hidden = a[7]; p.moving = a[8]; }
      if (m.t === 'c2a') doAction(from, m.k, m.arg);
      if (m.t === 'c2n') hostNoise(V(...m.p), m.r, from);
      return;
    }
    switch (m.t) {
      case 'c2s': {
        const was = JSON.stringify(ST.doors), wasPh = ST.ph;
        Object.assign(ST, m.st);
        if (wasPh !== ST.ph && ST.ph === 'night') nightFx();
        applyState();
        if (ST.seq && !EV.seq && ST.ph === 'intro') figureSeq();
        placeStory();
        for (const [k, a] of [['wet', m.w], ['sosed', m.s]]) { const mo = MON[k]; if (!a) continue; mo.tgt = mo.tgt || V(); mo.tgt.set(a[0], a[1], a[2]); if (!mo.vis && a[4]) mo.pos.copy(mo.tgt); mo.tyaw = a[3]; mo.vis = !!a[4]; mo.state = a[5]; mo.speedNow = a[6]; }
        LF.ty = m.lf[0]; LF.open = m.lf[1]; LF.lifter = !!m.lf[2]; LF.f = m.lf[3];
        MON.vah.state = m.vh;
        for (const a of m.pl) { const p = RP.get(a[0]); if (!p) continue; p.lives = a[9]; const gh = !!a[10]; if (p.local) { if (gh && !p.ghost) becomeGhost(); p.ghost = gh; continue; } p.ghost = gh; p.pos.set(a[1], a[2], a[3]); p.yaw = a[4]; p.pitch = a[5]; p.crouch = !!a[6]; p.light = !!a[7]; p.hidden = a[8]; p.moving = a[11]; }
        break;
      }
      case 'c2c': { const p = me(); p.lives = m.l; p.ghost = !!m.g; localCaught(m.who); break; }
      case 'c2fx': playFx(m.n, m.p ? V(...m.p) : null, m.x); break;
      case 'c2t': toast(m.text, m.dur || 3); break;
      case 'c2win': winSeq(); break;
      case 'c2doc': showDoc(m.d, m.a); break;
      case 'c2over': overSeq(m.who); break;
    }
  }
  function fxTo(pid, n) { if (pid === myId) playFx(n); else send({ t: 'c2fx', n }, true, pid); }
  function fxAll(n, p, x) { playFx(n, p, x); send({ t: 'c2fx', n, p: p ? [r2(p.x), r2(p.y), r2(p.z)] : null, x }, true); }
  function toastTo(pid, text, dur = 3) { if (pid === myId) toast(text, dur); else send({ t: 'c2t', text, dur }, true, pid); }
  function toastAll(text, dur = 3.5) { toast(text, dur); send({ t: 'c2t', text, dur }, true); }
  function playFx(n, p, x) {
    if (n === 'key') sfx2.key();
    else if (n === 'creak') sfx2.creak(p);
    else if (n === 'slam') sfx2.slam(p);
    else if (n === 'breaker') sfx2.breaker();
    else if (n === 'buzz') sfx2.buzz(p);
    else if (n === 'knock') sfx2.knock(p);
    else if (n === 'ding') sfx2.ding(p);
    else if (n === 'lift') sfx2.lift(p);
    else if (n === 'bell') sfx2.ding(p);
    else if (n === 'scream') { sfx2.sting(); }
    else if (n === 'say') say(x[0], x[1], p);
    else if (n === 'seq') figureSeq();
    else if (n === 'pop') sfx2.pop(p);
    else if (n === 'click') sfx2.click();
    else if (n === 'paper') sfx.paper && sfx.paper();
    else if (n === 'batt') { S.batt = 100; sfx2.click(); toast('Батарейки! Фонарь снова светит ярко', 2.5); }
  }

  // ============ СЮЖЕТ (состояние — у хозяина) ============
  const ST = { ph: 'intro', sw: false, key: false, d27: false, sh9: false, power: false, seq: false, tri: false, ek: false, sh0: false, dom: false, doors: { 9: 0, 18: 0, 27: 0 }, diff: 'normal', msg: false, jr: false, pg: [0, 1, 2], pgot: [0, 0, 0], bt: [0, 1], btg: [0, 0], code: '000', wrong: 0 };
  function resetST() { Object.assign(ST, { ph: 'intro', sw: false, key: false, d27: false, sh9: false, power: false, seq: false, tri: false, ek: false, sh0: false, dom: false, doors: { 9: 0, 18: 0, 27: 0 }, diff: ctx.diff ? ctx.diff() : 'normal', boom: ctx.boom ? !!ctx.boom() : false, msg: false, jr: false, wrong: 0 }); newStory(); }
  // применить состояние к миру (на всех устройствах)
  function applyState() {
    const a27 = APTS[2];
    setLamp(a27.chand, ST.power && !S.seqDark); setLamp(a27.hall, ST.power && !S.seqDark);
    OBJ.bathLight.material.emissiveIntensity = ST.power ? 4 : 0; OBJ.tv27.material.emissiveIntensity = ST.power ? 1.4 : 0;
    for (let f = 0; f < B.NF; f++) { const l = OBJ.lampsF[f]; const off = ST.dom || (f === 8) || (f === 7 && (ST.power || EV.pop || ST.ph !== 'intro')); if (l.on === off) setLamp(l, !off); }
    for (const l of LAMPS) if (l.stair && l !== OBJ.lampsF[0]) { if (ST.dom && l.on) { l.wasOn = true; setLamp(l, false); } }
    setLamp(OBJ.boothLamp, !ST.dom);
    OBJ.triMesh.visible = !ST.tri; OBJ.keyMesh.visible = !ST.ek;
    const sh = OBJ.shield; sh.door.rotation.y = ST.sh9 ? -1.9 : 0; sh.sw.position.y = ST.power ? 0.06 : 0.02;
    const s0 = OBJ.shield0; s0.door.rotation.y = ST.sh0 ? -1.9 : 0; s0.sw.position.y = ST.dom ? 0.06 : 0.02;
    const fd = OBJ.frontDoor, locked = ST.ph === 'night' || ST.ph === 'over';
    fd.rotation.y = ST.ph === 'won' ? 1.4 : locked ? 0 : 1.3;
    OBJ.frontCol.y0 = locked ? 0 : 3; OBJ.frontCol.y1 = locked ? 2.3 : 3;
    OBJ.paperMesh.visible = !!ST.boom;
  }
  function objectiveText() {
    if (ST.ph === 'won') return '';
    if (me() && me().ghost) return 'Ты призрак. Подсказывай живым';
    if (ST.ph === 'night') {
      if (!ST.msg) return 'В прихожей мигает автоответчик. Прослушай сообщение';
      const got = ST.pgot.filter(Boolean).length, code = ST.code.split('').map((d, i) => ST.pgot[i] ? d : '_').join(' ');
      const t = [];
      if (!ST.dom) { t.push(got < 3 ? '· записки мамы ' + got + '/3 (код: ' + code + ')' : '· код щитка: ' + code); t.push(ST.tri ? '✓ трёхгранник' : '· трёхгранный ключ (кв. 18)'); t.push('· щиток «ДОМОФОН» у лифта, 1 этаж'); }
      else t.push('✓ домофон отключён');
      t.push(ST.jr ? '✓ журнал' : '· журнал вахтёрши'); t.push(ST.ek ? '✓ ключ от подъезда' : '· ключ от подъезда (будка — пока спит)');
      return t.join('   ');
    }
    if (!ST.key) return 'Забери ключ из почтового ящика №27 в подъезде';
    if (!ST.d27) return 'Поднимись на 9 этаж, в квартиру 27. Лифт не работает';
    if (!ST.power) return ST.sh9 || ST.sw ? 'Включи автомат в щитке на площадке 9 этажа' : 'Включи свет в квартире';
    return 'Зайди в комнату';
  }
  function doAction(pid, k, arg) {
    const p = RP.get(pid); if (!p || p.ghost || ST.ph === 'won' || ST.ph === 'over') return;
    if (k === 'mail') { if (!ST.key) { ST.key = true; fxAll('key'); toastTo(pid, 'Ключ от квартиры 27. Холодный и мокрый'); } }
    if (k === 'door') {
      const n = arg; if (!(n in ST.doors)) return;
      if (n === 27 && !ST.d27) { if (!ST.key) { toastTo(pid, 'Заперто. Ключ — в почтовом ящике внизу'); return; } if (ST.ph === 'night') { toastTo(pid, 'Заперто изнутри… Кто-то держит дверь'); return; } ST.d27 = true; toastAll('Дом. Всё как в тот вечер, когда меня увезли в Глухово…', 4); }
      if (n === 27 && ST.ph === 'night' && !ST.doors[27] && S.t - (S.nightAt || 0) < 3) return;
      ST.doors[n] = ST.doors[n] ? 0 : 1; fxAll('creak', APTS.find(a => a.n === n).door.pos); hostNoise(APTS.find(a => a.n === n).door.pos, 6, pid);
    }
    if (k === 'switch') { fxAll('click'); if (!ST.power) { ST.sw = true; toastTo(pid, 'Щёлк… Света нет. Наверное, выбило автомат в щитке на площадке', 3.5); } }
    if (k === 'shield') {
      if (!ST.sh9) { ST.sh9 = true; fxAll('creak', OBJ.shield.pos); return; }
      if (!ST.power) { ST.power = true; fxAll('breaker'); setTimeout(() => { fxAll('buzz', V(7, 25, 13)); toastAll('В квартире зажёгся свет. А на лестнице — погас', 3); }, 700); }
    }
    if (k === 'shield0') {
      if (ST.ph !== 'night') { toastTo(pid, 'Щиток «ДОМОФОН». Не трогай'); return; }
      if (!ST.tri) { toastTo(pid, 'Щиток закрыт на трёхгранный замок. Ключ — у бабы Нины в кв. 18'); return; }
      if (!ST.sh0) { ST.sh0 = true; fxAll('creak', OBJ.shield0.pos); hostNoise(OBJ.shield0.pos, 5, pid); toastTo(pid, 'Внутри кодовый замок на три цифры'); return; }
    }
    if (k === 'code') {
      if (ST.dom || !ST.sh0) return;
      if (arg === ST.code) { ST.dom = true; fxAll('breaker'); toastAll('Код подошёл. Домофон отключён… и свет во всём подъезде погас', 4); hostNoise(OBJ.shield0.pos, 16, pid); }
      else { ST.wrong++; fxAll('buzz', OBJ.shield0.pos); hostNoise(OBJ.shield0.pos, 22, pid); toastAll('Неверный код! Щиток громко загудел…', 3); if (ST.wrong % 2 === 0) { LF.timer = 0; } }
    }
    if (k === 'phone') { if (ST.ph === 'night' && !ST.msg) { ST.msg = true; fxAll('click'); fxAll('say', OBJ.phone, ['mom', 'msg']); } if (ST.msg) docTo(pid, 'msg'); }
    if (k === 'page') { const i = arg; if (ST.ph === 'night' && !ST.pgot[i]) { ST.pgot[i] = 1; const n = ST.pgot.filter(Boolean).length; toastAll((MPON() ? p.name + ' нашёл' : 'Нашёл') + ' записку мамы (' + n + '/3)', 3); hostNoise(SM.pages[i].position, 3, pid); } docTo(pid, 'page', i); }
    if (k === 'bat') { const i = arg; if (!ST.btg[i]) { ST.btg[i] = 1; fxTo(pid, 'batt'); } }
    if (k === 'journal') {
      if (ST.ph !== 'night') { toastTo(pid, 'Толстый журнал. Вахтёрша держит на нём руку'); return; }
      if (ST.jr) return;
      if (MON.vah.state === 'sleep') { ST.jr = true; fxAll('paper'); docTo(pid, 'journal'); boothRisk(p); }
      else vahYell(p, true);
    }
    if (k === 'tri') { if (!ST.tri) { ST.tri = true; fxAll('key'); toastAll((MPON() ? p.name + ' нашёл' : 'Нашёл') + ' трёхгранный ключ от щитков', 3.5); } }
    if (k === 'booth') {
      if (ST.ph !== 'night') { toastTo(pid, 'Вахтёрша спит. Лучше не будить'); return; }
      if (ST.ek) return;
      if (MON.vah.state === 'sleep') { ST.ek = true; fxAll('key'); toastAll('Ключ от подъезда у вас!', 3); boothRisk(p); }
      else { vahYell(p, true); }
    }
    if (k === 'front') {
      if (ST.ph !== 'night') return;
      if (!ST.dom) { toastTo(pid, 'Дверь на магнитном замке. Отключи домофон в щитке у лифта на 1 этаже', 3.5); return; }
      if (!ST.ek) { toastTo(pid, 'Заперто на ключ. Ключ — у вахтёрши в будке', 3); return; }
      if (!ST.jr) { toastTo(pid, 'Мама просила не уходить без журнала вахтёрши. Иначе никто не поверит', 3.5); return; }
      ST.ph = 'won'; applyState(); send({ t: 'c2win' }, true); winSeq();
    }
    if (k === 'bell') { fxAll('bell', arg && OBJ['door' + arg] ? OBJ['door' + arg].pos : null); const d = OBJ['door' + arg]; if (d) { hostNoise(d.pos, 14, pid); if (!d.rung && arg % 4 === 1) { d.rung = true; setTimeout(() => fxAll('knock', d.pos), 1600); } } }
  }
  function act() {
    if (S.mode !== 'play' || !focus || S.caught) return;
    const c = focus;
    if (c.k === 'read') { showDoc('news'); return; }
    if (c.k === 'reread') { showDoc('page', c.arg); return; }
    if (c.k === 'seat') { PL.seat = true; P.yaw = -Math.PI / 2; P.pitch = -0.1; P.crouch = false; sfx2.creak(c.pos); sfx2.slam(c.pos); toast('Кабина пахнет бензином и сыростью. Дождь барабанит по крыше', 3); return; }
    if (c.k === 'unseat') { PL.seat = false; const o = vanLocal(1.5, 0, -1.75); PL.pos.set(o.x, -0.15, o.z); PL.y = -0.15; P.yaw = Math.PI; sfx2.slam(o); return; }
    if (c.k === 'dash') { S.fuelT = 3; toast('Стрелка топлива лежит на нуле, горит лампочка. Бак пустой — до Глухово и сюда бензина хватило впритык', 4); return; }
    if (c.k === 'ign') { S.fuelT = 2.5; sfx2.lift(c.pos); toast('Стартер крутит… двигатель чихает и глохнет. Бензина нет. Уехать не получится', 3.5); return; }
    if (c.k === 'shield0' && ST.ph === 'night' && ST.sh0 && !ST.dom) { openKeypad(); return; }
    if (c.k === 'hide') { PL.hidden = c.arg; PL.hideAt = S.t; document.body.classList.add('hiding'); sfx2.creak(c.pos); if (isHost()) { me().hidden = c.arg; me().hideAt = S.t; } return; }
    if (c.k === 'unhide') { const a = APTS[PL.hidden]; PL.hidden = -1; PL.pos.set(8.2, a.y, 11.8); PL.y = a.y; document.body.classList.remove('hiding'); sfx2.creak(a.ward); if (isHost()) me().hidden = -1; return; }
    if (c.k === 'lift') { sfx2.click(); toast(ST.ph === 'night' ? 'Кнопка не горит. Лифт ездит сам по себе…' : 'Лифт не работает', 2.5); return; }
    if (c.k === 'locked') { sfx2.lock(); toast(c.msg, 2.5); return; }
    if (isHost()) doAction(myId, c.k, c.arg); else send({ t: 'c2a', k: c.k, arg: c.arg }, true);
  }
  function emitNoise(pos, r) { if (r <= 0) return; if (isHost()) hostNoise(pos.clone(), r, myId); else send({ t: 'c2n', p: [r2(pos.x), r2(pos.y), r2(pos.z)], r }, false); }

  // ============ ГРАФ ДВИЖЕНИЯ МОНСТРОВ ============
  const NODES = {}, ADJ = {};
  function buildGraph() {
    const node = (id, x, z, y) => { NODES[id] = { id, x, y, z }; ADJ[id] = []; };
    const edge = (a, b, door) => { ADJ[a].push({ to: b, door }); ADJ[b].push({ to: a, door }); };
    node('V', 0, 11, 0);
    for (let f = 0; f < B.NF; f++) {
      const y = f * 3; node('L' + f, 0, 13.1, y);
      if (f < 8) { node('A0' + f, -1.5, 14.35, y + 0.08); node('A1' + f, -1.5, 16.85, y + 1.42); node('M' + f, 0, 17.7, y + 1.5); node('B1' + f, 1.5, 16.85, y + 1.58); node('B0' + f, 1.5, 14.35, y + 2.92); }
    }
    edge('V', 'L0');
    for (let f = 0; f < 8; f++) { edge('L' + f, 'A0' + f); edge('A0' + f, 'A1' + f); edge('A1' + f, 'M' + f); edge('M' + f, 'B1' + f); edge('B1' + f, 'B0' + f); edge('B0' + f, 'L' + (f + 1)); }
    for (const a of APTS) { const y = a.f * 3; node('H' + a.n, 4.2, 13.1, y); node('R' + a.n, 7.2, 13.8, y); node('W' + a.n, 8.1, 11.9, y); edge('L' + a.f, 'H' + a.n, a.n); edge('H' + a.n, 'R' + a.n); edge('R' + a.n, 'W' + a.n); }
  }
  function zoneOfPos(x, z, y) { if (z < 10 && x < 30) return 'out'; if (x >= 3.1 && z > 10.5) { for (const a of APTS) if (Math.abs(y - a.f * 3) < 1) return 'apt' + a.n; return 'x'; } return 'stair'; }
  function nearestNode(p) {
    const zn = zoneOfPos(p.x, p.z, p.y);
    let best = null, bd = 1e9;
    for (const id in NODES) {
      const n = NODES[id]; const nz = id[0] === 'H' || id[0] === 'R' || id[0] === 'W' ? 'apt' + id.slice(1) : 'stair';
      if (zn !== nz && !(zn === 'out' && id === 'V')) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z) + Math.abs(n.y - p.y) * 3; if (d < bd) { bd = d; best = id; }
    }
    return best || 'L0';
  }
  function bfs(a, b, doorsOk) {
    if (a === b) return [];
    const prev = { [a]: null }, q = [a];
    while (q.length) { const c = q.shift(); if (c === b) break; for (const e of ADJ[c]) { if (e.to in prev) continue; if (e.door && !doorsOk && !ST.doors[e.door]) continue; prev[e.to] = c; q.push(e.to); } }
    if (!(b in prev)) return null;
    const out = []; let c = b; while (c !== a) { out.push(c); c = prev[c]; } return out.reverse();
  }
  // шаг монстра по пути; двери: Мокрый открывает сам (не сразу), Сосед — нет
  function stepPath(m, speed, dt) {
    m.speedNow = 0;
    if (!m.path.length) return true;
    const id = m.path[0], n = NODES[id];
    const from = m.cur ? NODES[m.cur] : null;
    const e = from && ADJ[m.cur].find(e => e.to === id);
    if (e && e.door && !ST.doors[e.door]) {
      if (m.k !== 'wet') return 'door';
      m.doorT = (m.doorT || 0) + dt; m.speedNow = 0;
      if (m.doorT > 1.6) { m.doorT = 0; ST.doors[e.door] = 1; fxAll('creak', APTS.find(a => a.n === e.door).door.pos); }
      return false;
    }
    const tgt = V(n.x, n.y, n.z), d = tgt.distanceTo(m.pos), mv = speed * dt;
    if (d <= mv + 0.01) { m.pos.copy(tgt); m.cur = id; m.path.shift(); }
    else { const dir = tgt.sub(m.pos).divideScalar(d); m.pos.addScaledVector(dir, mv); m.yaw = lerpA(m.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 8)); }
    m.speedNow = speed; m.anim += mv * 2.4;
    return !m.path.length;
  }
  const lerpA = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  function goTo(m, nodeId, doorsOk) { const st = m.cur || nearestNode(m.pos); if (!m.cur) { m.cur = st; } const p = bfs(m.cur, nodeId, doorsOk); m.path = p || []; return !!p; }
  function placeAt(m, id) { const n = NODES[id]; m.pos.set(n.x, n.y, n.z); m.cur = id; m.path = []; }
  // прямой подход к цели в конце погони
  function homeIn(m, p, speed, dt) {
    const dx = p.pos.x - m.pos.x, dz = p.pos.z - m.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const mv = Math.min(d, speed * dt), nx = m.pos.x + dx / d * mv, nz = m.pos.z + dz / d * mv;
    const y = freeAt(nx, nz, m.pos.y, 0.22);
    if (y === null) return false;
    m.pos.set(nx, y, nz); m.yaw = lerpA(m.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8)); m.speedNow = speed; m.anim += mv * 2.4; m.cur = null; m.path = [];
    return true;
  }
  const alive = () => [...RP.values()].filter(p => !p.ghost);
  function sees(m, p, range = 11) {
    if (p.ghost || p.hidden >= 0) return false;
    const dy = Math.abs(p.pos.y - m.pos.y); if (dy > 2.6) return false;
    const d = Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z); if (d > range) return false;
    const za = zoneOfPos(m.pos.x, m.pos.z, m.pos.y), zb = zoneOfPos(p.pos.x, p.pos.z, p.pos.y);
    if (za !== zb) { const apt = (za + zb).match(/apt(\d+)/); if (!apt || !ST.doors[+apt[1]] || d > 5) return false; }
    if (p.crouch && !p.light && d > 3.5) return false;
    if (!p.light && d > 7 && dark(p.pos)) return false;
    return true;
  }
  function dark(pos) { for (const l of LAMPS) if (l.on && l.inside && l.pos.distanceTo(pos) < 5) return false; return true; }
  const dist3 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y) * 1.5;
  function caughtBy(m, p) {
    if (p.ghost || S.t - (p.caughtAt || -99) < 4) return;
    p.caughtAt = S.t; p.lives -= 1;
    if (p.lives <= 0 && MPON()) p.ghost = true;
    if (p.local) localCaught(m.k); else send({ t: 'c2c', who: m.k, l: p.lives, g: p.ghost ? 1 : 0 }, true, p.id);
    if (m.pos) { m.state = 'cool'; m.timer = 6; }
    S.lastWho = m.k;
    if (!MPON() && p.lives <= 0) { ST.ph = 'over'; setTimeout(() => overSeq(m.k), 2700); return; }
    if (MPON() && !alive().length) { ST.ph = 'over'; setTimeout(() => { send({ t: 'c2over', who: m.k }, true); overSeq(m.k); }, 2700); }
  }
  function hostNoise(pos, r, pid) {
    if (ST.ph !== 'night') return;
    for (const m of [MON.wet, MON.sosed]) {
      if (!m.vis || m.state === 'chase' || m.state === 'cool' || m.state === 'retreat' || m.state === 'pull') continue;
      if (m.k === 'sosed' && m.state !== 'descend' && m.state !== 'listen') continue;
      if (dist3(m.pos, pos) > r * 1.4 * DF().hear) continue;
      m.state = 'hunt'; m.heard = pos.clone(); m.timer = 14; goTo(m, nearestNode(pos), m.k === 'wet');
    }
  }

  // ============ ИИ МОНСТРОВ (у хозяина) ============
  const LF = { y: 0, ty: 0, f: 0, open: 0, state: 'idle', timer: 20, lifter: false };
  function updateWet(dt) {
    const m = MON.wet; if (m.state === 'off') return;
    m.vis = true;
    const ps = alive();
    // свет фонаря прямо в него — визжит и уходит
    if (m.state !== 'retreat' && m.state !== 'cool') for (const p of ps) {
      if (!p.light) continue;
      const eye = V(p.pos.x, p.pos.y + 1.5, p.pos.z), c = V(m.pos.x, m.pos.y + 1.6, m.pos.z), v = c.clone().sub(eye), d = v.length();
      if (d > 8.5 || Math.abs(p.pos.y - m.pos.y) > 2.2) continue;
      const dir = V(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
      if (v.normalize().dot(dir) > 0.94) { m.burn = (m.burn || 0) + dt; if (m.burn > 1.1) { m.burn = 0; m.state = 'retreat'; m.timer = 9; fxAll('scream', m.pos); let far = 'L0', fd = -1; for (const id in NODES) { if (id[0] !== 'L' && id[0] !== 'M') continue; const dd = dist3(NODES[id], p.pos); if (dd > fd) { fd = dd; far = id; } } goTo(m, far, true); toastTo(p.id, 'Мокрый взвизгнул от света и убежал!', 2.5); } break; }
    }
    // кого видит
    let tgt = null, bd = 1e9;
    for (const p of ps) if (sees(m, p)) { const d = dist3(m.pos, p.pos); if (d < bd) { bd = d; tgt = p; } }
    // видел, как прячутся в шкаф — вытащит
    if (m.state === 'chase' && m.tp && m.tp.hidden >= 0 && S.t - m.tp.hideAt < 2.5 && dist3(m.pos, m.tp.pos) < 9) { m.state = 'pull'; m.pullAt = m.tp; goTo(m, 'W' + APTS[m.tp.hidden].n, true); }
    switch (m.state) {
      case 'wander': {
        if (!m.path.length) { const ids = Object.keys(NODES).filter(i => i[0] === 'L' || i[0] === 'M'); goTo(m, ids[(Math.random() * ids.length) | 0], true); }
        stepPath(m, 1.25 * DF().sp, dt);
        if (tgt) { m.state = 'chase'; m.tp = tgt; fxAll('scream', m.pos); }
        break;
      }
      case 'hunt': {
        m.timer -= dt;
        if (stepPath(m, 2.1 * DF().sp, dt) === true || m.timer <= 0) { m.state = 'wander'; m.path = []; }
        if (tgt) { m.state = 'chase'; m.tp = tgt; }
        break;
      }
      case 'chase': {
        const p = m.tp;
        if (!p || p.ghost || (p.hidden >= 0 && m.state !== 'pull')) { m.state = 'hunt'; m.timer = 6; m.path = []; break; }
        if (tgt === p) { m.lost = 0; m.last = p.pos.clone(); } else { m.lost = (m.lost || 0) + dt; if (m.lost > 3) { m.state = 'hunt'; m.timer = 8; goTo(m, nearestNode(m.last || p.pos), true); break; } }
        const d = dist3(m.pos, p.pos);
        if (d < 3.2 && tgt === p && homeIn(m, p, 3.0 * DF().sp, dt)) { /* в упор */ }
        else { m.repath = (m.repath || 0) - dt; if (m.repath <= 0 || !m.path.length) { m.repath = 0.6; goTo(m, nearestNode(m.last || p.pos), true); } stepPath(m, 3.0 * DF().sp, dt); }
        if (Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z) < 0.95 && Math.abs(p.pos.y - m.pos.y) < 1.1) caughtBy(m, p);
        break;
      }
      case 'pull': {
        const p = m.pullAt;
        if (stepPath(m, 2.6 * DF().sp, dt) === true) { if (p && p.hidden >= 0) { if (p.local) { PL.hidden = -1; document.body.classList.remove('hiding'); } p.hidden = -1; caughtBy(m, p); } m.state = 'cool'; m.timer = 5; }
        break;
      }
      case 'retreat': m.timer -= dt; if (stepPath(m, 3.4 * DF().sp, dt) === true || m.timer <= 0) { m.state = 'cool'; m.timer = 6; } break;
      case 'cool': m.timer -= dt; m.speedNow = 0; if (m.timer <= 0) { m.state = 'wander'; m.path = []; } break;
    }
    m.mesh.position.copy(m.pos); m.mesh.rotation.y = m.yaw;
  }
  function updateSosed(dt) {
    const m = MON.sosed;
    if (m.state === 'off') { m.vis = false; m.timer -= dt; if (m.timer <= 0) { m.state = 'knock'; m.timer = 3; fxAll('knock', V(1, 27.3, 13.3)); fxAll('say', V(1, 27, 13.3), ['sosed', 'hear']); } return; }
    if (m.state === 'knock') { m.timer -= dt; if (m.timer <= 0) { placeAt(m, 'L8'); m.vis = true; m.state = 'listen'; m.timer = 2.5; m.down = 8; } return; }
    const ps = alive();
    let tgt = null, bd = 1e9; for (const p of ps) if (sees(m, p, 9)) { const d = dist3(m.pos, p.pos); if (d < bd) { bd = d; tgt = p; } }
    if (tgt && m.state !== 'chase' && m.state !== 'ascend' && m.state !== 'cool') { m.state = 'chase'; m.tp = tgt; m.chaseT = 0; fxAll('say', m.pos, ['sosed', 'chase']); }
    switch (m.state) {
      case 'listen': m.speedNow = 0; m.timer -= dt; m.yaw += dt * 1.2; if (m.timer <= 0) { if (m.down <= 0) { m.state = 'ascend'; goTo(m, 'L8', false); } else { m.down--; m.state = 'descend'; goTo(m, 'L' + m.down, false); } } break;
      case 'descend': case 'hunt': { const r = stepPath(m, 1.5 * DF().sp, dt); if (r === 'door') { m.state = 'knockdoor'; m.timer = 3; fxAll('knock', m.pos); } else if (r === true) { m.state = 'listen'; m.timer = 2.5; if (m.cur && m.cur[0] === 'L') m.down = +m.cur.slice(1); } break; }
      case 'knockdoor': m.timer -= dt; m.speedNow = 0; if (m.timer <= 0) { m.state = 'listen'; m.timer = 1; m.path = []; m.cur = nearestNode(m.pos); } break;
      case 'chase': {
        const p = m.tp; m.chaseT += dt;
        if (!p || p.ghost || p.hidden >= 0 || m.chaseT > 22) { m.state = 'listen'; m.timer = 2; m.path = []; m.cur = nearestNode(m.pos); m.down = Math.max(0, Math.round(m.pos.y / 3)); break; }
        if (tgt === p) { m.lost = 0; m.last = p.pos.clone(); } else { m.lost = (m.lost || 0) + dt; if (m.lost > 4) { m.state = 'listen'; m.timer = 2; m.cur = nearestNode(m.pos); m.path = []; m.down = Math.max(0, Math.round(m.pos.y / 3)); break; } }
        const d = dist3(m.pos, p.pos);
        if (d < 3 && tgt === p && homeIn(m, p, 2.3 * DF().sp, dt)) { }
        else { m.repath = (m.repath || 0) - dt; if (m.repath <= 0 || !m.path.length) { m.repath = 0.7; m.cur = m.cur || nearestNode(m.pos); goTo(m, nearestNode(m.last || p.pos), false); } const r = stepPath(m, 2.3 * DF().sp, dt); if (r === 'door') { m.state = 'knockdoor'; m.timer = 3.5; fxAll('knock', m.pos); fxAll('say', m.pos, ['sosed', 'door']); } }
        if (Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z) < 0.95 && Math.abs(p.pos.y - m.pos.y) < 1.1) caughtBy(m, p);
        break;
      }
      case 'ascend': if (stepPath(m, 3.0 * DF().sp, dt) === true) { m.state = 'off'; m.vis = false; m.timer = rand(40, 70); } break;
      case 'cool': m.timer -= dt; m.speedNow = 0; if (m.timer <= 0) { m.state = 'ascend'; m.cur = nearestNode(m.pos); goTo(m, 'L8', false); } break;
    }
    m.mesh.position.copy(m.pos); m.mesh.rotation.y = m.yaw;
  }
  function updateLift(dt) {
    if (ST.ph !== 'night') return;
    LF.timer -= dt;
    if (LF.state === 'idle' && LF.timer <= 0) {
      const ps = alive(); const p = ps.length && Math.random() < 0.65 ? ps[(Math.random() * ps.length) | 0] : null;
      LF.f = clamp(p ? Math.round(p.pos.y / 3) : (Math.random() * 9) | 0, 0, 8); LF.ty = LF.f * 3; LF.state = 'moving'; LF.lifter = true;
      fxAll('lift', V(-3.5, LF.ty + 1, 13.1));
    }
    if (LF.state === 'moving') { const d = LF.ty - LF.y; LF.y += clamp(d, -2.4 * dt, 2.4 * dt); if (Math.abs(d) < 0.01) { LF.y = LF.ty; LF.state = 'open'; LF.timer = 5; fxAll('ding', V(-3, LF.ty + 1.5, 13.1)); fxAll('say', V(-3.5, LF.ty + 1.5, 13.1), ['lifter', 'call']); } }
    if (LF.state === 'open') {
      LF.timer -= dt; LF.open = Math.min(1, LF.open + dt / 1.3);
      if (LF.open > 0.65) for (const p of alive()) { if (p.hidden >= 0) continue; if (Math.abs(p.pos.y - LF.y) < 0.8 && p.pos.x < -0.7 && p.pos.z > 12.1 && p.pos.z < 14.1) caughtBy({ k: 'lifter' }, p); }
      if (LF.timer <= 0) LF.state = 'closing';
    }
    if (LF.state === 'closing') { LF.open = Math.max(0, LF.open - dt / 1.2); if (LF.open <= 0) { LF.state = 'idle'; LF.lifter = false; LF.timer = rand(22, 40); } }
  }
  function vahYell(p, grab) {
    const v = MON.vah; if (v.yellCD > 0 && !grab) return;
    v.yellCD = 8; v.state = 'awake'; v.timer = Math.max(v.timer, 6);
    fxAll('say', V(2.4, 1.4, 11), ['vah', 'yell']); hostNoise(V(0, 0.5, 11), 45, p ? p.id : null);
    if (grab && p) caughtBy({ k: 'vah' }, p);
  }
  function updateVah(dt) {
    const v = MON.vah; v.yellCD = Math.max(0, v.yellCD - dt);
    if (ST.ph !== 'night') { v.state = 'sleep'; return; }
    v.timer -= dt;
    if (v.timer <= 0) { v.state = v.state === 'sleep' ? 'awake' : 'sleep'; v.timer = v.state === 'sleep' ? rand(22, 36) / DF().wake : rand(10, 18) * DF().wake; }
    if (v.state === 'awake') for (const p of alive()) {
      if (p.hidden >= 0 || p.pos.y > 1) continue;
      const d = Math.hypot(p.pos.x - 1.2, p.pos.z - 11);
      const inView = p.pos.z < 14.2 && p.pos.x < 1.3 && d < 6;
      if (!inView) continue;
      if (p.crouch && !p.light && d > 2.4) continue;
      vahYell(p, d < 1.3);
      break;
    }
  }
  function startNight() {
    ST.ph = 'night'; ST.doors[27] = 0; ST.power = false; S.nightAt = S.t;   // Он выбил автомат: в квартире темно
    const m = MON.wet; placeAt(m, 'M3'); m.state = 'wander'; m.vis = true;
    const s = MON.sosed; s.state = 'off'; s.timer = 30 / DF().sp;
    LF.state = 'idle'; LF.timer = 18; MON.vah.state = 'sleep'; MON.vah.timer = 25;
    nightFx(); applyState();
    toastAll('Внизу лязгнул замок: подъезд заперли на ночь. В прихожей мигает автоответчик…', 5);
  }
  function nightFx() { S.nightAt = S.t; sfx2.slam(V(0, 1, 10)); }

  // ============ ВИДИМОСТЬ И АНИМАЦИЯ МОНСТРОВ (на всех устройствах) ============
  function animMonsters(dt) {
    const host = isHost();
    for (const k of ['wet', 'sosed']) {
      const m = MON[k];
      if (!host && m.tgt) { if (m.pos.distanceTo(m.tgt) > 3) m.pos.copy(m.tgt); else m.pos.lerp(m.tgt, Math.min(1, dt * 10)); m.yaw = lerpA(m.yaw, m.tyaw || 0, Math.min(1, dt * 10)); m.anim += (m.speedNow || 0) * dt * 2.4; }
      m.mesh.visible = !!m.vis && (k !== 'wet' || !S.seqHide);
      m.mesh.position.copy(m.pos); m.mesh.rotation.y = m.yaw;
      walk(m, m.speedNow || 0);
      if (k === 'sosed' && m.state === 'listen') { m.mesh.userData.head.rotation.y = Math.sin(S.t * 1.5) * 0.8; } else m.mesh.userData.head.rotation.y = 0;
      if (k === 'wet') { const U = m.mesh.userData; U.arms.forEach(a => { a.a.rotation.z = 0; }); if (m.state === 'chase') U.arms.forEach((a, i) => { a.a.rotation.x = -1.3 + Math.sin(S.t * 8 + i) * 0.15; }); }
      // звуки рядом
      m.sndT = (m.sndT || 0) - dt;
      if (m.vis && m.sndT <= 0) { m.sndT = k === 'wet' ? 0.7 : 0.55; const d = cam.position.distanceTo(m.pos); if (d < 16) { if (k === 'wet') sfx2.drip(m.pos); else if (m.speedNow > 0) sfx2.steps(m.pos, 1); } }
    }
    // мокрые следы
    const w = MON.wet;
    if (w.vis && (!w.lastPrint || w.lastPrint.distanceTo(w.pos) > 0.65)) { w.lastPrint = w.pos.clone(); const pr = MON.prints[MON.printI++ % MON.prints.length]; pr.visible = true; pr.position.set(w.pos.x + Math.cos(w.yaw) * ((MON.printI % 2) ? 0.1 : -0.1), w.pos.y + 0.012, w.pos.z - Math.sin(w.yaw) * ((MON.printI % 2) ? 0.1 : -0.1)); pr.rotation.z = -w.yaw; pr.userData.t = 25; pr.material.opacity = 0.85; }
    for (const pr of MON.prints) if (pr.visible) { pr.userData.t -= dt; pr.material.opacity = Math.min(0.85, pr.userData.t / 8); if (pr.userData.t <= 0) pr.visible = false; }
    // лифт
    if (!host) LF.y += clamp((LF.ty || 0) - LF.y, -3 * dt, 3 * dt);
    OBJ.cab.position.y = LF.y;
    const L = MON.lifter.mesh; L.visible = LF.lifter && LF.open > 0.05; L.position.set(-4.0, LF.y, 13.1); L.rotation.y = Math.PI / 2;
    L.userData.arms[1].a.rotation.x = -1.2 - (LF.open > 0.6 ? Math.sin(S.t * 6) * 0.3 : 0);
    setLamp(OBJ.cabLamp, LF.open > 0.05);
    OBJ.lifts.forEach((d, f) => { const o = (Math.abs(LF.y - f * 3) < 0.05 ? LF.open : 0) + (EV.liftScare && f === 5 ? EV.liftScare : 0); d.open += (o - d.open) * Math.min(1, dt * 6); d.dl.position.z = 12.78 - d.open * 0.62; d.dr.position.z = 13.42 + d.open * 0.62; });
    // вахтёрша
    const v = MON.vah, U = v.mesh.userData;
    const awake = v.state === 'awake';
    U.neck.rotation.x = lerp(U.neck.rotation.x, awake ? -0.05 : 0.75, Math.min(1, dt * 3));
    U.arms.forEach((a, i) => { a.a.rotation.x = -1.0; a.b.rotation.x = -0.9 + (awake ? 0 : Math.sin(S.t * 2 + i) * 0.05); });
    U.spine.rotation.x = awake ? 0 : 0.2;
    if (U.faceMat.map !== (awake ? U.faceAwake : U.faceSleep)) U.faceMat.map = awake ? U.faceAwake : U.faceSleep;
    { // проснувшись, поворачивает голову к тебе — неестественно далеко
      const cp = cam.position, mp = v.mesh.position; let ang = Math.atan2(cp.x - mp.x, cp.z - mp.z) - v.mesh.rotation.y; while (ang > Math.PI) ang -= Math.PI * 2; while (ang < -Math.PI) ang += Math.PI * 2;
      U.head.rotation.y = lerp(U.head.rotation.y, awake ? clamp(ang, -2.6, 2.6) : 0, Math.min(1, dt * (awake ? 6 : 2)));
    }
    animDrops(dt);
    v.snoreT = (v.snoreT || 0) - dt; if (!awake && v.snoreT <= 0) { v.snoreT = 2.6; if (cam.position.distanceTo(v.mesh.position) < 9) sfx.snore(v.mesh.position); }
  }

  // ============ ЛОКАЛЬНЫЕ СТРАШИЛКИ ПО ДОРОГЕ НАВЕРХ ============
  const EV = {};
  const floorOf = () => Math.max(0, Math.floor((PL.pos.y + 0.6) / 3));
  function localScares(dt) {
    if (ST.ph !== 'intro' || me().ghost) return;
    const f = floorOf(), p = PL.pos;
    if (!EV.door1 && p.z > 11 && p.y < 1) { EV.door1 = true; sfx2.slam(V(0, 9, 15)); }
    if (f >= 2 && !EV.f2) { EV.f2 = true; setTimeout(() => sfx2.knock(V(-2, 8, 12)), 600); }
    if (f >= 4 && !EV.run) { EV.run = true; sfx2.steps(V(0, p.y + 4, 16), 10); S.runFig = 0.9; }
    if (f >= 5 && p.z < 14.3 && !EV.lift) { EV.lift = true; sfx2.lift(V(-3, 16, 13)); setTimeout(() => { sfx2.ding(V(-3, 16, 13)); EV.liftScare = 1; setTimeout(() => { EV.liftScare = 0; }, 3500); }, 2200); }
    if (f >= 7 && p.z < 14.3 && !EV.pop) { EV.pop = true; sfx2.pop(OBJ.lampsF[7].pos); setLamp(OBJ.lampsF[7], false); setTimeout(() => toast('Темно. Включи фонарь', 2.5), 500); }
  }
  // сцена «Он стоит у окна» при включённом свете
  function figureSeq() {
    if (EV.seq) return; EV.seq = true; EV.seqT = 0;
    S.figPos = V(7.5, APTS[2].y, 11.4); sfx2.sting();
  }
  function updateSeq(dt) {
    if (S.runFig > 0) { S.runFig -= dt; }
    if (!EV.seq || EV.seqDone) { S.figShow = S.runFig > 0; return; }
    EV.seqT += dt; const t = EV.seqT;
    S.figShow = t < 2.0 || S.runFig > 0;
    S.seqDark = t > 1.2 && (t >= 2.6 || Math.sin(t * 40) > 0);
    applyState();
    if (t > 2.0 && !EV.slam2) { EV.slam2 = true; sfx2.slam(V(3, 25, 13)); }
    if (t > 2.8 && !EV.seqDone) { EV.seqDone = true; S.seqDark = false; S.figShow = S.runFig > 0; if (isHost()) startNight(); applyState(); setTimeout(() => { if (S.on && !P.light) toast('Свет погас. Включи фонарь', 3); }, 4500); }
  }
  function drawFig() {
    const w = MON.wet;
    if (S.figShow && !w.vis) {
      w.mesh.visible = true;
      if (EV.seq && EV.seqT < 2.1) { w.mesh.position.copy(S.figPos); w.mesh.rotation.y = Math.PI; }
      else { w.mesh.position.set(1.4, 5 * 3 + 1.5, 17.7); w.mesh.rotation.y = Math.PI; }
      walk(w, 0);
    }
  }

  // ============ ПОЙМАЛИ / ПОБЕДА / ПОРАЖЕНИЕ ============
  const WHO = { wet: 'Мокрый', sosed: 'Сосед с 10 этажа', lifter: 'Лифтёр', vah: 'Вахтёрша' };
  function localCaught(who) {
    if (S.caught) return;
    S.caught = { t: 0, who }; S.lastWho = who;
    PL.hidden = -1; document.body.classList.remove('hiding');
    $('flash').style.opacity = 0.85; sfx.scare && sfx.scare(); setTimeout(() => $('flash').style.opacity = 0, 200);
    if (who === 'vah') say('vah', 'grab'); if (who === 'lifter') say('lifter', 'grab');
  }
  function updateCaught(dt) {
    const c = S.caught; if (!c) return;
    c.t += dt;
    const m = c.who === 'wet' ? MON.wet.mesh : c.who === 'sosed' ? MON.sosed.mesh : c.who === 'lifter' ? MON.lifter.mesh : MON.vah.mesh;
    const hp = m.userData.head.getWorldPosition(V()); hp.y += 0.12;
    cam.lookAt(hp); cam.position.x += (Math.random() - 0.5) * 0.04 * Math.max(0, 1.4 - c.t);
    $('red').style.opacity = Math.min(0.85, c.t).toFixed(2);
    if (c.t > 1.4 && !c.faded) { c.faded = true; showFade(WHO[c.who] || '', me().ghost ? 'ты стал призраком' : 'осталось жизней: ' + Math.max(0, me().lives)); }
    if (c.t > 2.6) {
      S.caught = null; $('red').style.opacity = 0; hideFade();
      if (ST.ph === 'over') return;
      if (me().ghost) { becomeGhost(); return; }
      const a = APTS[2]; PL.pos.set(4.3, a.y, 13.1); PL.y = a.y; P.yaw = -Math.PI / 2; P.pitch = 0;
      toast('Ты очнулся в квартире 27. Голова гудит…', 3);
    }
  }
  function becomeGhost() { document.body.classList.add('ghost'); P.light = false; toast('Ты погиб и стал призраком. Монстры тебя не видят', 4); }
  function winSeq() {
    if (S.ended) return; S.ended = true; ST.ph = 'won'; applyState();
    try { localStorage.setItem('hushwood.ch2done', '1'); } catch (e) { }
    sfx2.slam(V(0, 1, 10));
    $('keypad').classList.add('hidden');
    setTimeout(() => showDoc('final'), 900);
    setTimeout(() => { $('paper').classList.add('hidden'); P.ui = false; showFade('ГЛАВА 2 ПРОЙДЕНА', 'ПРОДОЛЖЕНИЕ СЛЕДУЕТ…'); }, 14000);
    setTimeout(() => { S.mode = 'done'; ctx.onExit(); }, 19000);
  }
  // ============ КОНЦОВКИ СМЕРТИ (своя у каждого монстра) ============
  const DEATH = {
    wet: { title: 'ТЫ ОСТАЛСЯ С МИШЕЙ', lines: ['Он утащил тебя вниз, в чёрную холодную воду.', 'Утром на лестнице нашли только большую лужу.', 'Миша больше не один.'] },
    sosed: { title: 'ДЕСЯТЫЙ ЭТАЖ', lines: ['Сосед понёс тебя наверх, через люк.', 'В этом доме девять этажей.', 'Но теперь по ночам по батареям стучишь ты.'] },
    lifter: { title: 'ПОДВАЛА НЕТ', lines: ['Двери лифта закрылись.', 'Кабина поехала вниз — ниже первого этажа.', 'Она едет до сих пор.'] },
    vah: { title: 'ЗАПИСАН В ЖУРНАЛ', lines: ['Зинаида Петровна открыла журнал и послюнила карандаш.', '«Кв. 27 — мальчик, вернулся. Передан повторно».', 'Утром у подъезда снова стоял белый фургон.'] },
  };
  function overSeq(who) {
    if (S.ended) return; S.ended = true; who = DEATH[who] ? who : (S.lastWho || 'wet');
    S.mode = 'death'; const D = S.death = { who, t: 0, base: PL.pos.clone(), f: clamp(Math.round(PL.pos.y / 3), 0, 8), yaw: P.yaw };
    document.body.classList.add('ch2cut'); $('paper').classList.add('hidden'); $('keypad').classList.add('hidden'); $('ch2obj').classList.add('hidden');
    hideFade(); $('red').style.opacity = 0; P.light = false; PL.seat = false; PL.hidden = -1; document.body.classList.remove('hiding');
    if (who === 'lifter') { LF.y = D.f * 3; LF.open = 1; LF.lifter = true; OBJ.cab.position.y = LF.y; setLamp(OBJ.cabLamp, true); MON.lifter.mesh.visible = true; sfx2.ding(V(-3, LF.y + 1.5, 13.1)); }
    if (who === 'sosed') { const m = MON.sosed.mesh; m.visible = true; m.position.set(1.0, 24, 13.55); m.rotation.y = Math.PI; m.userData.arms.forEach(a => { a.a.rotation.x = -1.5; a.b.rotation.x = -0.4; }); sfx2.knock(V(1, 26, 13)); }
    if (who === 'wet') { const m = MON.wet.mesh; m.visible = true; const fx = -Math.sin(D.yaw), fz = -Math.cos(D.yaw); m.position.set(D.base.x + fx * 0.7, D.base.y, D.base.z + fz * 0.7); m.rotation.y = Math.atan2(-fx, -fz); m.userData.arms.forEach(a => { a.a.rotation.x = -2.2; a.b.rotation.x = -0.6; }); $('drown').classList.add('on'); }
    if (who === 'vah') { const U = MON.vah.mesh.userData; U.faceMat.map = U.faceAwake; U.neck.rotation.x = -0.05; OBJ.journalMesh.visible = true; }
    const E = DEATH[who];
    setTimeout(() => ctx.playEnding({ draw: null, lines: E.lines, title: E.title, onDone: () => { $('drown').classList.remove('on'); S.mode = 'done'; ctx.onExit(); } }), who === 'vah' ? 900 : 2400);
  }
  function updateDeath(dt) {
    const D = S.death; D.t += dt; const t = D.t;
    if (D.who === 'lifter') {
      const y0 = D.f * 3, d = OBJ.lifts[D.f];
      LF.open = 1 - clamp(t / 1.4, 0, 1); d.open = LF.open; d.dl.position.z = 12.78 - LF.open * 0.62; d.dr.position.z = 13.42 + LF.open * 0.62;
      if (t > 1.4 && !D.go) { D.go = true; sfx2.slam(V(-3.2, y0 + 1, 13.1)); sfx2.lift(V(-4, y0 + 1, 13.1)); }
      const cy = y0 - (t > 1.6 ? (t - 1.6) * (0.8 + (t - 1.6) * 0.7) : 0);
      OBJ.cab.position.y = cy; setLamp(OBJ.cabLamp, Math.random() > (t > 2.6 ? 0.45 : 0.04));
      const L = MON.lifter.mesh; L.position.set(-4.45, cy, 12.72); L.rotation.y = 0.85;
      const sh = t > 1.6 ? 0.012 : 0; cam.position.set(-3.8 + rand(-sh, sh), cy + 1.55 + rand(-sh, sh), 13.3);
      const k = clamp((t - 2.0) / 1.0, 0, 1), look = V(lerp(-3.0, -4.45, k), cy + lerp(1.45, 1.35, k), lerp(13.1, 12.72, k)); cam.lookAt(look);
    } else if (D.who === 'sosed') {
      const up = Math.max(0, t - 1.0) * 0.75, m = MON.sosed.mesh;
      m.position.y = 24 + up; m.userData.head.rotation.z = 0.3 + Math.sin(t * 9) * 0.06;
      cam.position.set(1.0 + rand(-0.01, 0.01), 25.45 + up, 12.75);
      const hp = m.userData.head.getWorldPosition(V()); hp.y += 0.1; cam.lookAt(hp.x, hp.y + Math.min(1.6, up * 0.7), hp.z);
      if (((t * 2.2) | 0) !== D.kn) { D.kn = (t * 2.2) | 0; sfx2.knock(V(1, 26 + up, 13)); }
    } else if (D.who === 'wet') {
      const m = MON.wet.mesh; m.userData.head.rotation.x = 0.4 + Math.sin(t * 5) * 0.05; animDrops(dt);
      cam.position.set(D.base.x, D.base.y + Math.max(0.25, 0.9 - t * 0.35), D.base.z);
      const hp = m.userData.head.getWorldPosition(V()); cam.lookAt(hp); cam.rotation.z += Math.sin(t * 0.8) * 0.15;
      if (((t * 3) | 0) !== D.kn) { D.kn = (t * 3) | 0; sfx2.drip(m.position); }
      rain(true, 1, 0.97);
    } else if (D.who === 'vah') {
      const v = MON.vah.mesh, U = v.userData; cam.position.set(0.1, 1.5, 11.85);
      U.head.rotation.y = lerp(U.head.rotation.y, 2.2, Math.min(1, dt * 3)); U.arms[1].a.rotation.x = -1.1 + Math.sin(t * 8) * 0.08;
      cam.lookAt(2.2, 1.2, 11.1);
    }
  }

  // ============ ВЗАИМОДЕЙСТВИЕ ============
  function cands() {
    const c = [], p = PL.pos, gh = me().ghost;
    if (PL.seat) return [
      { k: 'dash', pos: vanLocal(1.79, 1.38, -0.45), label: 'Приборная панель: бензина нет' },
      { k: 'ign', pos: vanLocal(1.78, 1.2, -0.2), label: 'Повернуть ключ' },
      { k: 'unseat', pos: vanLocal(1.45, 1.55, -1.0), label: 'Выйти из фургона' },
    ];
    if (PL.hidden >= 0) return [{ k: 'unhide', pos: cam.position.clone().add(V(-1, 0, 0)), label: 'Вылезти из шкафа', any: true }];
    if (gh) return c;
    if (p.z < 5 && !gh) c.push({ k: 'seat', pos: vanLocal(1.55, 1.35, -1.1), label: 'Сесть за руль' });
    if (p.z < 10 && ST.boom) c.push({ k: 'read', pos: OBJ.paper, label: 'Прочитать обрывок газеты' });
    if (p.z < 10) for (const ex of [-18, 18]) c.push({ k: 'locked', pos: V(ex, 1.2, 9.9), label: 'Подъезд ' + (ex < 0 ? 2 : 4), msg: 'Заперто. Домофон молчит' });
    if (!ST.key) c.push({ k: 'mail', pos: OBJ.mailbox, label: 'Почтовый ящик №27' });
    for (const a of APTS) {
      const open = ST.doors[a.n];
      const lbl = a.n === 27 && !ST.d27 ? (ST.key ? 'Открыть квартиру 27' : 'Квартира 27. Заперто') : open ? 'Закрыть дверь' : 'Открыть дверь кв. ' + a.n;
      c.push({ k: 'door', arg: a.n, pos: a.door.pos, label: lbl }); c.push({ k: 'door', arg: a.n, pos: a.door.posIn, label: lbl });
      c.push({ k: 'hide', arg: APTS.indexOf(a), pos: a.ward, label: 'Спрятаться в шкаф' });
    }
    if (ST.doors[27] || ST.d27) c.push({ k: 'switch', pos: OBJ.switch, label: 'Выключатель' });
    c.push({ k: 'shield', pos: OBJ.shield.pos, label: !ST.sh9 ? 'Открыть щиток' : !ST.power ? 'Включить автомат «кв. 27»' : 'Щиток' });
    c.push({ k: 'shield0', pos: OBJ.shield0.pos, label: !ST.sh0 ? 'Щиток «ДОМОФОН»' : !ST.dom ? 'Отключить домофон' : 'Домофон отключён' });
    if (!ST.tri) c.push({ k: 'tri', pos: APTS[1].item, label: 'Взять трёхгранный ключ' });
    if (ST.ph === 'night') {
      c.push({ k: 'phone', pos: OBJ.phone, label: ST.msg ? 'Переслушать автоответчик' : 'Автоответчик: 1 сообщение' });
      ST.pg.forEach((s, i) => { if (!ST.pgot[i]) c.push({ k: 'page', arg: i, pos: SM.pages[i].position, label: 'Поднять записку' }); });
      ST.pgot.forEach((g, i) => { if (g) c.push({ k: 'reread', arg: i, pos: SM.pages[i].position, label: 'Записка' }); });
      if (!ST.jr) c.push({ k: 'journal', pos: OBJ.journal, label: MON.vah.state === 'sleep' ? 'Тихо взять журнал' : 'Журнал (она не спит!)' });
    }
    ST.bt.forEach((s, i) => { if (!ST.btg[i]) c.push({ k: 'bat', arg: i, pos: SM.bats[i].position, label: 'Батарейки для фонаря' }); });
    c.push({ k: 'booth', pos: OBJ.booth, label: ST.ph !== 'night' ? 'Будка вахтёрши' : ST.ek ? 'Будка вахтёрши' : MON.vah.state === 'sleep' ? 'Тихо взять ключ от подъезда' : 'Взять ключ (она не спит!)' });
    if (ST.ph === 'night') c.push({ k: 'front', pos: V(0, 1.2, 10.35), label: 'Открыть подъезд' });
    for (const k in OBJ) if (k.startsWith('door') && OBJ[k] && OBJ[k].n) c.push({ k: 'bell', arg: OBJ[k].n, pos: OBJ[k].pos, label: 'Позвонить в квартиру ' + OBJ[k].n });
    for (let f = 0; f < B.NF; f++) c.push({ k: 'lift', pos: V(-2.75, f * 3 + 1.25, 14.05), label: 'Вызвать лифт' });
    return c;
  }
  let focus = null;
  function pickFocus() {
    const cp = cam.position, dir = V(); cam.getWorldDirection(dir);
    let best = null, bs = 1e9;
    for (const c of cands()) { if (c.any) { best = c; break; } const v = c.pos.clone().sub(cp), d = v.length(); if (d > 2.4) continue; const dot = v.normalize().dot(dir); if (dot < 0.72) continue; const s = d * (1.6 - dot); if (s < bs) { bs = s; best = c; } }
    if (!best && PL.seat) best = { k: 'unseat', label: 'Выйти из фургона' };
    focus = best;
    const a = $('bAct'); a.textContent = best ? best.label : '—'; a.classList.toggle('idle', !best);
  }

  // ============ СЮЖЕТ: автоответчик, записи мамы, код щитка, журнал вахтёрши, фонарь ============
  const PAGE_SPOTS = [
    [6.4, 6.73, 15.35, 'в квартире 9'], [7.6, 15.63, 15.2, 'в квартире 18'], [0.9, 10.51, 17.9, 'на лестнице между 4 и 5 этажом'],
    [-0.9, 19.51, 17.9, 'на лестнице между 7 и 8 этажом'], [-2.1, 3.01, 12.6, 'на 2 этаже у лифта'], [-2.1, 21.01, 13.9, 'на 8 этаже у лифта'],
  ].map(a => ({ pos: V(a[0], a[1], a[2]), where: a[3] }));
  const BAT_SPOTS = [[7.6, 6.01, 15.5], [2.2, 12.01, 13.9], [4.5, 15.01, 12.0], [-2.3, 0.01, 11.2]].map(a => V(...a));
  const DIFF2 = {
    easy: { lives: 4, sp: 0.85, drain: 0.35, hear: 0.8, wake: 0.6, name: 'Лёгкая' },
    normal: { lives: 3, sp: 1, drain: 0.6, hear: 1, wake: 1, name: 'Нормальная' },
    hard: { lives: 3, sp: 1.1, drain: 0.85, hear: 1.2, wake: 1.3, name: 'Сложная' },
    nightmare: { lives: 2, sp: 1.2, drain: 1.1, hear: 1.4, wake: 1.6, name: 'Кошмар' },
  };
  const DF = () => DIFF2[ST.diff] || DIFF2.normal;
  const SM = { pages: [], bats: [] };
  function buildStory() {
    // листки из маминой тетради
    const pageMat = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide, map: canvasTex(64, 90, (g, w, h) => { g.fillStyle = '#e8e4d4'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,110,170,.5)'; for (let y = 12; y < h; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeStyle = 'rgba(30,30,60,.8)'; for (let y = 12; y < h - 6; y += 7) { g.beginPath(); g.moveTo(6, y - 1); for (let x = 6; x < w - 6; x += 4) g.lineTo(x, y - 1 - Math.random() * 3); g.stroke(); } g.fillStyle = 'rgba(160,20,20,.9)'; g.beginPath(); g.arc(w - 12, h - 12, 7, 0, 7); g.lineWidth = 2; g.strokeStyle = 'rgba(160,20,20,.9)'; g.stroke(); }) });
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), pageMat); m.rotation.x = -Math.PI / 2; scene.add(m); SM.pages.push(m); }
    // батарейки
    const batMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 }), capMat = new THREE.MeshStandardMaterial({ color: 0xd07020, roughness: 0.4, emissive: 0x401800, emissiveIntensity: 0.6 });
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      for (const dx of [-0.02, 0.02]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.06, 10), batMat); b.position.set(dx, 0.016, 0); b.rotation.z = Math.PI / 2; b.rotation.y = Math.PI / 2; g.add(b); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.02, 10), capMat); c.position.set(dx, 0.016, 0.022); c.rotation.x = Math.PI / 2; g.add(c); }
      scene.add(g); SM.bats.push(g);
    }
    // автоответчик в прихожей квартиры 27
    const y = APTS[2].f * B.FH;
    sbox(M.wood, 3.25, 3.7, y, y + 0.72, 13.95, 14.65, 1, true);
    addGeo(M.tvBody || (M.tvBody = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 })), geoAt(new THREE.BoxGeometry(0.22, 0.07, 0.18), 3.47, y + 0.755, 14.3));
    addGeo(M.tvBody, geoAt(new THREE.BoxGeometry(0.06, 0.05, 0.2), 3.4, y + 0.81, 14.3));
    OBJ.phoneLed = mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff1010, emissiveIntensity: 0 }), 3.56, y + 0.795, 14.22);
    OBJ.phone = V(3.47, y + 0.8, 14.3);
    // журнал дежурного в будке
    OBJ.journalMesh = mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: 0x1e3a24, roughness: 0.7 }), 1.5, 0.865, 11.25);
    OBJ.journalMesh.rotation.y = 0.25;
    OBJ.journal = V(1.5, 0.95, 11.25);
  }
  function placeStory() {
    ST.pg.forEach((s, i) => { const m = SM.pages[i]; m.position.copy(PAGE_SPOTS[s].pos); m.rotation.z = (s * 1.3) % 3; });
    ST.bt.forEach((s, i) => { SM.bats[i].position.copy(BAT_SPOTS[s]); SM.bats[i].rotation.y = s; });
  }
  function storyVisuals(dt) {
    SM.pages.forEach((m, i) => m.visible = !ST.pgot[i] && ST.ph !== 'intro');
    SM.bats.forEach((m, i) => m.visible = !ST.btg[i]);
    OBJ.journalMesh.visible = !ST.jr;
    OBJ.phoneLed.material.emissiveIntensity = ST.ph === 'night' && !ST.msg ? (Math.sin(S.t * 6) > 0 ? 6 : 0) : 0;
  }
  function newStory() {
    const sp = [0, 1, 2, 3, 4, 5]; for (let i = sp.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [sp[i], sp[j]] = [sp[j], sp[i]]; }
    // хотя бы одна запись — на лестнице у лифта (там опасно)
    if (!sp.slice(0, 3).some(s => s >= 4)) sp[2] = Math.random() < 0.5 ? 4 : 5;
    ST.pg = sp.slice(0, 3); ST.pgot = [0, 0, 0];
    const bs = [0, 1, 2, 3].sort(() => Math.random() - 0.5); ST.bt = bs.slice(0, 2); ST.btg = [0, 0];
    ST.code = String(100 + ((Math.random() * 900) | 0)).replace(/0/g, () => String(1 + ((Math.random() * 9) | 0)));
  }
  // ---------- фонарь садится ----------
  function updateBattery(dt) {
    if (!P.light || me().ghost) return;
    S.batt = Math.max(0, S.batt - dt * DF().drain * (ST.ph === 'night' ? 1 : 0.3));
    if (S.batt <= 0) { P.light = false; const b = $('bLight'); b && b.classList.remove('on'); toast('Фонарь сел. Ищи батарейки', 3); }
  }
  function flashK() { if (S.batt > 15) return 1; return S.batt <= 0 ? 0 : (Math.random() < 0.08 ? 0.1 : 0.45 + S.batt / 30); }
  // ---------- документы ----------
  const DOC = {
    news: () => `<div class="tap">✕ закрыть</div><div class="mast">ГЛУХОВСКИЙ ВЕСТНИК</div><h3>Взрыв на окраине Глухово</h3>
      <p>Минувшей ночью жители окраины Глухово проснулись от сильного взрыва. По словам очевидцев, над лесом низко пролетел беспилотник, после чего старый дом в конце просёлка — сразу за указателем «Глухово 2 км» — буквально сложился.</p>
      <p>В уцелевшем подвале спасатели нашли капканы, цепи, мешки и сломанную фарфоровую куклу. Соседи давно называли участок «домом убийц»: в округе годами пропадали дети. Среди вещей — детская куртка с пришитой биркой «ул. Заводская, 9, кв. 27».</p>
      <p>Пожилых хозяев дома так и не нашли. Полиция просит откликнуться водителя белого фургона, которого видели у ворот в ночь взрыва…</p>
      <div class="torn">…дальше газета оторвана и размокла под дождём</div>`,
    msg: () => `<div class="tap">✕ закрыть</div><div class="mast">АВТООТВЕТЧИК · 1 НОВОЕ СООБЩЕНИЕ</div>
      <p class="voice">«Сынок… Если ты это слышишь — значит, ты всё-таки выбрался из Глухова. Я знала.</p>
      <p class="voice">Не верь вахтёрше. Это Зинаида Петровна отдавала им детей. Она всё записывала — журнал лежит у неё в будке. Без него тебе никто не поверит. Не уходи без журнала.</p>
      <p class="voice">Дверь подъезда ночью на магнитном замке. Отключить его можно в щитке «ДОМОФОН» у лифта на первом этаже — там кодовый замок. Код я разорвала на три записки и спрятала по подъезду${ST.diff === 'easy' || ST.diff === 'normal' ? ': ' + ST.pg.map(s => PAGE_SPOTS[s].where).join(', ') : ''}. Щиток открывается трёхгранным ключом — он у бабы Нины в восемнадцатой.</p>
      <p class="voice">По лестнице ходит Он. Мокрый. Он боится света — береги фонарь. На лифт не садись и к дверям лифта не подходи. И что бы ни стучало сверху — у нас девять этажей…»</p>
      <div class="torn">— конец сообщения —</div>`,
    page: (i) => {
      const T = [
        ['12 марта', 'Опять пропал ребёнок — Витя из двенадцатой. Семёныч, лифтёр, говорит: видел, как мальчик уехал на лифте вниз. Но лифт у нас не ездит ниже первого этажа. Куда он уехал?'],
        ['2 июня', 'Зинаида Петровна завела журнал. Записывает, кто из детей остаётся дома один, во сколько приходят родители. Говорит — «для порядка». Ночью у подъезда опять стоял белый фургон без номеров. Пропал Миша из третьей.'],
        ['11 сентября', 'Сына нет. Мне говорят — сбежал, сам. Всю ночь сверху кто-то стучал по батарее, будто считал. У нас девять этажей. Над нами никого нет. Я найду тебя. Я спрячу всё, что узнала, — так, чтобы нашёл только ты.'],
      ][i];
      return `<div class="tap">✕ закрыть</div><div class="date">${T[0]}</div><p>${T[1]}</p><div class="dig">на полях обведено красным: <b>цифра ${i + 1} — ${ST.code[i]}</b></div>`;
    },
    journal: () => `<div class="tap">✕ закрыть</div><div class="mast">ЖУРНАЛ ДЕЖУРНОГО ПО ПОДЪЕЗДУ</div>
      <table><tr><td>кв. 12</td><td>Витя, 9 л. После школы один до 19:00</td><td>передан С. (лифт) 14.03</td></tr>
      <tr><td>кв. 3</td><td>Миша, 10 л. Мать в ночную смену</td><td>передан 02.06. <i>В Глухове бежал, упал в колодец. Не достали.</i></td></tr>
      <tr><td>кв. 27</td><td>мальчик, 8 л. Мать на сменах</td><td>передан 11.09 — фургон, Глухово</td></tr>
      <tr><td>10 эт.</td><td>«сосед»</td><td>не выпускать. Кормить по пятницам.</td></tr></table>
      <p class="voice">Миша. Мальчик из третьей квартиры, который утонул в колодце в Глухово. Мокрый — это он. Он просто не хочет быть один.</p>`,
    final: () => `<div class="mast">ГЛУХОВСКИЙ ВЕСТНИК · УТРЕННИЙ ВЫПУСК</div><h3>Дело «дома убийц» раскрыто</h3>
      <p>Под утро в отделение пришёл подросток с журналом дежурной по подъезду дома 9 на улице Заводской. По записям задержана вахтёрша Зинаида П. Лифтёр по прозвищу Семёныч объявлен в розыск: его кабину нашли застрявшей между этажами, внутри было пусто.</p>
      <p>В колодце у ${ST.boom ? 'разрушенного' : 'старого'} дома под Глухово водолазы подняли останки мальчика, пропавшего несколько лет назад. Жильцы дома 9 уверяют, что мокрые следы на лестнице с той ночи больше не появлялись.</p>
      <p>А вот стук сверху — продолжается. Хотя этажей в доме девять.</p>`,
  };
  function showDoc(kind, arg) {
    const el = $('paper'), np = el.querySelector('.np');
    np.className = 'np ' + kind; np.innerHTML = DOC[kind](arg);
    el.classList.remove('hidden'); P.ui = true; sfx.paper && sfx.paper();
  }
  function docTo(pid, kind, arg) { if (pid === myId) showDoc(kind, arg); else send({ t: 'c2doc', d: kind, a: arg }, true, pid); }
  // ---------- кодовый замок щитка ----------
  let kpVal = '';
  function openKeypad() { kpVal = ''; $('kpDisp').textContent = '_ _ _'; $('keypad').classList.remove('hidden'); P.ui = true; sfx2.click(); }
  function closeKeypad() { $('keypad').classList.add('hidden'); P.ui = false; }
  (() => {
    const kp = $('keypad'); if (!kp) return;
    kp.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation();
      const v = b.dataset.k; if (!v) return;
      if (v === 'x') { closeKeypad(); return; }
      if (v === 'del') kpVal = kpVal.slice(0, -1);
      else if (v === 'ok') { if (kpVal.length === 3) { closeKeypad(); if (isHost()) doAction(myId, 'code', kpVal); else send({ t: 'c2a', k: 'code', arg: kpVal }, true); } return; }
      else if (kpVal.length < 3) kpVal += v;
      sfx2.click(); $('kpDisp').textContent = (kpVal + '___').slice(0, 3).split('').join(' ');
    });
  })();
  // ---------- вахтёрша может проснуться, когда шаришь в будке ----------
  function boothRisk(p) {
    if (Math.random() < 0.35 * DF().wake) setTimeout(() => { const v = MON.vah; if (ST.ph !== 'night' || v.state !== 'sleep') return; v.state = 'awake'; v.timer = 8; fxAll('say', V(2.4, 1.4, 11), ['vah', 'yell']); hostNoise(V(0, 0.5, 11), 45, p.id); toastAll('Вахтёрша проснулась! Беги!', 2.5); }, 900 + Math.random() * 1200);
  }

  // ============ ДВЕРИ, ТЕЛЕВИЗОРЫ ============
  function updateWorld(dt) {
    for (const a of APTS) {
      const D = a.door, o = ST.doors[a.n] ? 1 : 0;
      D.open += (o - D.open) * Math.min(1, dt * 3); D.piv.rotation.y = D.open * 1.6;
      D.col.y1 = D.open > 0.6 ? D.col.y0 : D.col.y0 + 2.2;
      if (a.tvScr) { a.tvScr.material.emissiveMap.offset.set(Math.random(), Math.random()); a.tvT = (a.tvT || 0) - dt; if (a.tvT <= 0) { a.tvT = 1.4; if (cam.position.distanceTo(a.door.posIn) < 9) sfx2.tv(V(7, a.y + 1, 11.4)); } }
    }
    if (OBJ.tv27.material.emissiveIntensity > 0) OBJ.tv27.material.emissiveMap.offset.set(Math.random(), Math.random());
  }
  function hud(dt) {
    S.hudT = (S.hudT || 0) - dt; if (S.hudT > 0) return; S.hudT = 0.3;
    const el = $('ch2obj'), p = me();
    let t = objectiveText();
    if (ST.ph === 'night' && p && !p.ghost) t = '♥'.repeat(Math.max(0, p.lives)) + '  🔦' + Math.round(S.batt) + '%   ' + t;
    if (MPON() && ST.ph === 'night') { const g = [...RP.values()].filter(q => q.ghost).length; if (g) t += '   ·   призраков: ' + g; }
    if (el.textContent !== t) el.textContent = t;
    el.classList.toggle('hidden', !t || S.mode !== 'play');
  }

  // ============ ФОН ГЛАВНОГО МЕНЮ ============
  function menu(on) {
    if (on) {
      if (!S.built) { build(); warmup(); }
      if (S.on) return;
      S.menu = true; resize(); renderer.toneMappingExposure = 1.15;
      for (const k of ['wet', 'sosed']) MON[k].mesh.visible = false; MON.lifter.mesh.visible = false;
      parkVan(); driver.visible = false;
      rain(true, 0.55, 0);
    } else { if (S.menu && !S.on) rain(false); S.menu = false; }
  }
  function menuFrame(dt, noRender) {
    S.t += dt;
    const a = S.t * 0.05;
    cam.position.set(6.5 + Math.sin(a) * 2.5, 1.6 + Math.sin(a * 0.7) * 0.2, 3.6 + Math.cos(a) * 0.8);
    cam.lookAt(-0.8, 3.6, 10); cam.fov = 60; cam.updateProjectionMatrix();
    const cp = cam.position;
    updateRain(dt, cp, false); updateLights(dt, cp, false); updateLightning(dt, false);
    hemi.intensity = 0.35; scene.fog.density = 0.016;
    if (!noRender) composer.render(dt);
  }

  // ============ запуск / кадр ============
  function resize() {
    if (!S.built) return;
    const w = window.innerWidth, h = window.innerHeight;
    cam.aspect = w / h; cam.updateProjectionMatrix();
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    if (bloom) bloom.resolution.set(Math.min(512, w / 2), Math.min(512, h / 2));
  }
  // players: [{id, name, color, idx}] — для игры по сети; без него — одиночная
  function start(skipCut, players) {
    if (!S.built) { build(); warmup(); }
    resize();
    S.menu = false;
    resetST(); placeStory(); S.batt = 100;
    setupPlayers(players && players.length ? players : [{ id: ctx.myId ? ctx.myId() : 'me', name: 'Ты', color: 0x2a5a9a, idx: 0 }]);
    S.on = true; S.t = 0; S.cutT = 0; S.titled = false; S.mode = skipCut ? 'play' : 'cut';
    S.caught = null; S.ended = false; S.seqDark = false; S.figShow = false; S.runFig = 0; S.nightAt = 0;
    for (const k in EV) delete EV[k];
    for (const a of APTS) { a.door.open = 0; a.door.piv.rotation.y = 0; }
    for (const k of ['wet', 'sosed']) { const m = MON[k]; m.state = 'off'; m.vis = false; m.path = []; m.cur = null; m.tgt = null; m.speedNow = 0; m.timer = 0; m.mesh.visible = false; }
    MON.vah.state = 'sleep'; MON.vah.timer = 30;
    Object.assign(LF, { y: 0, ty: 0, f: 0, open: 0, state: 'idle', timer: 20, lifter: false });
    for (const pr of MON.prints) pr.visible = false;
    PL.hidden = -1; PL.seat = false; document.body.classList.remove('hiding', 'ghost');
    applyState();
    renderer.toneMappingExposure = 1.0;
    P.light = false; P.crouch = false; P.yaw = Math.PI; P.pitch = 0;
    document.body.classList.add('ch2');
    rain(true, 1, 0);
    if (skipCut) endCut(); else {
      document.body.classList.add('ch2cut'); $('ch2skip').classList.remove('hidden');
      driver.visible = false; vanDoor.position.set(0.3, 1.35, 1.04); OBJ.vanCol.y0 = OBJ.vanCol.y1 = 99;
      S.mode = 'wait'; S.waitT = 0; S.wait0 = performance.now(); updateCut(0);   // ждём, пока музыка заставки распакуется
      showFade('', 'загрузка…');
    }
  }
  function stop() {
    S.on = false; S.mode = 'off'; rain(false); stopTracks();
    for (const p of RP.values()) if (p.av) { scene.remove(p.av); p.av = null; }
    document.body.classList.remove('ch2', 'ch2cut', 'hiding', 'ghost'); $('ch2skip').classList.add('hidden'); $('ch2obj').classList.add('hidden');
    $('paper').classList.add('hidden'); $('keypad').classList.add('hidden'); $('red').style.opacity = 0;
    renderer.toneMappingExposure = 1.7; hideFade();
  }
  function frame(dt, paused, noRender) {
    if (!S.on) { if (S.menu && S.built) menuFrame(dt, noRender); return; }
    dt = Math.min(dt, 0.1);
    const mp = MPON();
    if (mp) paused = false;   // в сетевой игре мир не останавливается
    if (!paused) {
      S.t += dt;
      if (S.mode === 'wait') { S.waitT += dt; if (ctx.trackReady('ch2') || performance.now() - S.wait0 > 4000) { S.mode = 'cut'; S.cutT = 0; hideFade(); playTrack('ch2', true, 0, false); trackVol('ch2', null, 1, 34, 1.0); } }
      if (S.mode === 'death') updateDeath(dt);
      if (S.mode === 'cut') updateCut(dt);
      else if (S.mode === 'play' || S.mode === 'done') {
        if (S.mode === 'play' && !$('paper').classList.contains('hidden')) { /* читаем газету */ }
        else if (S.mode === 'play') updatePlayer(dt);
        const m = me(); m.pos.copy(PL.seat ? vanLocal(1.4, 0.45, -0.45) : PL.pos); m.yaw = P.yaw; m.pitch = P.pitch; m.crouch = P.crouch; m.light = P.light; m.hidden = PL.hidden; m.moving = PL.moving ? 1 : 0; if (PL.hidden >= 0) m.hideAt = PL.hideAt;
        localScares(dt); updateBattery(dt); storyVisuals(dt);
        S.fuelT = Math.max(0, (S.fuelT || 0) - dt); van.userData.fuelLamp.material.emissiveIntensity = S.fuelT > 0 && Math.sin(S.t * 12) > 0 ? 5 : 0;
        if (isHost()) {
          if (ST.power && !ST.seq && ST.ph === 'intro') for (const p of RP.values()) if (!p.ghost && Math.abs(p.pos.y - APTS[2].y) < 1 && p.pos.x > 5.7) { ST.seq = true; fxAll('seq'); break; }
          if (ST.ph === 'night') { updateWet(dt); updateSosed(dt); updateLift(dt); updateVah(dt); }
        }
        updateSeq(dt);
        updateWorld(dt);
        animMonsters(dt); drawFig(); animAvatars(dt);
        updateCaught(dt);
        if (S.mode === 'play') pickFocus();
        netTick(dt);
        hud(dt);
      }
    }
    if (S.mode === 'play' || S.mode === 'done') placeCam();
    const cp = cam.position;
    const inside = cp.x > -3.3 && cp.x < 9.6 && cp.z > 10.05 && cp.z < 18.7;
    updateRain(dt, cp, inside);
    updateLights(dt, cp, inside);
    updateLightning(paused ? 0 : dt, inside);
    hemi.intensity = inside ? 0.12 : 0.35;
    scene.fog.density = inside ? 0.035 : 0.016;
    rain(true, 1, inside ? 0.85 : 0);
    ctx.setListener(cp.x, cp.y, cp.z, P.yaw);
    if (!noRender) composer.render(dt);
  }
  function closePaper() { $('paper').classList.add('hidden'); }
  return {
    showDoc, openKeypad, placeStory, scene: () => scene, over: (w) => overSeq(w),
    dropPlayer: (id) => { const p = RP.get(id); if (p) { if (p.av) scene.remove(p.av); RP.delete(id); } },
    S, ST, MON, LF, RP, start, stop, frame, act, resize, menu, net: onNet, closePaper,
    setCut: (t) => { S.cutT = t; updateCut(0); }, PL, COL, freeAt: (x, z, y) => freeAt(x, z, y), surfY: (x, z, y) => surfY(x, z, y), OBJ, EV, cam,
    skip: () => { if (S.mode === 'cut' || S.mode === 'wait') { S.cutT = CUT_LEN + 2; endCut(); } },
    objectiveText, startNight: () => { if (isHost()) { ST.seq = true; EV.seq = true; EV.seqT = 9; EV.seqDone = true; startNight(); } },
    doAct: (k, arg) => doAction(myId, k, arg), focus: () => focus && focus.label, me: () => me(),
    tp: (x, y, z) => { PL.pos.set(x, y, z); PL.y = y; }, nodes: NODES, goTo, placeAt,
  };
}
