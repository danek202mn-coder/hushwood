import * as THREE from 'three';
import { box, grime, stain } from './world.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V2 = THREE.Vector2;
const Lm = (o) => new THREE.MeshLambertMaterial(o);
const C = (c, e) => Lm({ color: c, emissive: e || 0 });
function joint(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
function capsule(r, len, mat, seg = 12, r2) {
  // сужающийся сегмент конечности
  const g = r2 ? new THREE.CylinderGeometry(r2, r, len, seg, 1, true) : new THREE.CapsuleGeometry(r, len, 4, seg);
  const m = new THREE.Mesh(g, mat); m.position.y = -len / 2; return m;
}
function sphere(r, mat, x, y, z, sx = 1, sy = 1, sz = 1, seg = 16) { const m = mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), mat, x, y, z); m.scale.set(sx, sy, sz); return m; }
function lathe(pts, mat, seg = 20, fold = 0, folds = 8) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new V2(r, y)), seg);
  if (fold) { // складки ткани
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const a = Math.atan2(z, x); const k = 1 + Math.sin(a * folds) * fold * Math.min(1, Math.max(0, -y * 2)); p.setX(i, x * k); p.setZ(i, z * k); }
    g.computeVertexNormals();
  }
  return new THREE.Mesh(g, mat);
}
function cone(r, h, mat, seg = 8) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat); }
// конечность: плечо → локоть → кисть, со сферами в суставах (без щелей)
function limb(parent, x, y, z, l1, r1, l2, r2, m1, m2) {
  const a = joint(parent, x, y, z); a.add(sphere(r1 * 1.05, m1, 0, 0, 0)); a.add(capsule(r1, l1, m1, 12, r1 * 0.85));
  const b = joint(a, 0, -l1, 0); b.add(sphere(r2 * 1.1, m2 || m1, 0, 0, 0)); b.add(capsule(r2, l2, m2 || m1, 12, r2 * 0.8));
  const end = joint(b, 0, -l2, 0);
  return { a, b, end };
}
function hand(parent, skin, fl = 0.09, nail) {
  parent.add(sphere(0.042, skin, 0, -0.03, 0, 0.9, 1.1, 0.55));
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = joint(parent, -0.027 + i * 0.018, -0.07, 0.003);
    const len = fl * (i === 0 || i === 3 ? 0.78 : 1);
    f.add(capsule(0.0085, len, skin, 6));
    if (nail) f.add(box(0.012, 0.018, 0.006, nail, 0, -len - 0.004, 0.006));
    f.rotation.x = 0.25; fingers.push(f);
  }
  const th = joint(parent, 0.038, -0.03, 0.015); th.add(capsule(0.01, fl * 0.55, skin, 6)); th.rotation.z = 0.7;
  return fingers;
}
// рот с челюстью и зубами
function mouth(head, skin, y, z, w, teethCol = 0xd8c890) {
  const inside = Lm({ color: 0x170505 });
  head.add(sphere(0.045, inside, 0, y, z - 0.012, w / 0.09, 0.6, 0.6, 10));
  const tm = Lm({ color: teethCol });
  for (let i = 0; i < 6; i++) head.add(box(0.011, 0.015 + (i % 2) * 0.005, 0.01, tm, -w * 0.4 + i * w * 0.16, y + 0.012, z + 0.003));
  const jaw = joint(head, 0, y + 0.005, z - 0.05);
  jaw.add(sphere(0.06, skin, 0, -0.03, 0.04, w / 0.11, 0.55, 0.85, 14));
  for (let i = 0; i < 5; i++) jaw.add(box(0.011, 0.013, 0.01, tm, -w * 0.32 + i * w * 0.16, -0.008, 0.05));
  return jaw;
}

