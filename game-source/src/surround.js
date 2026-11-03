// Окрестности дома: земля до горизонта, густой лес вокруг двора, кладбище, пруд,
// и «задник» без тумана — небо со звёздами и луной, силуэты холмов, огоньки деревни, вышка.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const YARD = { x0: 0, x1: 64, z0: 0, z1: 48 };   // двор (клетки 32×24 по 2 м)

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function colorize(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
function prep(g) { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; }

export function buildSurroundings(scene, T, opts = {}) {
  const R = rng(4242);
  const near = new THREE.Group(); near.name = 'surroundNear'; scene.add(near);

  // ---------- земля вокруг двора (не заходит на двор — без мерцания) ----------
  const gTex = T.grass.clone(); gTex.needsUpdate = true; gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping;
  const groundM = new THREE.MeshLambertMaterial({ map: gTex, color: 0x8a9a7a });
  const slab = (x0, x1, z0, z1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 4, uv.getY(i) * (z1 - z0) / 4);
    const m = new THREE.Mesh(g, groundM); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); near.add(m);
  };
  slab(-260, 324, -260, 0);              // за воротами: дорога, поле, бункер
  slab(-260, 0, 0, 260); slab(64, 324, 0, 260); slab(0, 64, 48, 260);

  // ---------- лес (инстансы: несколько вызовов отрисовки на весь лес) ----------
  const fir = mergeGeometries([
    colorize(prep(new THREE.CylinderGeometry(0.16, 0.28, 2.4, 6).translate(0, 1.2, 0)), 0x3a2c20),
    colorize(prep(new THREE.ConeGeometry(2.1, 3.6, 7).translate(0, 3.2, 0)), 0x16281a),
    colorize(prep(new THREE.ConeGeometry(1.6, 3.0, 7).translate(0, 4.9, 0)), 0x1a2e1e),
    colorize(prep(new THREE.ConeGeometry(1.0, 2.4, 7).translate(0, 6.4, 0)), 0x1e3422),
  ]);
  const deadParts = [colorize(prep(new THREE.CylinderGeometry(0.12, 0.3, 5.5, 6).translate(0, 2.75, 0)), 0x2e2620)];
  for (let i = 0; i < 6; i++) { const b = new THREE.CylinderGeometry(0.03, 0.09, 2.2, 4).translate(0, 1.1, 0); b.rotateZ(0.6 + (i % 3) * 0.25); b.rotateY(i * 1.1); b.translate(0, 2.4 + i * 0.45, 0); deadParts.push(colorize(prep(b), 0x2e2620)); }
  const dead = mergeGeometries(deadParts);
  const treeM = new THREE.MeshLambertMaterial({ vertexColors: true });
  const spots = { fir: [], dead: [] };
  const blocked = (x, z) => {
    if (x > YARD.x0 - 2.5 && x < YARD.x1 + 2.5 && z > YARD.z0 - 1.5 && z < YARD.z1 + 2.5) return true;   // двор + забор
    if (z > -10 && z < 0.5) return true;                                                              // дорога и обочины
    if (x > -44 && x < 104 && z > -47 && z < 0.5) return true;                                        // поле и деревня за дорогой (там ходят)
    if (opts.keep && opts.keep.some(([kx, kz, r]) => Math.hypot(x - kx, z - kz) < r)) return true;
    return false;
  };
  for (let i = 0; i < 2600 && spots.fir.length + spots.dead.length < 760; i++) {
    const x = -70 + R() * 204, z = -75 + R() * 190;
    if (blocked(x, z)) continue;
    const dYard = Math.max(YARD.x0 - x, x - YARD.x1, YARD.z0 - z, z - YARD.z1, 0);
    if (dYard < 8 && R() < 0.45) continue;   // у забора — реже, чтобы был виден край леса
    (R() < 0.82 ? spots.fir : spots.dead).push([x, z, 0.75 + R() * 0.65, R() * 6.28]);
  }
  const inst = (geo, list) => {
    const im = new THREE.InstancedMesh(geo, treeM, list.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach(([x, z, k, r], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); s.set(k, k * (0.9 + (i % 5) * 0.08), k); p.set(x, 0, z); m4.compose(p, q, s); im.setMatrixAt(i, m4); });
    im.frustumCulled = false; near.add(im); return im;
  };
  inst(fir, spots.fir); inst(dead, spots.dead);

  // ---------- кладбище за домом ----------
  const stoneM = new THREE.MeshLambertMaterial({ map: T.stone, color: 0x7a7a74 }), woodM = new THREE.MeshLambertMaterial({ map: T.wood, color: 0x4a3a2a });
  const cem = new THREE.Group(); cem.position.set(22, 0, 56);
  for (let i = 0; i < 14; i++) {
    const x = (i % 7) * 2.6 - 7.8 + (R() - 0.5) * 0.6, z = Math.floor(i / 7) * 3.2 + (R() - 0.5) * 0.6;
    if (i % 3 === 0) { const c = new THREE.Group(); const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.1), woodM); v.position.y = 0.65; c.add(v); const h = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.1), woodM); h.position.y = 0.95; c.add(h); c.position.set(x, 0, z); c.rotation.set(0, (R() - 0.5) * 0.5, (R() - 0.5) * 0.25); cem.add(c); }
    else { const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8 + R() * 0.3, 0.16), stoneM); s.position.set(x, 0.4, z); s.rotation.set((R() - 0.5) * 0.2, (R() - 0.5) * 0.3, (R() - 0.5) * 0.15); cem.add(s); }
  }
  for (let i = 0; i < 12; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), woodM); p.position.set(-10 + i * 1.8, 0.45, -1.6); p.rotation.z = (R() - 0.5) * 0.2; cem.add(p); }
  near.add(cem);
  // ---------- пруд слева ----------
  const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 24), new THREE.MeshLambertMaterial({ map: T.water || null, color: 0x203040, emissive: 0x050a10 }));
  pond.rotation.x = -Math.PI / 2; pond.scale.set(1.5, 1, 1); pond.position.set(-16, 0.02, 26); near.add(pond);
  for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28, reed = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.2 + R() * 0.6, 4), new THREE.MeshLambertMaterial({ color: 0x2a3a1a })); reed.position.set(-16 + Math.cos(a) * 10.4, 0.6, 26 + Math.sin(a) * 7); near.add(reed); }
  // ---------- старый амбар справа ----------
  const barn = new THREE.Group(); barn.position.set(80, 0, 22); barn.rotation.y = 0.25;
  const plankM = new THREE.MeshLambertMaterial({ map: T.wood, color: 0x5a2a20 });
  const bw = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 7), plankM); bw.position.y = 2.5; barn.add(bw);
  const roofG = new THREE.CylinderGeometry(0.01, 5.6, 3, 4, 1); roofG.rotateY(Math.PI / 4); const rf = new THREE.Mesh(roofG, new THREE.MeshLambertMaterial({ color: 0x1a1414 })); rf.scale.set(1.15, 1, 0.9); rf.position.y = 6.5; barn.add(rf);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshBasicMaterial({ color: 0x050403 })); door.position.set(-4.51, 1.7, 0); door.rotation.y = -Math.PI / 2; barn.add(door);
  near.add(barn);

  // ---------- задник без тумана: небо, луна, холмы, деревня, вышка ----------
  const far = new THREE.Group(); far.name = 'surroundFar'; scene.add(far);
  const nf = (o) => Object.assign({ fog: false, depthWrite: false }, o);
  // небо: градиент к горизонту
  const skyG = new THREE.SphereGeometry(125, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
  { const pos = skyG.attributes.position, col = new Float32Array(pos.count * 3), top = new THREE.Color(0x020308), hor = new THREE.Color(0x141a2c);
    for (let i = 0; i < pos.count; i++) { const t = Math.max(0, Math.min(1, pos.getY(i) / 125)); const c = hor.clone().lerp(top, Math.pow(t, 0.55)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    skyG.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const sky = new THREE.Mesh(skyG, new THREE.MeshBasicMaterial(nf({ vertexColors: true, side: THREE.BackSide }))); sky.renderOrder = -10; far.add(sky);
  // звёзды
  const sp = []; for (let i = 0; i < 700; i++) { const a = R() * 6.28, e = 0.12 + Math.pow(R(), 0.7) * 1.35; sp.push(Math.cos(a) * Math.cos(e) * 118, Math.sin(e) * 118, Math.sin(a) * Math.cos(e) * 118); }
  const stG = new THREE.BufferGeometry(); stG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(stG, new THREE.PointsMaterial(nf({ color: 0xc8d0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 }))); stars.renderOrder = -9; far.add(stars);
  // луна с ореолом
  const mc = document.createElement('canvas'); mc.width = mc.height = 128; const mg = mc.getContext('2d');
  const gr = mg.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, 'rgba(240,236,220,1)'); gr.addColorStop(0.22, 'rgba(225,222,205,1)'); gr.addColorStop(0.27, 'rgba(150,160,200,0.35)'); gr.addColorStop(1, 'rgba(60,70,120,0)');
  mg.fillStyle = gr; mg.fillRect(0, 0, 128, 128); mg.fillStyle = 'rgba(160,150,130,0.35)'; for (const [x, y, r] of [[56, 58, 5], [70, 70, 4], [62, 74, 3], [72, 54, 3]]) { mg.beginPath(); mg.arc(x, y, r, 0, 7); mg.fill(); }
  const moonT = new THREE.CanvasTexture(mc); moonT.colorSpace = THREE.SRGBColorSpace;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial(nf({ map: moonT, transparent: true }))); moon.scale.setScalar(26); moon.position.set(-55, 62, 80); moon.renderOrder = -8; far.add(moon);
  // холмы и зубчатая линия дальнего леса
  const ring = (r, base, amp, seed, col, saw) => {
    const N = 160, P = [], idx = [], rr = rng(seed);
    let h = 0; const hs = []; for (let i = 0; i < N; i++) { h += (rr() - 0.5) * amp * 0.5; h *= 0.92; hs.push(h); }
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2, k = i % N; let top = base + hs[k] + Math.sin(a * 3 + seed) * amp * 0.6;
      if (saw) top += (i % 2 ? 0 : saw * (0.6 + rr() * 0.8));
      P.push(Math.cos(a) * r, -4, Math.sin(a) * r, Math.cos(a) * r, top, Math.sin(a) * r);
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial(nf({ color: col, side: THREE.DoubleSide }))); m.renderOrder = -7; far.add(m); return m;
  };
  ring(118, 9, 9, 7, 0x0b0f1a, 0);       // дальние холмы
  ring(110, 5, 3, 11, 0x07090f, 2.2);    // верхушки дальнего леса
  // деревня на горизонте: тёплые окна и фонари
  const vl = []; const vc = [];
  const warm = new THREE.Color(0xffc070), cold = new THREE.Color(0xd8e0ff);
  for (const [a0, a1, n] of [[-2.35, -1.95, 22], [0.55, 0.75, 9], [2.6, 2.75, 6]]) for (let i = 0; i < n; i++) {
    const a = a0 + R() * (a1 - a0), r = 104 + R() * 4, y = 2.5 + R() * 3.5; vl.push(Math.cos(a) * r, y, Math.sin(a) * r); const c = R() < 0.8 ? warm : cold; vc.push(c.r, c.g, c.b);
  }
  const vG = new THREE.BufferGeometry(); vG.setAttribute('position', new THREE.Float32BufferAttribute(vl, 3)); vG.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3));
  const village = new THREE.Points(vG, new THREE.PointsMaterial(nf({ size: 2.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9 }))); village.renderOrder = -6; far.add(village);
  // силуэт церкви у деревни
  const silM = new THREE.MeshBasicMaterial(nf({ color: 0x05070c })); const ca = -2.15, cr = 106;
  const church = new THREE.Group(); church.position.set(Math.cos(ca) * cr, 0, Math.sin(ca) * cr); church.lookAt(0, 0, 0);
  const cb = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 4), silM); cb.position.y = 4.5; church.add(cb);
  const ct = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.4), silM); ct.position.set(0, 11, 0); church.add(ct);
  const cd = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), silM); cd.position.set(0, 16, 0); cd.scale.y = 1.4; church.add(cd);
  const cs = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), silM); cs.position.set(0, 18.6, 0); church.add(cs);
  church.traverse(o => { if (o.isMesh) o.renderOrder = -6; }); far.add(church);
  // радиовышка с мигающим огнём
  const ta = 0.95, tr = 108; const tower = new THREE.Group(); tower.position.set(Math.cos(ta) * tr, 0, Math.sin(ta) * tr);
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.5, 34, 4), silM); l.position.y = 17; l.rotation.y = i; tower.add(l); }
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial(nf({ color: 0xff2010 }))); blink.position.y = 34.5; tower.add(blink);
  tower.traverse(o => { if (o.isMesh) o.renderOrder = -6; }); far.add(tower);
  // облака — тёмные полосы на фоне неба
  const cc = document.createElement('canvas'); cc.width = 256; cc.height = 64; const cg = cc.getContext('2d');
  for (let i = 0; i < 40; i++) { const x = R() * 256, y = 20 + R() * 24, rr2 = 10 + R() * 22; const g2 = cg.createRadialGradient(x, y, 0, x, y, rr2); g2.addColorStop(0, 'rgba(40,46,70,0.35)'); g2.addColorStop(1, 'rgba(40,46,70,0)'); cg.fillStyle = g2; cg.fillRect(0, 0, 256, 64); }
  // мягкие края, чтобы облака не были видны прямоугольниками
  { const m = cg.createLinearGradient(0, 0, 256, 0); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.25, 'rgba(0,0,0,0)'); m.addColorStop(0.75, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    cg.globalCompositeOperation = 'destination-out'; cg.fillStyle = m; cg.fillRect(0, 0, 256, 64);
    const v = cg.createLinearGradient(0, 0, 0, 64); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.3, 'rgba(0,0,0,0)'); v.addColorStop(0.7, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    cg.fillStyle = v; cg.fillRect(0, 0, 256, 64); cg.globalCompositeOperation = 'source-over'; }
  const cloudT = new THREE.CanvasTexture(cc);
  const clouds = [];
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(90, 22), new THREE.MeshBasicMaterial(nf({ map: cloudT, transparent: true, side: THREE.DoubleSide }))); const a = i / 6 * 6.28; c.position.set(Math.cos(a) * 100, 34 + (i % 3) * 7, Math.sin(a) * 100); c.lookAt(0, 30, 0); c.renderOrder = -8; far.add(c); clouds.push(c); }

  let t = 0;
  return {
    near, far,
    update(dt, cam, show) {
      t += dt;
      far.visible = near.visible = show;
      if (!show) return;
      far.position.set(cam.x, 0, cam.z);
      blink.visible = (t % 1.6) < 0.25;
      far.rotation.y = 0;
      for (const c of clouds) c.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.004);
    },
  };
}
