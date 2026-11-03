// «RTX»-режим первой главы: материалы с физически корректным освещением (шероховатость, металл),
// мягкие отражения окружения и свечение ярких источников (bloom)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const CACHE = new WeakMap();
let HINTS = new Map();
export function pbrHints(T) {
  const h = new Map();
  const set = (t, r, m = 0, e = 1) => { if (t) h.set(t, { r, m, e }); };
  set(T.metal, 0.38, 0.65, 1.4); set(T.tile, 0.22, 0, 1.2); set(T.porcelain, 0.12, 0, 1.3); set(T.water, 0.05, 0, 1.6);
  set(T.wood, 0.62); set(T.planks, 0.55, 0, 1.1); set(T.stone, 0.78); set(T.brick, 0.85); set(T.dirt, 0.95); set(T.fabric, 0.95, 0, 0.5);
  set(T.rug, 0.97, 0, 0.4); set(T.knit, 0.98, 0, 0.4); set(T.wall1, 0.88); set(T.wall2, 0.88); set(T.ceil, 0.9); set(T.roof, 0.7); set(T.roofIn, 0.9);
  set(T.siding, 0.72); set(T.shedWall, 0.8); set(T.attic, 0.85); set(T.window, 0.15, 0.1, 1.5); set(T.flesh, 0.45);
  HINTS = h;
}
function conv(m) {
  const hint = m.map ? (HINTS.get(m.map) || HINTS.get(findHint(m.map)) || null) : null;
  const s = new THREE.MeshStandardMaterial({
    color: m.color.clone(), map: m.map, emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap,
    side: m.side, vertexColors: m.vertexColors, alphaTest: m.alphaTest, fog: m.fog, aoMap: m.aoMap, lightMap: m.lightMap, lightMapIntensity: m.lightMapIntensity,
    polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits, depthWrite: m.depthWrite, depthTest: m.depthTest,
    roughness: hint ? hint.r : 0.82, metalness: hint ? hint.m : 0, envMapIntensity: hint ? hint.e : 0.8,
  });
  s.name = m.name; s.userData = m.userData;
  return s;
}
// текстуры часто клонируют (для повтора) — ищем подсказку по общему изображению
function findHint(tex) { for (const [t] of HINTS) if (t.source === tex.source) return t; return tex; }
export function pbrify(root) {
  root.traverse(o => {
    if (!o.isMesh || o.userData.keep || o.isInstancedMesh && o.userData.noPbr) return;
    const one = !Array.isArray(o.material), arr = one ? [o.material] : o.material;
    let ch = false;
    const out = arr.map(m => {
      if (!m || !m.isMeshLambertMaterial || m.transparent || m.userData.noPbr) return m;
      let s = CACHE.get(m); if (!s) { s = conv(m); CACHE.set(m, s); }
      ch = true; return s;
    });
    if (ch) o.material = one ? out[0] : out;
  });
}
// окружение для отражений (тёмное, ночное) и постобработка
export function setupRTX(renderer, scene, camera, quality) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene.environment = env; scene.environmentIntensity = 0.08;
  if (quality === 'low') return null;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.9); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const resize = () => { const w = window.innerWidth, h = window.innerHeight; composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); bloom.resolution.set(Math.min(512, w / 2), Math.min(512, h / 2)); };
  resize();
  return { composer, bloom, resize };
}