// ---------- нарисованные лица ----------
// Сфера three.js: перед головы (+Z) — u = 0.25. Холст 512×256: центр лица x = 128.
function faceTex(draw, seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'); draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}
const FX = 128, ry = (theta) => theta / Math.PI * 256;   // широта → строка холста
function skinBase(g, base, seed) {
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  grime(g, 512, 256, seed, 0.25);
  // румянец/тени
  const sh = g.createLinearGradient(0, 0, 0, 256); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = sh; g.fillRect(0, 0, 512, 256);
}
function wrinkle(g, x0, y0, x1, y1, bend, a = 0.35, w = 1.4) {
  g.strokeStyle = `rgba(40,20,10,${a})`; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + bend, x1, y1); g.stroke();
  g.strokeStyle = `rgba(255,235,215,${a * 0.35})`; g.lineWidth = w * 0.8; g.beginPath(); g.moveTo(x0, y0 + 1.5); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + bend + 1.5, x1, y1 + 1.5); g.stroke();
}
function hostessFace() {
  return faceTex((g) => {
    skinBase(g, '#a99886', 501);
    // впалые щёки
    stain(g, FX - 30, ry(0.6 * Math.PI), 22, 'rgba(60,30,30,1)', 0.45); stain(g, FX + 30, ry(0.6 * Math.PI), 22, 'rgba(60,30,30,1)', 0.45);
    // тёмные впадины под повязкой и потёки
    stain(g, FX - 18, ry(0.5 * Math.PI), 14, 'rgba(30,10,10,1)', 0.7); stain(g, FX + 18, ry(0.5 * Math.PI), 14, 'rgba(30,10,10,1)', 0.7);
    g.fillStyle = 'rgba(90,0,0,0.75)'; g.fillRect(FX - 20, ry(0.5 * Math.PI), 3, 26); g.fillRect(FX + 17, ry(0.5 * Math.PI), 3, 20);
    // лоб: глубокие морщины
    for (let i = 0; i < 4; i++) wrinkle(g, FX - 34 + i * 2, ry(0.3 * Math.PI) + i * 6, FX + 34 - i * 2, ry(0.3 * Math.PI) + i * 6, -4, 0.45);
    // носогубные складки
    wrinkle(g, FX - 12, ry(0.56 * Math.PI), FX - 22, ry(0.7 * Math.PI), -6, 0.55, 2); wrinkle(g, FX + 12, ry(0.56 * Math.PI), FX + 22, ry(0.7 * Math.PI), 6, 0.55, 2);
    // вокруг рта
    for (let i = -3; i <= 3; i++) wrinkle(g, FX + i * 4, ry(0.64 * Math.PI), FX + i * 4.5, ry(0.69 * Math.PI), 0, 0.35, 1);
    // губы тонкие
    g.fillStyle = 'rgba(110,50,50,0.8)'; g.fillRect(FX - 12, ry(0.655 * Math.PI), 24, 2.5);
    // бородавка
    g.fillStyle = '#5a3a2a'; g.beginPath(); g.arc(FX + 24, ry(0.62 * Math.PI), 2.8, 0, 7); g.fill(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(FX + 24, ry(0.62 * Math.PI)); g.lineTo(FX + 27, ry(0.6 * Math.PI)); g.stroke();
    // пигментные пятна
    for (let i = 0; i < 12; i++) stain(g, FX + (Math.sin(i * 7.1) * 50), ry((0.3 + (i % 5) * 0.08) * Math.PI), 3 + (i % 3), 'rgba(90,60,40,1)', 0.5);
    // шея — морщины
    for (let i = 0; i < 4; i++) wrinkle(g, FX - 30, ry(0.82 * Math.PI) + i * 7, FX + 30, ry(0.82 * Math.PI) + i * 7, 5, 0.3);
  }, 501);
}
function watchmanFace(open) {
  return faceTex((g) => {
    skinBase(g, '#9c8c78', 601);
    for (let i = 0; i < 5; i++) wrinkle(g, FX - 36, ry(0.27 * Math.PI) + i * 6, FX + 36, ry(0.27 * Math.PI) + i * 6, -3, 0.4);
    // мешки под глазами
    for (const s of [-1, 1]) { stain(g, FX + s * 25, ry(0.53 * Math.PI), 17, 'rgba(70,40,50,1)', 0.55); wrinkle(g, FX + s * 13, ry(0.54 * Math.PI), FX + s * 37, ry(0.54 * Math.PI), 5, 0.5); wrinkle(g, FX + s * 14, ry(0.565 * Math.PI), FX + s * 36, ry(0.57 * Math.PI), 6, 0.35); }
    // «гусиные лапки»
    for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) wrinkle(g, FX + s * 40, ry(0.48 * Math.PI), FX + s * 52, ry(0.48 * Math.PI) + i * 7, 0, 0.4);
    // глаза: закрытые веки или выпученные
    for (const s of [-1, 1]) {
      const ex = FX + s * 25, ey = ry(0.47 * Math.PI);
      if (open) {
        g.fillStyle = '#e8e2c8'; g.beginPath(); g.ellipse(ex, ey, 13, 9, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(160,40,40,0.6)'; g.lineWidth = 0.8; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(ex - 8, ey + k - 2); g.lineTo(ex - 3, ey); g.stroke(); }
        g.fillStyle = '#3a4a3a'; g.beginPath(); g.arc(ex, ey, 5.5, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(ex, ey, 2.6, 0, 7); g.fill();
        g.strokeStyle = '#2a1a10'; g.lineWidth = 2; g.beginPath(); g.ellipse(ex, ey, 13, 9, 0, 0, 7); g.stroke();
      } else {
        g.strokeStyle = '#3a2418'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ex - 13, ey); g.quadraticCurveTo(ex, ey + 6, ex + 13, ey); g.stroke();
        for (let k = -4; k <= 4; k++) { g.lineWidth = 1; g.beginPath(); g.moveTo(ex + k * 2.6, ey + 4); g.lineTo(ex + k * 3, ey + 7.5); g.stroke(); }
      }
      // кустистые брови
      g.fillStyle = '#d0ccc0'; for (let k = 0; k < 26; k++) { g.save(); g.translate(ex - 15 + k * 1.2, ey - 16 + Math.abs(k - 13) * 0.25); g.rotate(s * 0.5 + (k % 3) * 0.2); g.fillRect(0, 0, 1.5, 7); g.restore(); }
    }
    // носогубные
    wrinkle(g, FX - 11, ry(0.56 * Math.PI), FX - 20, ry(0.68 * Math.PI), -6, 0.5, 2); wrinkle(g, FX + 11, ry(0.56 * Math.PI), FX + 20, ry(0.68 * Math.PI), 6, 0.5, 2);
    // щетина
    for (let i = 0; i < 260; i++) { const a = Math.random() * 1.2 - 0.6, r = 0.62 + Math.random() * 0.2; g.fillStyle = 'rgba(200,200,190,0.5)'; g.fillRect(FX + a * 60, ry(r * Math.PI), 1, 1.5); }
    for (let i = 0; i < 10; i++) stain(g, FX + Math.sin(i * 5.3) * 46, ry((0.25 + (i % 4) * 0.08) * Math.PI), 3, 'rgba(90,60,40,1)', 0.5);
  }, 601 + (open ? 1 : 0));
}
function dollFace() {
  return faceTex((g) => {
    g.fillStyle = '#ece4da'; g.fillRect(0, 0, 512, 256); grime(g, 512, 256, 701, 0.12);
    for (const s of [-1, 1]) {
      const ex = FX + s * 22, ey = ry(0.53 * Math.PI);
      g.fillStyle = 'rgba(210,90,90,0.55)'; g.beginPath(); g.ellipse(FX + s * 30, ry(0.64 * Math.PI), 10, 6, 0, 0, 7); g.fill();
      g.strokeStyle = '#1a0a0a'; g.lineWidth = 1.5; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(ex - 12 + k * 4, ey - 9); g.lineTo(ex - 14 + k * 4.5, ey - 15 - Math.sin(k / 6 * Math.PI) * 3); g.stroke(); }
      g.strokeStyle = '#4a2a1a'; g.lineWidth = 2; g.beginPath(); g.arc(ex, ey - 6, 14, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    g.fillStyle = '#9a1a1a'; g.beginPath(); g.ellipse(FX, ry(0.72 * Math.PI), 6, 3, 0, 0, 7); g.fill();
    // трещина через лицо
    g.strokeStyle = 'rgba(40,30,25,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(FX + 30, ry(0.25 * Math.PI)); g.lineTo(FX + 22, ry(0.4 * Math.PI)); g.lineTo(FX + 28, ry(0.5 * Math.PI)); g.lineTo(FX + 14, ry(0.65 * Math.PI)); g.stroke();
  }, 701);
}
function kidFace() {
  return faceTex((g) => {
    skinBase(g, '#d0aa8c', 801);
    for (const s of [-1, 1]) { const ex = FX + s * 24, ey = ry(0.5 * Math.PI); g.fillStyle = '#f0ece4'; g.beginPath(); g.ellipse(ex, ey, 10, 6.5, 0, 0, 7); g.fill(); g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(ex, ey, 4.6, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(ex, ey, 2.2, 0, 7); g.fill(); g.fillStyle = '#3a2418'; g.fillRect(ex - 11, ey - 14, 22, 3.5); }
    g.fillStyle = 'rgba(120,60,50,0.8)'; g.fillRect(FX - 12, ry(0.67 * Math.PI), 24, 3);
    stain(g, FX - 28, ry(0.6 * Math.PI), 8, 'rgba(200,100,90,1)', 0.25); stain(g, FX + 28, ry(0.6 * Math.PI), 8, 'rgba(200,100,90,1)', 0.25);
  }, 801);
}
function headMesh(r, mat, sx, sy, sz) { return sphere(r, mat, 0, 0, 0, sx, sy, sz, 24); }

// ================= ХОЗЯЙКА =================
export function makeHostess(T) {
  const skin = Lm({ color: 0xa99886 }), face = Lm({ map: hostessFace() });
  const dress = Lm({ map: T.fabric('#2c3826', 52) }), cardigan = Lm({ map: T.knit('#4a3a34', 53) });
  const hair = C(0x9a9890), band = C(0xd8d2c0), blood = C(0x5a0a0a), shoe = C(0x1a120c), nail = C(0x6a5a3a), stock = C(0x3a3430);
  const root = new THREE.Group();
  const hips = joint(root, 0, 0.92, 0);
  const skirt = lathe([[0.17, 0.02], [0.22, -0.15], [0.29, -0.45], [0.36, -0.76], [0.39, -0.86], [0.37, -0.88]], dress, 28, 0.08, 9); skirt.material.side = THREE.DoubleSide; hips.add(skirt);
  const ap = new THREE.Mesh(new THREE.LatheGeometry([[0.2, -0.02], [0.27, -0.3], [0.33, -0.62], [0.34, -0.64]].map(([r, y]) => new V2(r * 1.06, y)), 14, Math.PI * 0.62 - Math.PI / 2, Math.PI * 0.76), Lm({ map: T.fabric('#7a7262', 54), side: THREE.DoubleSide })); hips.add(ap);
  const legs = [-1, 1].map(s => { const l = limb(hips, 0.1 * s, -0.02, 0, 0.42, 0.055, 0.42, 0.045, stock); l.end.add(box(0.09, 0.07, 0.22, shoe, 0, -0.03, 0.05)); return l; });
  const spine = joint(hips, 0, 0, 0); spine.rotation.x = 0.42;
  spine.add(lathe([[0.16, -0.02], [0.19, 0.12], [0.21, 0.3], [0.19, 0.42], [0.12, 0.5], [0.05, 0.53]], cardigan, 22));
  // горб и шаль
  spine.add(sphere(0.15, cardigan, 0, 0.36, -0.08, 1.2, 0.9, 0.9));
  const sh = lathe([[0.21, 0.32], [0.225, 0.42], [0.16, 0.49], [0.07, 0.52]], Lm({ map: T.knit('#3a2a2a', 55) }), 22, 0.05, 7); sh.material.side = THREE.DoubleSide; spine.add(sh);
  for (let i = 0; i < 4; i++) spine.add(sphere(0.012, C(0xc8b890), 0, 0.12 + i * 0.08, 0.2));
  const neck = joint(spine, 0, 0.5, 0.02); neck.add(capsule(0.042, 0.07, skin)); neck.children[0].position.y = 0.04;
  spine.add(box(0.012, 0.12, 0.012, C(0x5a1010), 0, 0.42, 0.19));
  const bellM = lathe([[0, 0.05], [0.025, 0.045], [0.035, 0.01], [0.045, -0.02], [0.0, -0.02]], C(0xc9a227, 0x2a1800), 12); bellM.position.set(0, 0.34, 0.2); spine.add(bellM);
  const head = joint(neck, 0, 0.09, 0.02); head.scale.setScalar(1.12);
  const hm = headMesh(0.115, face, 0.93, 1.13, 1.0); hm.position.y = 0.09; hm.rotation.y = 0; head.add(hm);
  head.add(sphere(0.055, face, 0, 0.0, 0.05, 1.0, 0.75, 0.9));
  // скулы и надбровья
  head.add(sphere(0.03, skin, -0.06, 0.08, 0.075, 1, 0.7, 0.6)); head.add(sphere(0.03, skin, 0.06, 0.08, 0.075, 1, 0.7, 0.6));
  const nose = cone(0.017, 0.065, skin, 8); nose.rotation.x = Math.PI / 2 + 0.4; nose.position.set(0, 0.085, 0.125); head.add(nose);
  head.add(sphere(0.013, skin, 0, 0.055, 0.15, 1.2, 0.8, 1));
  // повязка
  const bnd = new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.121, 0.055, 24, 1, true), Lm({ color: 0xd8d2c0, side: THREE.DoubleSide })); bnd.position.y = 0.125; bnd.scale.set(0.98, 1, 1.06); head.add(bnd);
  head.add(sphere(0.022, blood, -0.045, 0.12, 0.124, 1, 0.8, 0.3)); head.add(sphere(0.018, blood, 0.05, 0.125, 0.122, 1, 0.8, 0.3));
  head.add(box(0.05, 0.05, 0.02, band, 0.11, 0.115, -0.06)); head.add(box(0.02, 0.12, 0.01, band, 0.115, 0.06, -0.07));
  for (const s of [-1, 1]) head.add(sphere(0.024, skin, 0.112 * s, 0.09, 0, 0.4, 1.1, 0.7));
  head.add(mesh(new THREE.SphereGeometry(0.126, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0, 0.13, -0.012));
  head.add(sphere(0.07, hair, 0, 0.2, -0.1, 1, 0.9, 1));
  for (let i = 0; i < 9; i++) { const s = box(0.008, 0.12 + (i % 3) * 0.06, 0.008, hair, -0.11 + i * 0.027, 0.06, -0.06 + (i % 2) * 0.03); s.rotation.z = (i - 4) * 0.07; head.add(s); }
  const jaw = mouth(head, skin, 0.028, 0.104, 0.072);
  const arms = [-1, 1].map(s => { const a = limb(spine, 0.22 * s, 0.43, 0, 0.3, 0.048, 0.28, 0.04, cardigan, cardigan); const cuff = joint(a.end, 0, 0.01, 0); cuff.add(sphere(0.04, skin, 0, -0.02, 0, 0.9, 0.6, 0.9)); a.fingers = hand(a.end, skin, 0.1, nail); return a; });
  const cane = mesh(new THREE.CylinderGeometry(0.018, 0.016, 1.05, 8), Lm({ map: T.wood }), 0, -0.45, 0.02); arms[1].end.add(cane);
  root.userData = { kind: 'hostess', hips, spine, neck, head, jaw, legs, arms, cane, eyeH: 1.62, scareDist: 0.55, hunch: 0.42 };
  return bakeRig(root);
}

// ================= СТОРОЖ =================
export function makeWatchman(T) {
  const skin = Lm({ color: 0x9c8c78 }), faceC = watchmanFace(false), faceO = watchmanFace(true), face = Lm({ map: faceC });
  const shirt = Lm({ map: T.fabric('#b4ae9c', 62), side: THREE.DoubleSide });
  const beard = C(0xd4d0c6), dark = C(0x100a06), nail = C(0x5a4a30), slipper = Lm({ map: T.knit('#5a2a2a', 63) });
  const root = new THREE.Group();
  const hips = joint(root, 0, 1.0, 0);
  const legs = [-1, 1].map(s => { const l = limb(hips, 0.1 * s, 0, 0, 0.47, 0.055, 0.48, 0.042, skin); l.end.add(sphere(0.07, slipper, 0, -0.02, 0.05, 0.8, 0.5, 1.7)); return l; });
  const spine = joint(hips, 0, 0, 0); spine.rotation.x = 0.1;
  spine.add(lathe([[0.15, -0.02], [0.17, 0.2], [0.17, 0.45], [0.2, 0.6], [0.12, 0.66], [0.05, 0.68]], shirt, 22));
  const hem = lathe([[0.16, 0.02], [0.21, -0.3], [0.27, -0.6], [0.27, -0.63]], shirt, 24, 0.07, 7); hips.add(hem);
  spine.add(box(0.03, 0.4, 0.01, C(0x8a8478), 0, 0.42, 0.175));
  for (let i = 0; i < 4; i++) spine.add(sphere(0.012, C(0xe0d8c8), 0, 0.3 + i * 0.09, 0.18));
  const neck = joint(spine, 0, 0.66, 0); neck.add(capsule(0.045, 0.08, skin)); neck.children[0].position.y = 0.05;
  const head = joint(neck, 0, 0.1, 0.01);
  const hm = headMesh(0.11, face, 0.92, 1.28, 1.0); hm.position.y = 0.1; head.add(hm);
  const nose = cone(0.018, 0.06, skin, 8); nose.rotation.x = Math.PI / 2 + 0.45; nose.position.set(0, 0.095, 0.115); head.add(nose);
  head.add(sphere(0.014, skin, 0, 0.072, 0.13, 1.3, 0.8, 1));
  for (const s of [-1, 1]) head.add(sphere(0.026, skin, 0.105 * s, 0.1, 0, 0.4, 1.2, 0.7));
  const jaw = mouth(head, skin, 0.035, 0.098, 0.07, 0x9a8a60);
  const bd = lathe([[0.0, -0.28], [0.03, -0.22], [0.056, -0.11], [0.07, -0.02], [0.05, 0.02]], beard, 14, 0.12, 9); bd.position.set(0, -0.035, 0.07); bd.scale.z = 0.6; jaw.add(bd);
  for (const s of [-1, 1]) { const mu = capsule(0.012, 0.05, beard, 6); mu.rotation.z = s * 1.9; mu.position.set(s * 0.025, 0.058, 0.105); head.add(mu); }
  const capM = Lm({ map: T.capStripe });
  // ночной колпак: один изогнутый конус, свисающий назад
  const capG = new THREE.CylinderGeometry(0.018, 0.113, 0.42, 16, 12, false);
  { const p = capG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = (y + 0.21) / 0.42; p.setZ(i, p.getZ(i) - t * t * 0.26); p.setY(i, -0.21 + t * 0.3 - t * t * 0.08); } capG.computeVertexNormals(); }
  const capMesh = mesh(capG, capM, 0, 0.4, -0.015); head.add(capMesh);
  const cp = joint(head, 0, 0.39, -0.28);
  cp.add(sphere(0.04, C(0xe0d8c8), 0, 0.03, 0));
  const arms = [-1, 1].map(s => { const a = limb(spine, 0.23 * s, 0.6, 0, 0.34, 0.045, 0.32, 0.038, shirt, skin); a.fingers = hand(a.end, skin, 0.1, nail); return a; });
  const lantern = joint(arms[1].end, 0, -0.12, 0.02);
  const frameM = C(0x2a2a28);
  lantern.add(box(0.17, 0.03, 0.17, frameM, 0, 0.12, 0)); lantern.add(box(0.17, 0.03, 0.17, frameM, 0, -0.12, 0));
  for (const [x, z] of [[-0.075, -0.075], [0.075, -0.075], [-0.075, 0.075], [0.075, 0.075]]) lantern.add(box(0.015, 0.24, 0.015, frameM, x, 0, z));
  lantern.add(mesh(new THREE.ConeGeometry(0.1, 0.07, 4), frameM, 0, 0.17, 0).rotateY(Math.PI / 4));
  const glow = box(0.12, 0.2, 0.12, new THREE.MeshBasicMaterial({ color: 0xffcf70 })); glow.userData.keep = true; lantern.add(glow);
  lantern.add(mesh(new THREE.TorusGeometry(0.04, 0.008, 4, 10), frameM, 0, 0.23, 0));
  const spot = new THREE.SpotLight(0xffc860, 40, 17, 0.55, 0.55, 1.4);
  const tgt = new THREE.Object3D(); root.add(tgt); tgt.position.set(0, 0.4, 6);
  spot.position.set(0.3, 1.45, 0.55); spot.target = tgt; root.add(spot);
  root.userData = { kind: 'watchman', hips, spine, neck, head, jaw, legs, arms, lantern, spot, glow, face, faceC, faceO, eyeH: 1.92, scareDist: 0.62 };
  return bakeRig(root);
}

// ================= КУКЛА =================
export function makeDoll(T) {
  const porc = Lm({ map: T.porcelain }), face = Lm({ map: dollFace() }), dress = Lm({ map: T.fabric('#2a4470', 71), side: THREE.DoubleSide }), lace = C(0xe8e2d6);
  const hairM = C(0x3a1e0e), gold = C(0xb08a30, 0x281800), shoe = C(0x1a0a0a);
  const root = new THREE.Group();
  root.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), C(0x2a2a2a), 0, 0.22, 0));
  root.add(mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 8), C(0x2a2a2a), 0, 0.43, 0));
  const body = joint(root, 0, 0, 0);
  const torso = joint(body, 0, -0.16, 0);
  torso.add(lathe([[0.06, 0.12], [0.08, 0.04], [0.07, -0.06], [0.1, -0.1], [0.2, -0.32], [0.22, -0.36], [0.0, -0.36]], dress, 20, 0.1, 10));
  torso.add(lathe([[0.215, -0.33], [0.24, -0.38], [0.22, -0.4]], lace, 20, 0.12, 14));
  torso.add(lathe([[0.09, 0.1], [0.11, 0.12], [0.06, 0.14]], lace, 14));
  const legs = [-1, 1].map(s => { const l = limb(torso, 0.06 * s, -0.33, 0, 0.12, 0.022, 0.12, 0.02, porc); l.end.add(box(0.045, 0.035, 0.07, shoe, 0, -0.01, 0.015)); return l; });
  const head = joint(body, 0, 0.02, 0);
  head.add(headMesh(0.15, face, 1, 1.05, 1));
  const eyeMat = Lm({ color: 0x050505, emissive: 0x000000 });
  const eyes = [-1, 1].map(s => { head.add(sphere(0.04, C(0xf0ece4), 0.058 * s, 0.0, 0.124, 1, 1, 0.6)); head.add(sphere(0.029, Lm({ color: 0x2a5a8a }), 0.058 * s, 0.0, 0.143, 1, 1, 0.4)); const p = sphere(0.015, eyeMat, 0.058 * s, 0.0, 0.153, 1, 1, 0.4); p.userData.keep = true; head.add(p); return p; });
  head.add(sphere(0.012, porc, 0, -0.03, 0.15));
  const jaw = mouth(head, porc, -0.08, 0.128, 0.06, 0xf0ece4);
  const hcap = mesh(new THREE.SphereGeometry(0.158, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hairM, 0, 0.01, -0.01); hcap.rotation.x = -0.35; head.add(hcap);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 1.4 + Math.PI * 0.8; head.add(sphere(0.034, hairM, Math.sin(a) * 0.14, -0.04 - (i % 3) * 0.022, Math.cos(a) * 0.12)); }
  for (const s of [-1, 1]) { head.add(sphere(0.04, C(0x8a1a2a), 0.12 * s, 0.11, -0.03, 1.4, 0.7, 0.5)); const tail = joint(head, 0.15 * s, 0.0, -0.06); tail.add(capsule(0.03, 0.16, hairM)); tail.rotation.z = 0.25 * s; }
  const arms = [-1, 1].map(s => { const a = limb(torso, 0.1 * s, 0.07, 0, 0.12, 0.02, 0.12, 0.018, porc); a.end.add(sphere(0.022, porc, 0, -0.01, 0)); a.a.rotation.z = 0.15 * s; return a; });
  const key = joint(torso, 0, 0, -0.08);
  key.add(box(0.015, 0.015, 0.08, gold, 0, 0, -0.04));
  const w1 = mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 10), gold, -0.045, 0, -0.08); w1.rotation.y = Math.PI / 2; key.add(w1);
  const w2 = w1.clone(); w2.position.x = 0.045; key.add(w2);
  root.userData = { kind: 'doll', body, torso, head, jaw, legs, arms, key, eyes, eyeMat, eyeH: 0, scareDist: 0.4 };
  return bakeRig(root);
}

// ================= НЕЧТО =================
export function makeThing(T) {
  const flesh = new THREE.MeshPhongMaterial({ map: T.flesh, shininess: 60, specular: 0x553355 }), flesh2 = new THREE.MeshPhongMaterial({ map: T.flesh, color: 0xc080c0, shininess: 40, specular: 0x442244 });
  const eyeW = Lm({ color: 0xd8e0a0, emissive: 0x606018 }), pupil = Lm({ color: 0x000000 });
  const root = new THREE.Group();
  const bodyG = new THREE.IcosahedronGeometry(0.75, 3);
  const pos = bodyG.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const n = 1 + Math.sin(x * 7) * 0.08 + Math.cos(y * 9 + z * 5) * 0.07 + Math.sin(z * 11 + x * 3) * 0.04; pos.setXYZ(i, x * n, y * n * 0.85, z * n); }
  bodyG.computeVertexNormals();
  const core = mesh(bodyG, flesh, 0, 0.75, 0); core.userData.keep = true; root.add(core);
  for (let i = 0; i < 6; i++) { const a = i * 1.1; root.add(sphere(0.18 + (i % 3) * 0.06, flesh2, Math.sin(a) * 0.45, 0.9 + Math.cos(a * 2) * 0.35, Math.cos(a) * 0.45)); }
  const jaw = joint(root, 0, 0.7, 0.62);
  jaw.add(sphere(0.26, Lm({ color: 0x0a0004 }), 0, 0, 0, 1, 0.6, 0.35));
  const toothM = C(0xd8d0a0);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const t = cone(0.024, 0.1, toothM, 5); t.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.13, 0.04); t.rotation.z = a + Math.PI / 2; jaw.add(t); }
  const eyes = [];
  [[0.22, 1.18, 0.52, 0.09], [-0.28, 1.08, 0.55, 0.07], [0.0, 1.38, 0.38, 0.06], [0.45, 0.98, 0.38, 0.05], [-0.45, 1.25, 0.3, 0.05], [0.12, 1.0, 0.68, 0.04]].forEach(([x, y, z, r]) => {
    const e = joint(root, x, y, z); e.add(sphere(r, eyeW, 0, 0, 0)); e.add(sphere(r * 0.45, pupil, 0, 0, r * 0.75, 1, 1.6, 0.5)); e.lookAt(x * 3, y, 5); eyes.push(e);
  });
  const tents = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    let p = joint(root, Math.sin(a) * 0.55, 0.35, Math.cos(a) * 0.55); p.rotation.y = a;
    const base = p, segs = [];
    let r = 0.13;
    for (let s = 0; s < 6; s++) {
      const seg = joint(p, 0, 0, s === 0 ? 0 : 0.28);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.2, 3, 8), s % 2 ? flesh2 : flesh); m.rotation.x = Math.PI / 2; m.position.z = 0.14; seg.add(m);
      segs.push(seg); p = seg; r *= 0.8;
    }
    tents.push({ base, segs, phase: i * 0.8 });
  }
  root.userData = { kind: 'thing', core, tents, eyes, jaw, eyeH: 1.0, scareDist: 1.35 };
  return bakeRig(root);
}

// ================= ИГРОК (сетевая игра) =================
export function makeKid(T, color, name) {
  const skin = Lm({ color: 0xd0aa8c }), face = Lm({ map: kidFace() }), hood = Lm({ map: T.knit('#' + color.toString(16).padStart(6, '0'), 81) });
  const jeans = Lm({ map: T.fabric('#2a3448', 83) }), shoe = C(0xe0dcd0), hairM = C(0x3a2618), pack = C(0x3a3a2a);
  const root = new THREE.Group();
  const hips = joint(root, 0, 0.82, 0);
  const legs = [-1, 1].map(s => { const l = limb(hips, 0.09 * s, 0, 0, 0.38, 0.062, 0.38, 0.052, jeans); l.end.add(box(0.1, 0.07, 0.24, shoe, 0, -0.03, 0.05)); return l; });
  const spine = joint(hips, 0, 0, 0);
  spine.add(lathe([[0.15, -0.04], [0.18, 0.15], [0.19, 0.35], [0.14, 0.48], [0.06, 0.52]], hood, 18));
  spine.add(box(0.28, 0.32, 0.14, pack, 0, 0.28, -0.2));
  spine.add(sphere(0.12, hood, 0, 0.5, -0.1, 1.2, 0.7, 1));
  const neck = joint(spine, 0, 0.5, 0); neck.add(capsule(0.04, 0.05, skin)); neck.children[0].position.y = 0.04;
  const head = joint(neck, 0, 0.08, 0);
  const hm = headMesh(0.11, face, 0.95, 1.05, 1); hm.position.y = 0.1; head.add(hm);
  head.add(mesh(new THREE.SphereGeometry(0.118, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), hairM, 0, 0.12, -0.01));
  { const kn = cone(0.015, 0.04, skin, 6); kn.rotation.x = Math.PI / 2; kn.position.set(0, 0.09, 0.115); head.add(kn); }
  const arms = [-1, 1].map(s => { const a = limb(spine, 0.21 * s, 0.44, 0, 0.28, 0.05, 0.26, 0.045, hood); a.end.add(sphere(0.04, skin, 0, -0.02, 0)); return a; });
  const torch = joint(arms[1].end, 0, -0.06, 0.04); torch.rotation.x = -Math.PI / 2;
  torch.add(mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.16, 8), C(0x202020), 0, 0.06, 0));
  const lens = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.01, 8), new THREE.MeshBasicMaterial({ color: 0x555555 }), 0, 0.145, 0); lens.userData.keep = true; torch.add(lens);
  const beam = mesh(new THREE.ConeGeometry(0.9, 4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), 0, 2.15, 0);
  beam.rotation.x = Math.PI; beam.visible = false; beam.userData.keep = true; torch.add(beam);
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.font = '600 34px Osw, Arial'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 8, 256, 48);
  g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(0, 8, 6, 48); g.fillStyle = '#ece2d0'; g.fillText(name.slice(0, 14), 128, 44);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  tag.scale.set(0.9, 0.22, 1); tag.position.y = 1.95; tag.renderOrder = 5; root.add(tag);
  // значок «лежит, нужна помощь»
  const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hg = hc.getContext('2d');
  hg.fillStyle = '#c02020'; hg.beginPath(); hg.arc(32, 32, 28, 0, 7); hg.fill(); hg.fillStyle = '#fff'; hg.fillRect(26, 12, 12, 40); hg.fillRect(12, 26, 40, 12);
  const help = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hc), depthTest: false, transparent: true }));
  help.scale.set(0.35, 0.35, 1); help.position.y = 0.9; help.renderOrder = 6; help.visible = false; root.add(help);
  const hand2 = joint(arms[0].end, 0, -0.05, 0.05);
  root.userData = { kind: 'kid', hips, spine, neck, head, legs, arms, beam, lens, hand: hand2, tag, help };
  return bakeRig(root);
}

// ---------- предметы ----------
export const ITEMS = {
  rustykey: { name: 'Ржавый ключ' }, screwdriver: { name: 'Отвёртка' },
  gatekey: { name: 'Ключ от ворот' }, cutters: { name: 'Кусачки' },
  oar: { name: 'Весло' }, boatkey: { name: 'Ключ от лодки' },
  lever: { name: 'Рычаг' }, battery: { name: 'Аккумулятор' },
  kiteframe: { name: 'Каркас змея' }, kitecloth: { name: 'Полотно змея' },
  gear: { name: 'Шестерёнка' }, smallkey: { name: 'Маленький ключик' },
  hook: { name: 'Багор' }, shedkey: { name: 'Ключ от сарая' },
  fuel: { name: 'Канистра' }, oil: { name: 'Маслёнка' }, spool: { name: 'Катушка ниток' },
  bandage: { name: 'Бинт' },
  carkey: { name: 'Ключи от машины деда' }, shahed: { name: 'Шахед' },
  crowbar: { name: 'Гвоздодёр' }, remote: { name: 'Пульт от лазеров' }, shovel: { name: 'Лопата' }, banyakey: { name: 'Ключ от люка в баньке' },
  slingshot: { name: 'Рогатка', weapon: true }, flaregun: { name: 'Ракетница', weapon: true },
  stones: { name: 'Камни (+4)', ammo: true },
};
export const PROPS = {
  can: { name: 'Банка', breaks: false }, vase: { name: 'Ваза', breaks: true }, plate: { name: 'Тарелка', breaks: true },
  pot: { name: 'Кастрюля', breaks: false }, bottle: { name: 'Бутылка', breaks: true }, stone: { name: 'Камень', breaks: false },
};
function ground(g) {
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g);
  if (isFinite(b.min.y)) for (const c of g.children) c.position.y -= b.min.y;
  return g;
}
const ITEM_MATS = {};
export function makeItemMesh(id, glow) {
  const g = new THREE.Group();
  const em = glow ? 0x2a2410 : 0x000000;
  const M = (c) => ITEM_MATS[c + ':' + em] || (ITEM_MATS[c + ':' + em] = Lm({ color: c, emissive: em }));
  const cy = (rt, rb, h, m, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  const add = (m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const key = (c, s, bow) => {
    const m = M(c);
    add(new THREE.Mesh(new THREE.TorusGeometry(0.045 * s, 0.012 * s, 6, 14), m), -0.06 * s, 0.012 * s, 0, Math.PI / 2);
    add(cy(0.01 * s, 0.01 * s, 0.17 * s, m, 6), 0.05 * s, 0.012 * s, 0, 0, 0, Math.PI / 2);
    add(box(0.012 * s, 0.012 * s, 0.045 * s, m), 0.11 * s, 0.012 * s, 0.02 * s);
    add(box(0.012 * s, 0.012 * s, 0.03 * s, m), 0.08 * s, 0.012 * s, 0.015 * s);
    if (bow) add(box(0.07, 0.04, 0.04, M(bow)), -0.13 * s, 0.02, 0);
  };
  switch (id) {
    case 'rustykey': key(0x7a3a14, 1); break;
    case 'gatekey': key(0xb89a40, 1.6); break;
    case 'boatkey': key(0x9aa0a8, 1, 0x1a5ac0); break;
    case 'smallkey': key(0xd0b050, 0.6, 0x9a1a2a); break;
    case 'shedkey': key(0x5a6a5a, 1.2, 0x2a6a2a); break;
    case 'banyakey': key(0xa07040, 1.3, 0x6a3a1a); break;
    case 'crowbar': { const m = M(0x9a1a14); add(cy(0.016, 0.016, 0.62, m, 6), 0, 0.02, 0, 0, 0, Math.PI / 2); add(cy(0.016, 0.012, 0.12, m, 6), 0.35, 0.05, 0, 0, 0, -0.6); add(box(0.06, 0.012, 0.03, m), -0.33, 0.02, 0.02, 0, 0.5); break; }
    case 'remote': add(box(0.08, 0.03, 0.17, M(0x1a1a1e)), 0, 0.015, 0); add(cy(0.012, 0.012, 0.012, Lm({ color: 0xff2020, emissive: 0xc00000 }), 8), 0, 0.034, -0.05); for (let i = 0; i < 4; i++) add(box(0.014, 0.008, 0.014, M(0x6a6a70)), (i % 2) * 0.03 - 0.015, 0.032, 0.0 + (i >> 1) * 0.03); add(cy(0.004, 0.004, 0.08, M(0x2a2a2a), 4), 0.03, 0.05, -0.09, 0.6); break;
    case 'shovel': { add(cy(0.018, 0.018, 1.0, M(0x7a5a30), 6), 0, 0.03, 0, 0, 0, Math.PI / 2); add(box(0.22, 0.02, 0.2, M(0x6a6a6a)), 0.6, 0.03, 0); add(box(0.04, 0.04, 0.14, M(0x2a2a2a)), -0.5, 0.03, 0); break; }
    case 'screwdriver': add(cy(0.028, 0.024, 0.13, M(0xd0a020)), 0, 0.028, 0, 0, 0, Math.PI / 2); add(cy(0.007, 0.007, 0.16, M(0xb0b0b0), 6), 0.14, 0.028, 0, 0, 0, Math.PI / 2); add(box(0.01, 0.004, 0.02, M(0xb0b0b0)), 0.225, 0.028, 0); break;
    case 'cutters': for (const s of [-1, 1]) { add(box(0.28, 0.028, 0.03, M(0xb02020)), -0.06, 0.02, 0.035 * s, 0, 0.12 * s); add(box(0.12, 0.03, 0.035, M(0x6a6a6a)), 0.14, 0.02, 0.012 * s, 0, -0.1 * s); } add(cy(0.02, 0.02, 0.05, M(0x444444), 8), 0.08, 0.02, 0, Math.PI / 2); break;
    case 'oar': add(cy(0.022, 0.022, 1.2, M(0x7a5a30)), 0, 0.03, 0, 0, 0, Math.PI / 2); add(box(0.36, 0.025, 0.17, M(0x7a5a30)), 0.75, 0.03, 0); add(box(0.12, 0.05, 0.05, M(0x2a2a2a)), -0.55, 0.03, 0); break;
    case 'hook': add(cy(0.02, 0.02, 1.3, M(0x6a4a2a)), 0, 0.03, 0, 0, 0, Math.PI / 2); add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 10, Math.PI * 1.3), M(0x5a5a5a)), 0.7, 0.03, 0.04, Math.PI / 2); add(cy(0.012, 0.005, 0.12, M(0x5a5a5a), 6), 0.68, 0.03, -0.02, 0, 0, Math.PI / 2); break;
    case 'lever': add(cy(0.022, 0.022, 0.6, M(0x606468)), 0, 0.05, 0, 0, 0, Math.PI / 2); add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M(0xc02020)), 0.32, 0.05, 0); add(box(0.08, 0.08, 0.08, M(0x404448)), -0.3, 0.05, 0); break;
    case 'battery': add(box(0.3, 0.2, 0.18, M(0x1a1a1a)), 0, 0.1, 0); add(box(0.31, 0.04, 0.19, M(0x3a3a3a)), 0, 0.18, 0); add(cy(0.025, 0.025, 0.04, M(0xc02020)), -0.08, 0.22, 0); add(cy(0.025, 0.025, 0.04, M(0x2040c0)), 0.08, 0.22, 0); add(box(0.2, 0.05, 0.002, M(0xd0c040)), 0, 0.1, 0.091); break;
    case 'fuel': add(box(0.22, 0.3, 0.12, M(0x9a1a10)), 0, 0.15, 0); add(cy(0.025, 0.025, 0.06, M(0x2a2a2a)), 0.07, 0.32, 0); add(box(0.12, 0.03, 0.03, M(0x2a2a2a)), -0.03, 0.31, 0); break;
    case 'oil': add(cy(0.06, 0.07, 0.1, M(0x3a5a3a), 12), 0, 0.05, 0); add(cy(0.008, 0.02, 0.16, M(0x3a3a3a), 6), 0.05, 0.14, 0, 0, 0, -0.8); break;
    case 'carkey': add(cy(0.03, 0.03, 0.012, M(0x2a2a2a), 10), 0, 0.006, 0); add(box(0.016, 0.01, 0.07, M(0xb0b0a0)), 0, 0.012, 0.05); add(box(0.04, 0.012, 0.03, M(0x8a1a1a)), 0.05, 0.008, -0.02); break;
    case 'shahed': { const d = makeDrone(); d.scale.setScalar(0.3); d.position.y = 0.08; g.add(d); break; }
    case 'spool': add(cy(0.04, 0.04, 0.1, M(0xd8d0b8), 12), 0, 0.05, 0); add(cy(0.06, 0.06, 0.012, M(0x6a4a2a), 12), 0, 0.006, 0); add(cy(0.06, 0.06, 0.012, M(0x6a4a2a), 12), 0, 0.104, 0); break;
    case 'bandage': add(cy(0.05, 0.05, 0.08, M(0xe8e4dc), 12), 0, 0.04, 0, 0, 0, 0); add(box(0.06, 0.004, 0.08, M(0xe8e4dc)), 0.07, 0.002, 0); add(box(0.03, 0.03, 0.006, M(0xc02020)), 0, 0.04, 0.051); add(box(0.006, 0.03, 0.03, M(0xc02020)), 0, 0.04, 0.051); break;
    case 'kiteframe': add(box(0.9, 0.022, 0.022, M(0x9a7a50)), 0, 0.012, 0); add(box(0.022, 0.022, 0.6, M(0x9a7a50)), 0.1, 0.012, 0); add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 8), M(0xd0c8b0)), -0.45, 0.012, 0, Math.PI / 2); break;
    case 'kitecloth': add(box(0.36, 0.06, 0.26, M(0xc03030)), 0, 0.03, 0); add(box(0.36, 0.03, 0.12, M(0xd8b030)), 0, 0.075, 0.02); add(box(0.04, 0.09, 0.27, M(0x2a2a2a)), 0.12, 0.045, 0); break;
    case 'gear': { const m = M(0x8a7a50); add(cy(0.09, 0.09, 0.03, m, 16), 0, 0.015, 0); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(box(0.035, 0.03, 0.035, m), Math.cos(a) * 0.1, 0.015, Math.sin(a) * 0.1, 0, -a); } add(cy(0.025, 0.025, 0.035, M(0x2a2a2a), 8), 0, 0.017, 0); break; }
    case 'slingshot': { const wd = M(0x6a4422); add(cy(0.018, 0.02, 0.16, wd, 6), 0, 0.08, 0); for (const s of [-1, 1]) add(cy(0.014, 0.016, 0.12, wd, 6), 0.035 * s, 0.2, 0, 0, 0, -0.35 * s); add(box(0.1, 0.006, 0.006, M(0x8a2a1a)), 0, 0.25, 0.0); add(box(0.025, 0.02, 0.012, M(0x3a2a1a)), 0, 0.25, 0.01); break; }
    case 'flaregun': { const o = M(0xd05010); add(box(0.24, 0.07, 0.06, o), 0.06, 0.13, 0); add(cy(0.03, 0.03, 0.2, o, 10), 0.12, 0.13, 0, 0, 0, Math.PI / 2); add(box(0.06, 0.13, 0.05, M(0x2a2a2a)), -0.04, 0.065, 0, 0, 0, 0.25); add(box(0.02, 0.04, 0.02, M(0x2a2a2a)), 0.02, 0.07, 0); break; }
    case 'stones': for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.035 + i * 0.004, 0), M(0x6a6660)), (i % 2) * 0.07 - 0.03, 0.03, (i >> 1) * 0.07 - 0.03); break;
    case 'stone': add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.035, 0), M(0x6a6660)), 0, 0.03, 0); break;
    case 'flare': add(cy(0.02, 0.02, 0.12, Lm({ color: 0xff6020, emissive: 0xff3000 }), 8), 0, 0.02, 0, 0, 0, Math.PI / 2); break;
    case 'can': add(cy(0.055, 0.055, 0.14, M(0x7a7a70), 14), 0, 0.07, 0); add(cy(0.056, 0.056, 0.06, M(0x8a2a1a), 14), 0, 0.07, 0); break;
    case 'vase': { const v = lathe([[0, 0], [0.06, 0], [0.1, 0.08], [0.09, 0.18], [0.04, 0.26], [0.055, 0.32], [0.05, 0.33]], Lm({ color: 0x2a4a7a, emissive: em, side: THREE.DoubleSide }), 16); g.add(v); break; }
    case 'plate': { const p = lathe([[0, 0.0], [0.08, 0.0], [0.13, 0.025], [0.12, 0.028]], Lm({ color: 0xd8d0c0, emissive: em, side: THREE.DoubleSide }), 18); g.add(p); break; }
    case 'pot': add(cy(0.13, 0.12, 0.16, M(0x4a4a4e), 16), 0, 0.08, 0); add(box(0.4, 0.02, 0.03, M(0x2a2a2a)), 0, 0.14, 0); add(cy(0.135, 0.135, 0.015, M(0x3a3a3e), 16), 0, 0.165, 0); break;
    case 'bottle': { const b = lathe([[0, 0], [0.045, 0], [0.045, 0.16], [0.02, 0.21], [0.016, 0.28], [0.019, 0.29], [0, 0.29]], Lm({ color: 0x1f4a20, emissive: em, transparent: true, opacity: 0.9 }), 12); g.add(b); break; }
  }
  return bakeRig(ground(g));
}

// ---------- транспорт и ворота ----------
export function makeBoat(T) {
  const wood = Lm({ map: T.wood, color: 0xa08060, side: THREE.DoubleSide }), dark = C(0x22160c);
  const g = new THREE.Group();
  const hull = lathe([[0, -0.25], [0.45, -0.2], [0.55, 0.1], [0.58, 0.3]], wood, 16); hull.scale.set(1, 1, 2.4); g.add(hull);
  g.add(box(1.0, 0.05, 0.3, dark, 0, 0.18, 0.3)); g.add(box(1.0, 0.05, 0.3, dark, 0, 0.18, -0.5));
  g.add(box(0.25, 0.4, 0.3, Lm({ map: T.metal }), 0, 0.4, 1.35));
  const lock = box(0.12, 0.12, 0.06, C(0x9aa0a8), 0, 0.45, 1.15); g.add(lock);
  const oar = makeItemMesh('oar'); oar.position.set(0.25, 0.25, -0.1); oar.rotation.y = Math.PI / 2; oar.visible = false; g.add(oar);
  const fuel = makeItemMesh('fuel'); fuel.position.set(-0.3, 0.2, 0.9); fuel.visible = false; g.add(fuel);
  const chain = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), C(0x606060), 0.9, 0.2, 0); chain.rotation.z = Math.PI / 2; g.add(chain);
  g.userData = { oar, lock, chain, fuel };
  return g;
}
export function makeDraisine(T) {
  const metal = Lm({ map: T.metal }), wood = Lm({ map: T.wood, color: 0xa07a50 });
  const g = new THREE.Group();
  g.add(box(1.5, 0.12, 1.8, wood, 0, 0.45, 0));
  for (const [x, z] of [[-0.5, -0.6], [0.5, -0.6], [-0.5, 0.6], [0.5, 0.6]]) { const w = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.07, 14), metal, x, 0.22, z); w.rotation.z = Math.PI / 2; g.add(w); }
  g.add(box(0.15, 0.7, 0.15, metal, 0, 0.85, 0));
  const lever = joint(g, 0, 1.2, 0); lever.add(box(1.3, 0.05, 0.05, C(0x8a2020))); lever.add(box(0.1, 0.1, 0.1, metal)); lever.visible = false;
  const batt = makeItemMesh('battery'); batt.position.set(0.45, 0.51, 0.5); batt.visible = false; g.add(batt);
  const oil = makeItemMesh('oil'); oil.position.set(-0.5, 0.51, -0.6); oil.visible = false; g.add(oil);
  g.add(box(0.5, 0.3, 0.4, metal, -0.4, 0.66, 0.5));
  g.userData = { lever, batt, oil };
  return g;
}
export function makeGate() {
  const iron = C(0x26282a), rust = C(0x5a3a20);
  const g = new THREE.Group();
  const leaf = joint(g, -1, 0, 0);
  for (let i = 0; i <= 8; i++) { leaf.add(box(0.04, 2.2, 0.04, iron, i * 0.25, 1.1, 0)); leaf.add(mesh(new THREE.ConeGeometry(0.04, 0.12, 4), iron, i * 0.25, 2.25, 0)); }
  leaf.add(box(2.0, 0.07, 0.05, iron, 1, 2.05, 0)); leaf.add(box(2.0, 0.07, 0.05, iron, 1, 0.3, 0)); leaf.add(box(2.0, 0.07, 0.05, iron, 1, 1.2, 0));
  const chain = joint(g, 0.95, 1.2, 0.08);
  for (let i = 0; i < 6; i++) { const l = mesh(new THREE.TorusGeometry(0.045, 0.013, 5, 8), rust, 0, -0.075 * i + 0.18, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; chain.add(l); }
  const padlock = joint(g, 0.95, 0.82, 0.1); padlock.add(box(0.14, 0.13, 0.07, C(0x9a8030, 0x201500))); padlock.add(mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 10, Math.PI), C(0x8a8a8a), 0, 0.065, 0));
  // доски крест-накрест
  const boards = joint(g, 0, 0, 0);
  const plank = C(0x6a4a2a);
  for (const [y, a] of [[0.8, 0.35], [0.8, -0.35], [1.6, 0.25]]) { const b = box(2.3, 0.14, 0.04, plank, 0, y, 0.09); b.rotation.z = a; boards.add(b); }
  // лазерная сигнализация: столбики по краям и красные лучи
  const lasers = joint(g, 0, 0, 1.2);
  for (const sx of [-1.15, 1.15]) { lasers.add(box(0.1, 1.6, 0.1, C(0x2a2a2e), sx, 0.8, 0)); lasers.add(box(0.06, 0.06, 0.06, C(0xff2020, 0xc00000), sx * 0.95, 1.5, 0)); }
  const beamM = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.75 });
  for (const y of [0.3, 0.65, 1.0, 1.35]) lasers.add(mesh(new THREE.BoxGeometry(2.2, 0.012, 0.012), beamM, 0, y, 0));
  // привод ворот: ящик с местом под рычаг и аккумулятор
  const motor = joint(g, 1.45, 0, 0.3);
  motor.add(box(0.5, 0.6, 0.35, C(0x3a4a3a), 0, 0.3, 0)); motor.add(box(0.06, 1.2, 0.06, C(0x2a2a2a), -0.2, 0.6, -0.1));
  const leverIn = joint(motor, 0.27, 0.45, 0); leverIn.add(box(0.05, 0.5, 0.05, C(0x8a2020))); leverIn.children[0].position.y = 0.22; leverIn.rotation.z = -0.4; leverIn.visible = false;
  const battIn = joint(motor, 0, 0.66, 0); battIn.add(box(0.3, 0.2, 0.18, C(0x1a1a1a))); battIn.visible = false;
  g.userData = { leaf, chain, padlock, boards, lasers, motor, leverIn, battIn };
  return g;
}
export function makeKiteStand(T) {
  const g = new THREE.Group();
  const wood = Lm({ map: T.wood, color: 0xa08060 });
  g.add(box(0.08, 1.0, 0.08, wood, 0, 0.5, 0)); g.add(box(0.6, 0.06, 0.06, wood, 0, 1.0, 0));
  const frame = makeItemMesh('kiteframe'); frame.position.set(0, 1.4, 0); frame.rotation.x = Math.PI / 2 - 0.3; frame.visible = false; g.add(frame);
  const sail = new THREE.Mesh(new THREE.BufferGeometry(), Lm({ color: 0xc03030, side: THREE.DoubleSide }));
  const v = new Float32Array([0, 0.3, 0, -0.45, 0, 0, 0, -0.6, 0, 0, 0.3, 0, 0, -0.6, 0, 0.45, 0, 0]);
  sail.geometry.setAttribute('position', new THREE.BufferAttribute(v, 3)); sail.geometry.computeVertexNormals();
  sail.position.set(0, 1.4, 0); sail.rotation.x = -0.3; sail.visible = false; g.add(sail);
  const spool = makeItemMesh('spool'); spool.position.set(0.25, 1.03, 0); spool.visible = false; g.add(spool);
  g.userData = { frame, sail, spool };
  return g;
}

// Склейка деталей внутри каждого сустава: тот же вид, но в разы меньше вызовов отрисовки
export function bakeRig(root) {
  const nodes = []; root.traverse(o => nodes.push(o));
  for (const n of nodes) {
    const groups = new Map();
    for (const c of n.children) if (c.isMesh && c.children.length === 0 && !c.userData.keep && !Array.isArray(c.material)) { const k = c.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = list.map(c => {
        c.updateMatrix();
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.applyMatrix4(c.matrix); return g;
      });
      const merged = mergeGeometries(geos); if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, list[0].material); n.add(m); list.forEach(c => n.remove(c));
    }
  }
  return root;
}

// ================= ДВОРНИК =================
function yardFace() {
  return faceTex((g) => {
    skinBase(g, '#b08a70', 701);
    for (let i = 0; i < 3; i++) wrinkle(g, FX - 30, ry(0.28 * Math.PI) + i * 7, FX + 30, ry(0.28 * Math.PI) + i * 7, -2, 0.35);
    for (const s of [-1, 1]) {
      const ex = FX + s * 24, ey = ry(0.47 * Math.PI);
      stain(g, ex, ey + 6, 14, 'rgba(60,30,30,1)', 0.45);
      g.fillStyle = '#ddd6bc'; g.beginPath(); g.ellipse(ex, ey, 11, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(ex + s * -1, ey, 4.5, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(ex + s * -1, ey, 2.2, 0, 7); g.fill();
      g.strokeStyle = '#1a0e08'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(ex, ey, 11, 6, 0, Math.PI, 0); g.stroke();
      // сросшиеся тёмные брови, сдвинутые к переносице
      g.fillStyle = '#20140c'; g.save(); g.translate(ex, ey - 11); g.rotate(s * 0.25); g.fillRect(-14, -3, 28, 6); g.restore();
    }
    // шрам через щёку
    g.strokeStyle = 'rgba(120,40,40,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(FX + 30, ry(0.42 * Math.PI)); g.lineTo(FX + 40, ry(0.62 * Math.PI)); g.stroke();
    for (let k = 0; k < 4; k++) { g.lineWidth = 1; g.beginPath(); g.moveTo(FX + 31 + k * 2.4, ry((0.45 + k * 0.04) * Math.PI) - 3); g.lineTo(FX + 37 + k * 2.4, ry((0.45 + k * 0.04) * Math.PI) - 1); g.stroke(); }
    wrinkle(g, FX - 11, ry(0.56 * Math.PI), FX - 19, ry(0.68 * Math.PI), -5, 0.5, 2); wrinkle(g, FX + 11, ry(0.56 * Math.PI), FX + 19, ry(0.68 * Math.PI), 5, 0.5, 2);
    // тёмная щетина
    for (let i = 0; i < 500; i++) { const a = Math.random() * 1.3 - 0.65, r = 0.6 + Math.random() * 0.24; g.fillStyle = 'rgba(30,20,15,0.55)'; g.fillRect(FX + a * 62, ry(r * Math.PI), 1, 1.6); }
  }, 701);
}
export function makeYardman(T) {
  const skin = Lm({ color: 0xb08a70 }), face = Lm({ map: yardFace() });
  const coat = Lm({ map: T.fabric('#3a4232', 91), side: THREE.DoubleSide }), coatD = C(0x262c20);
  const pants = Lm({ map: T.fabric('#2a2a2c', 92) }), boot = Lm({ map: T.knit('#3a3632', 93) });
  const fur = Lm({ map: T.knit('#5a4634', 94) }), apron = Lm({ map: T.fabric('#9a4a14', 95), side: THREE.DoubleSide });
  const wood = Lm({ map: T.wood, color: 0x8a6a4a }), twig = C(0x6a5434), dark = C(0x100a06);
  const root = new THREE.Group();
  const hips = joint(root, 0, 1.08, 0);
  const legs = [-1, 1].map(s => { const l = limb(hips, 0.11 * s, 0, 0, 0.5, 0.075, 0.5, 0.062, pants); l.b.add(capsule(0.075, 0.3, boot, 12)); l.b.children[l.b.children.length - 1].position.y = -0.36; l.end.add(sphere(0.085, boot, 0, -0.02, 0.06, 0.85, 0.6, 1.6)); return l; });
  const spine = joint(hips, 0, 0, 0); spine.rotation.x = 0.12;
  // стёганый ватник
  const body = lathe([[0.2, -0.05], [0.23, 0.15], [0.24, 0.42], [0.26, 0.58], [0.16, 0.68], [0.07, 0.7]], coat, 24, 0.05, 12); spine.add(body);
  for (let i = 0; i < 5; i++) spine.add(new THREE.Mesh(new THREE.TorusGeometry(0.235 + (i === 4 ? 0.01 : 0), 0.006, 4, 24), coatD).translateY(0.02 + i * 0.13).rotateX(Math.PI / 2));
  hips.add(lathe([[0.21, 0.02], [0.25, -0.22], [0.26, -0.3]], coat, 22, 0.06, 8));
  // оранжевый жилет поверх
  spine.add(lathe([[0.245, 0.05], [0.25, 0.3], [0.255, 0.5], [0.0, 0.5]], apron, 20).translateY(0.0));
  spine.add(box(0.44, 0.035, 0.02, C(0xb8b8a8, 0x101008), 0, 0.28, 0.238));
  const neck = joint(spine, 0, 0.68, 0); neck.add(capsule(0.06, 0.07, skin)); neck.children[0].position.y = 0.05;
  const head = joint(neck, 0, 0.1, 0.01);
  const hm = headMesh(0.12, face, 0.98, 1.15, 1.02); hm.position.y = 0.1; head.add(hm);
  const nose = cone(0.024, 0.07, skin, 8); nose.rotation.x = Math.PI / 2 + 0.3; nose.position.set(0, 0.095, 0.125); head.add(nose);
  for (const s of [-1, 1]) head.add(sphere(0.028, skin, 0.115 * s, 0.1, 0, 0.4, 1.2, 0.7));
  const jaw = mouth(head, skin, 0.03, 0.105, 0.07, 0x8a7a50);
  for (const s of [-1, 1]) { const mu = capsule(0.016, 0.07, dark, 6); mu.rotation.z = s * 1.75; mu.position.set(s * 0.035, 0.05, 0.115); head.add(mu); }
  // ушанка
  head.add(mesh(new THREE.SphereGeometry(0.135, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), fur, 0, 0.14, 0));
  head.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 18), fur, 0, 0.16, 0));
  for (const s of [-1, 1]) { const flap = box(0.03, 0.14, 0.1, fur, 0.14 * s, 0.07, 0); flap.rotation.z = s * 0.15; head.add(flap); }
  { const fr = box(0.22, 0.07, 0.04, fur, 0, 0.24, 0.12); fr.rotation.x = -0.4; head.add(fr); }
  const arms = [-1, 1].map(s => { const a = limb(spine, 0.28 * s, 0.6, 0, 0.36, 0.07, 0.33, 0.058, coat, coat); a.fingers = hand(a.end, Lm({ map: T.knit('#4a4a3a', 96) }), 0.1); return a; });
  // метла
  const broom = joint(arms[1].end, 0, -0.06, 0.02);
  broom.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 1.55, 6), wood, 0, -0.25, 0));
  const head2 = joint(broom, 0, -1.02, 0);
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = 0.03 + (i % 3) * 0.02; const t = mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.45, 3), twig, Math.cos(a) * r, -0.18, Math.sin(a) * r); t.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); head2.add(t); }
  head2.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 10), dark, 0, 0.02, 0).rotateX(Math.PI / 2));
  broom.rotation.x = -0.3;
  // мешок на плече (видно, когда несёт)
  const sack = makeSack(); sack.scale.setScalar(0.85); sack.position.set(0.12, 0.62, -0.25); sack.rotation.set(1.2, 0, 0.3); sack.visible = false; spine.add(sack);
  root.userData = { kind: 'yardman', hips, spine, neck, head, jaw, legs, arms, broom, sack, eyeH: 1.95, scareDist: 0.62 };
  return bakeRig(root);
}

// ---------- мешок ----------
let SACK_MAT = null;
export function makeSack() {
  if (!SACK_MAT) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#9a8258'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 3) { g.fillStyle = 'rgba(60,40,20,0.25)'; g.fillRect(0, y, 128, 1); }
    for (let x = 0; x < 128; x += 3) { g.fillStyle = 'rgba(255,240,200,0.12)'; g.fillRect(x, 0, 1, 128); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(50,30,10,0.18)'; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 16, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    SACK_MAT = { m: Lm({ map: t }), rope: C(0x6a5434) };
  }
  const g = new THREE.Group();
  const body = lathe([[0.0, 0.0], [0.26, 0.03], [0.33, 0.25], [0.31, 0.55], [0.2, 0.78], [0.08, 0.86], [0.1, 0.95], [0.0, 0.97]], SACK_MAT.m, 18, 0.06, 6);
  g.add(body);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 4, 12), SACK_MAT.rope).translateY(0.85).rotateX(Math.PI / 2));
  g.userData.body = body;
  return g;
}

// ---------- летающий дрон (свой дизайн) ----------
export function makeDrone(T) {
  const g = new THREE.Group();
  const hull = Lm({ color: 0x5a5e58 }), hullD = C(0x30322e), nose = C(0x2a2c28), prop = C(0x1a1a1a);
  // треугольное крыло
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 1.1); wingShape.lineTo(1.25, -0.6); wingShape.lineTo(0.95, -0.72); wingShape.lineTo(0, -0.35); wingShape.lineTo(-0.95, -0.72); wingShape.lineTo(-1.25, -0.6); wingShape.lineTo(0, 1.1);
  const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }), hull);
  wing.rotation.x = -Math.PI / 2; wing.position.y = -0.03; g.add(wing);
  // фюзеляж
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.6, 12), hullD); body.rotation.x = Math.PI / 2; body.position.set(0, 0.06, 0.15); g.add(body);
  const n = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), nose); n.rotation.x = Math.PI / 2; n.position.set(0, 0.06, 0.95); g.add(n);
  // кили на концах крыла
  for (const s of [-1, 1]) { const fin = box(0.03, 0.3, 0.32, hull, 1.1 * s, 0.12, -0.58); g.add(fin); }
  // винт сзади
  const hubP = new THREE.Group(); hubP.position.set(0, 0.06, -0.68); g.add(hubP);
  hubP.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), nose).rotateX(-Math.PI / 2));
  const rotor = new THREE.Group(); hubP.add(rotor);
  for (let i = 0; i < 2; i++) { const b = box(0.07, 0.62, 0.02, prop, 0, 0, 0); b.rotation.z = i * Math.PI; b.position.y = 0; rotor.add(b); }
  const blur = new THREE.Mesh(new THREE.CircleGeometry(0.33, 20), new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); blur.position.z = -0.01; hubP.add(blur);
  // мигающий огонёк
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); led.position.set(0, 0.2, 0.1); g.add(led);
  g.scale.setScalar(0.6);
  g.userData = { rotor, led };
  return g;
}

// ================= ТРУ АДАМ (свой персонаж: «идеальная» внешность, квадратная челюсть) =================
function adamFace() {
  return faceTex((g) => {
    skinBase(g, '#c99a76', 801);
    // скулы и тени под ними — «модельное» лицо
    for (const s of [-1, 1]) { stain(g, FX + s * 34, ry(0.6 * Math.PI), 20, 'rgba(90,50,30,1)', 0.35); stain(g, FX + s * 30, ry(0.52 * Math.PI), 10, 'rgba(255,230,200,1)', 0.25); }
    for (const s of [-1, 1]) {
      const ex = FX + s * 23, ey = ry(0.465 * Math.PI);
      // прищуренные «охотничьи» глаза
      g.fillStyle = '#efe6d6'; g.beginPath(); g.moveTo(ex - 12, ey + 1); g.quadraticCurveTo(ex, ey - 6, ex + 12, ey - 1); g.quadraticCurveTo(ex, ey + 4, ex - 12, ey + 1); g.fill();
      g.fillStyle = '#3a6a8a'; g.beginPath(); g.arc(ex, ey, 4, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(ex, ey, 1.8, 0, 7); g.fill();
      g.strokeStyle = '#1a0e08'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(ex - 13, ey + 0.5); g.quadraticCurveTo(ex, ey - 7.5, ex + 13, ey - 1.5); g.stroke();
      // густые прямые брови, низко
      g.fillStyle = '#2a1608'; g.save(); g.translate(ex, ey - 9); g.rotate(-s * 0.06); g.fillRect(-14, -2.5, 28, 5); g.restore();
    }
    // ровный нос, губы
    g.strokeStyle = 'rgba(90,50,30,0.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(FX - 3, ry(0.5 * Math.PI)); g.lineTo(FX - 5, ry(0.575 * Math.PI)); g.lineTo(FX + 4, ry(0.58 * Math.PI)); g.stroke();
    g.fillStyle = 'rgba(150,70,60,0.8)'; g.beginPath(); g.ellipse(FX, ry(0.645 * Math.PI), 11, 2.6, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,20,10,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(FX - 11, ry(0.643 * Math.PI)); g.quadraticCurveTo(FX, ry(0.65 * Math.PI) + 1, FX + 11, ry(0.643 * Math.PI) - 2); g.stroke();
    // лёгкая щетина по линии челюсти
    for (let i = 0; i < 400; i++) { const a = Math.random() * 1.4 - 0.7, r = 0.66 + Math.random() * 0.16; g.fillStyle = 'rgba(40,25,15,0.35)'; g.fillRect(FX + a * 60, ry(r * Math.PI), 1, 1.3); }
  }, 801);
}
export function makeAdam(T) {
  const skin = Lm({ color: 0xc99a76 }), face = Lm({ map: adamFace() });
  const top = Lm({ map: T.fabric('#e8e4dc', 111) }), pants = Lm({ map: T.fabric('#1c1e26', 112) }), shoe = C(0xf0f0f0), hairM = C(0x2a1608), gold = C(0xd8b040, 0x302000);
  const root = new THREE.Group();
  const hips = joint(root, 0, 1.06, 0);
  const legs = [-1, 1].map(s => { const l = limb(hips, 0.12 * s, 0, 0, 0.5, 0.08, 0.5, 0.062, pants); l.end.add(box(0.12, 0.08, 0.28, shoe, 0, -0.03, 0.06)); return l; });
  const spine = joint(hips, 0, 0, 0);
  // атлетичный торс: широкие плечи, узкая талия
  spine.add(lathe([[0.17, -0.02], [0.19, 0.18], [0.26, 0.42], [0.3, 0.56], [0.2, 0.64], [0.07, 0.68]], top, 24));
  for (const s of [-1, 1]) spine.add(sphere(0.11, top, 0.1 * s, 0.48, 0.12, 1, 0.8, 0.6));   // грудь
  spine.add(sphere(0.06, gold, 0, 0.6, 0.15, 1, 0.3, 0.3));
  const neck = joint(spine, 0, 0.66, 0); neck.add(capsule(0.075, 0.07, skin)); neck.children[0].position.y = 0.05;
  const head = joint(neck, 0, 0.1, 0.01);
  const hm = headMesh(0.115, face, 1.0, 1.12, 1.0); hm.position.y = 0.11; head.add(hm);
  // та самая челюсть
  const jaw = joint(head, 0, 0.02, 0.02);
  jaw.add(box(0.2, 0.08, 0.15, skin, 0, -0.02, 0.03)); jaw.add(box(0.12, 0.05, 0.05, skin, 0, -0.045, 0.1));
  for (const s of [-1, 1]) { const j = box(0.05, 0.1, 0.16, skin, 0.1 * s, 0.01, 0.0); j.rotation.z = s * 0.15; jaw.add(j); }
  const nose = cone(0.02, 0.06, skin, 8); nose.rotation.x = Math.PI / 2 + 0.25; nose.position.set(0, 0.11, 0.115); head.add(nose);
  for (const s of [-1, 1]) head.add(sphere(0.026, skin, 0.112 * s, 0.11, 0, 0.4, 1.2, 0.7));
  // причёска «кок»
  head.add(mesh(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM, 0, 0.13, -0.01));
  { const q = sphere(0.08, hairM, 0, 0.27, 0.06, 1.3, 0.7, 1.1); q.rotation.x = -0.4; head.add(q); }
  const arms = [-1, 1].map(s => { const a = limb(spine, 0.32 * s, 0.56, 0, 0.32, 0.075, 0.3, 0.06, skin); a.fingers = hand(a.end, skin, 0.09); return a; });
  // золотистое сияние ауры
  const c = document.createElement('canvas'); c.width = c.height = 128; const g2 = c.getContext('2d');
  const gr = g2.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(255,220,120,0.55)'); gr.addColorStop(0.5, 'rgba(255,190,60,0.2)'); gr.addColorStop(1, 'rgba(255,170,40,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.scale.set(2.6, 3.2, 1); aura.position.y = 1.1; root.add(aura);
  root.userData = { kind: 'adam', hips, spine, neck, head, jaw, legs, arms, aura, eyeH: 1.95, scareDist: 0.55 };
  return bakeRig(root);
}

// ================= КОЧ БРАТАН: хозяин подземной бани =================
// здоровяк-банщик: распаренная красная кожа, войлочная банная шапка, полотенце на поясе, берёзовый веник
function kochFace() {
  return faceTex((g) => {
    skinBase(g, '#d88a74', 811);
    for (const s of [-1, 1]) stain(g, FX + s * 34, ry(0.58 * Math.PI), 24, 'rgba(220,60,50,1)', 0.45);   // распаренные щёки
    for (const s of [-1, 1]) {
      const ex = FX + s * 22, ey = ry(0.47 * Math.PI);
      g.fillStyle = '#f2e6d8'; g.beginPath(); g.ellipse(ex, ey, 10, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#4a3020'; g.beginPath(); g.arc(ex + s * -1, ey, 4, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(ex + s * -1, ey, 2, 0, 7); g.fill();
      g.fillStyle = '#3a2214'; g.save(); g.translate(ex, ey - 9); g.rotate(s * 0.22); g.fillRect(-13, -3, 26, 6); g.restore();   // нахмуренные брови
    }
    g.fillStyle = 'rgba(150,60,50,0.6)'; g.beginPath(); g.ellipse(FX, ry(0.56 * Math.PI), 8, 6, 0, 0, 7); g.fill();   // нос картошкой
    // широкая ухмылка
    g.fillStyle = '#5a1a14'; g.beginPath(); g.moveTo(FX - 18, ry(0.64 * Math.PI)); g.quadraticCurveTo(FX, ry(0.68 * Math.PI) + 6, FX + 18, ry(0.64 * Math.PI)); g.quadraticCurveTo(FX, ry(0.655 * Math.PI), FX - 18, ry(0.64 * Math.PI)); g.fill();
    g.fillStyle = '#f0ece0'; g.fillRect(FX - 12, ry(0.645 * Math.PI) - 1, 24, 3);
    // борода
    for (let i = 0; i < 900; i++) { const a = Math.random() * 1.6 - 0.8, r = 0.67 + Math.random() * 0.2; g.fillStyle = 'rgba(70,40,20,0.55)'; g.fillRect(FX + a * 62, ry(r * Math.PI), 1.4, 2); }
  }, 811);
}
export function makeKoch(T) {
  const skin = Lm({ color: 0xd8826c }), face = Lm({ map: kochFace() });
  const towel = Lm({ map: T.fabric('#f0ece0', 131) }), stripe = C(0x2a5aa0), felt = Lm({ map: T.fabric('#c8b490', 132) }), flip = C(0x2a2a2a);
  const birch = C(0x7a5a30), leafM = Lm({ color: 0x4a7a2a, side: THREE.DoubleSide });
  const root = new THREE.Group();
  const hips = joint(root, 0, 1.0, 0);
  // полотенце на поясе
  hips.add(lathe([[0.27, -0.42], [0.29, -0.2], [0.27, 0.02], [0.25, 0.06]], towel, 20));
  hips.add(mesh(new THREE.TorusGeometry(0.26, 0.012, 4, 20), stripe, 0, -0.38, 0, Math.PI / 2));
  const legs = [-1, 1].map(s => { const l = limb(hips, 0.13 * s, -0.1, 0, 0.42, 0.09, 0.44, 0.07, skin); l.end.add(box(0.12, 0.03, 0.28, flip, 0, -0.06, 0.06)); return l; });
  const spine = joint(hips, 0, 0, 0);
  // мощный торс с животом
  spine.add(lathe([[0.26, 0.0], [0.31, 0.14], [0.33, 0.3], [0.36, 0.5], [0.3, 0.62], [0.09, 0.68]], skin, 24));
  for (const s of [-1, 1]) spine.add(sphere(0.13, skin, 0.13 * s, 0.48, 0.14, 1, 0.7, 0.6));   // грудь
  spine.add(sphere(0.2, skin, 0, 0.2, 0.12, 1.1, 1, 0.8));   // живот
  const neck = joint(spine, 0, 0.66, 0); neck.add(capsule(0.1, 0.06, skin)); neck.children[0].position.y = 0.04;
  const head = joint(neck, 0, 0.09, 0.01);
  const hm = headMesh(0.125, face, 1.05, 1.05, 1.0); hm.position.y = 0.11; head.add(hm);
  const jaw = joint(head, 0, 0.02, 0.03); jaw.add(box(0.18, 0.07, 0.12, Lm({ color: 0x5a3a20 }), 0, -0.03, 0.04));   // борода-подбородок
  for (const s of [-1, 1]) head.add(sphere(0.03, skin, 0.125 * s, 0.11, 0, 0.4, 1.2, 0.7));
  // войлочная банная шапка с полями
  head.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.16, 16), felt, 0, 0.27, -0.01));
  head.add(mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.025, 18), felt, 0, 0.19, -0.01));
  const arms = [-1, 1].map(s => { const a = limb(spine, 0.38 * s, 0.56, 0, 0.32, 0.1, 0.3, 0.08, skin); a.fingers = hand(a.end, skin, 0.1); return a; });
  // берёзовый веник в правой руке
  const venik = joint(arms[1].end, 0, -0.08, 0.02);
  venik.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.26, 6), birch, 0, -0.05, 0));
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 5), leafM); l.position.set(Math.cos(i) * 0.04, -0.3, Math.sin(i * 1.7) * 0.04); l.rotation.set(Math.PI + (Math.random() - 0.5) * 0.4, i, (Math.random() - 0.5) * 0.4); venik.add(l); }
  root.userData = { kind: 'koch', hips, spine, neck, head, jaw, legs, arms, venik, eyeH: 1.85, scareDist: 0.6 };
  return bakeRig(root);
}

// ================= МАШИНА ДЕДА =================
export function makeCar(T) {
  const g = new THREE.Group();
  const paint = Lm({ color: 0x5a7a6a }), dark = C(0x151515), chrome = C(0xb0b0a8, 0x101010), glass = new THREE.MeshLambertMaterial({ color: 0x1a2a30, transparent: true, opacity: 0.75 });
  const rust = Lm({ color: 0x6a3a1a }), lamp = new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), tail = new THREE.MeshBasicMaterial({ color: 0x701010 });
  g.add(box(1.7, 0.5, 4.0, paint, 0, 0.55, 0));             // кузов
  g.add(box(1.5, 0.48, 2.0, paint, 0, 1.04, -0.25));        // кабина
  g.add(box(1.52, 0.4, 0.04, glass, 0, 1.05, 0.76)); g.add(box(1.52, 0.38, 0.04, glass, 0, 1.05, -1.26));
  for (const s of [-1, 1]) g.add(box(0.04, 0.36, 1.8, glass, 0.76 * s, 1.06, -0.25));
  g.add(box(1.74, 0.12, 0.12, chrome, 0, 0.38, 2.02)); g.add(box(1.74, 0.12, 0.12, chrome, 0, 0.38, -2.02));
  for (const s of [-1, 1]) { g.add(box(0.3, 0.16, 0.04, lamp, 0.55 * s, 0.62, 2.01)); g.add(box(0.26, 0.12, 0.04, tail, 0.6 * s, 0.62, -2.01)); }
  g.add(box(0.5, 0.25, 0.4, rust, 0.4, 0.75, 1.5));         // ржавое пятно на капоте
  const wheels = [];
  for (const [x, z] of [[-0.82, 1.3], [0.82, 1.3], [-0.82, -1.3], [0.82, -1.3]]) {
    const w = new THREE.Group(); w.position.set(x, 0.34, z); g.add(w);
    const t = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), dark); t.rotation.z = Math.PI / 2; w.add(t);
    const h = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.26, 10), chrome); h.rotation.z = Math.PI / 2; w.add(h);
    wheels.push(w);
  }
  // лучи фар (видны, когда заведена)
  const beamM = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beams = [];
  for (const s of [-1, 1]) { const b = mesh(new THREE.ConeGeometry(1.2, 7, 14, 1, true), beamM, 0.55 * s, 0.62, 5.5); b.rotation.x = -Math.PI / 2; b.visible = false; g.add(b); beams.push(b); }
  g.userData = { wheels, beams };
  return g;
}
export function makeVan(T) {
  const g = new THREE.Group();
  const paint = Lm({ color: 0xc8c4b8 }), dark = C(0x151515), glass = new THREE.MeshLambertMaterial({ color: 0x1a2a30 }), stripe = C(0x7a2020), lamp = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  g.add(box(2.0, 1.9, 4.8, paint, 0, 1.35, 0));
  g.add(box(2.02, 0.2, 4.82, stripe, 0, 1.0, 0));
  g.add(box(1.9, 0.7, 0.05, glass, 0, 1.8, 2.41));
  for (const s of [-1, 1]) g.add(box(0.05, 0.6, 0.9, glass, 1.0 * s, 1.85, 1.7));
  for (const s of [-1, 1]) g.add(box(0.3, 0.2, 0.05, lamp, 0.65 * s, 0.8, 2.41));
  for (const [x, z] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.6], [0.95, -1.6]]) { const t = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 14), dark, x, 0.4, z); t.rotation.z = Math.PI / 2; g.add(t); }
  return g;
}
