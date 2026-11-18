// Abysses : textures procédurales, matériaux partagés (caustiques, matière vivante, rayons) et
// petits constructeurs de géométrie (coraux, kelp) regroupés par matériau pour limiter les appels de rendu.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../../scene/boats';

export { rng };

/** Horloge partagée par tous les shaders du thème (avancée une fois par image dans la scène). */
export const U = { time: { value: 0 } };

const noise = new ImprovedNoise();
export const fbm = (x: number, y: number, z: number, oct = 4) => {
  let a = 0.5;
  let f = 1;
  let s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise.noise(x * f, y * f, z * f);
    a *= 0.5;
    f *= 2;
  }
  return s;
};
// bruit périodique : la texture se répète sans couture
const pnoise = (u: number, v: number, s: number, o = 4) =>
  fbm(Math.cos(u * 6.283) * s, Math.sin(u * 6.283) * s, Math.cos(v * 6.283) * s + Math.sin(v * 6.283) * s * 0.5 + 3.7, o);

/** Relief du fond marin : plat sous la cité, collines au loin. */
export const ground = (x: number, z: number) => {
  const d = Math.hypot(x, z);
  return fbm(x * 0.012, 0.3, z * 0.012, 4) * 18 * THREE.MathUtils.smoothstep(d, 70, 220) + fbm(x * 0.08, 1.7, z * 0.08, 2) * 0.8 - 0.2;
};

function paintTexture(size: number, paint: (u: number, v: number) => [number, number, number], repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

function radialTex(stops: [number, string][], size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export const glowTex = radialTex([
  [0, 'rgba(255,255,255,1)'],
  [0.3, 'rgba(255,255,255,0.45)'],
  [1, 'rgba(255,255,255,0)'],
]);

export const bubbleTex = (() => {
  const t = radialTex(
    [
      [0, 'rgba(255,255,255,0.05)'],
      [0.7, 'rgba(255,255,255,0.15)'],
      [0.86, 'rgba(255,255,255,0.9)'],
      [1, 'rgba(255,255,255,0)'],
    ],
    64,
  );
  const ctx = (t.image as HTMLCanvasElement).getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(22, 22, 5, 0, 7);
  ctx.fill();
  return t;
})();

// ---------- Caustiques ----------
// Motif d'eau animé, projeté en émissif sur toutes les faces tournées vers la surface.
const CAUSTIC = `uniform float uTime; uniform float uCaus; varying vec3 vCW; varying float vCN;
float caustic(vec2 uv){ vec2 p = mod(uv * 6.28318, 6.28318) - 250.0; vec2 i = p; float c = 1.0; float t = uTime * 0.45 + 23.0;
  for (int n = 0; n < 4; n++) { float tt = t * (1.0 - 3.5 / float(n + 1)); i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005))); }
  c /= 4.0; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.0); }`;

/** Matériau standard éclairé par les caustiques ; `sway` fait onduler le haut (kelp), aussi en instances. */
export function oceanMat(params: THREE.MeshStandardMaterialParameters, { caustics = 1, sway = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.time, uSway: { value: sway }, uCaus: { value: caustics } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uSway; varying vec3 vCW; varying float vCN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 o4 = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0); float hk = 1.0;
        #ifdef USE_INSTANCING
          o4 = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); hk = length(instanceMatrix[1].xyz);
        #endif
        float sw = max(position.y, 0.0) * hk;
        transformed.x += sin(uTime * 1.1 + sw * 0.45 + o4.x * 0.3) * uSway * sw * sw;
        transformed.z += cos(uTime * 0.9 + sw * 0.4 + o4.z * 0.3) * uSway * 0.7 * sw * sw;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cw4 = vec4(transformed, 1.0); vec3 cn = objectNormal;
        #ifdef USE_INSTANCING
          cw4 = instanceMatrix * cw4; cn = mat3(instanceMatrix) * cn;
        #endif
        vCW = (modelMatrix * cw4).xyz; vCN = normalize(mat3(modelMatrix) * cn).y;`,
      );
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + CAUSTIC).replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.45, 0.95, 1.0) * caustic(vCW.xz * 0.035) * uCaus * smoothstep(0.05, 0.7, vCN) * diffuseColor.rgb * 1.6 * exp(-length(vCW - cameraPosition) * 0.007);`,
    );
  };
  m.customProgramCacheKey = () => 'abysses-ocean';
  return m;
}

/** Matière vivante : bord lumineux (Fresnel) additif, ondulation optionnelle (méduses, anémones, verre). */
export function glowMat(color: THREE.ColorRepresentation, { rim = color, stripes = 0, alpha = 0.3, sway = 0, dirY = -1 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      color: { value: new THREE.Color(color) },
      rim: { value: new THREE.Color(rim) },
      time: U.time,
      stripes: { value: stripes },
      alpha: { value: alpha },
      sway: { value: sway },
      dirY: { value: dirY },
      strength: { value: 1 },
    },
    vertexShader: `uniform float time; uniform float sway; uniform float dirY; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ vec3 p = position; float d = max(p.y * dirY, 0.0); float ph = modelMatrix[3].x + modelMatrix[3].z;
        p.x += sin(time * 1.3 + d * 0.8 + ph) * sway * d * 0.3; p.z += cos(time * 1.1 + d * 0.7 + ph) * sway * d * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vUv = uv; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform vec3 rim; uniform float time; uniform float stripes; uniform float alpha; uniform float strength; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 1.8);
        float s = stripes > 0.0 ? 0.5 + 0.5 * pow(abs(sin(vUv.x * 3.14159 * stripes)), 6.0) : 1.0;
        float edge = stripes > 0.0 ? smoothstep(0.2, 0.0, vUv.y) : 0.0; float pulse = 0.85 + 0.15 * sin(time * 2.0 - vUv.y * 6.0);
        vec3 c = (mix(color, rim, f) * (0.35 + f * 1.5) * s * pulse + rim * edge * 1.5) * strength; gl_FragColor = vec4(c, alpha + f * 0.5); }`,
  });
}

/** Puits de lumière descendant de la surface (`beam` = 0) ou faisceau de phare (`beam` = 1). */
export function rayMat(color: THREE.ColorRepresentation, k = 0.12, beam = 0, seed = 0) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(color) }, time: U.time, k: { value: k }, beam: { value: beam }, seed: { value: seed } },
    vertexShader:
      'varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vUv = uv; vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 color; uniform float time; uniform float k; uniform float beam; uniform float seed; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vD;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.5);
        float st = beam > 0.5 ? 1.0 : 0.55 + 0.45 * sin(vUv.x * 31.4 + time * 0.3 + seed) * sin(vUv.x * 18.8 - time * 0.21 + seed);
        float fade = beam > 0.5 ? pow(vUv.y, 2.0) : smoothstep(0.0, 0.55, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        float a = edge * st * fade * (0.7 + 0.3 * sin(time * 0.4 + seed)) * k * exp(-vD * 0.006); gl_FragColor = vec4(color, a); }`,
  });
}

// ---------- Matières ----------
const sandTex = paintTexture(
  256,
  (u, v) => {
    const r = Math.sin((v * 18 + pnoise(u, v, 2, 3) * 2.5) * Math.PI * 2) * 0.5 + 0.5;
    const k = 120 + r * 22 + pnoise(u, v, 24, 2) * 40;
    return [k * 0.9, k * 0.95, k * 0.86];
  },
  40,
);
const stoneTex = paintTexture(
  256,
  (u, v) => {
    const n = pnoise(u, v, 4) * 0.6 + pnoise(u, v, 16, 2) * 0.4;
    const alg = Math.max(0, pnoise(u, v, 2.2, 3)) * 1.6;
    const k = 128 + n * 60;
    return [k * (0.85 - alg * 0.3), k * (0.95 + alg * 0.25), k * (0.92 - alg * 0.1)];
  },
  2,
);
const fanTex = (() => {
  const r = rng(31);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = '#fff';
  const grow = (x: number, y: number, a: number, l: number, w: number) => {
    if (l < 6) return;
    const x2 = x + Math.cos(a) * l;
    const y2 = y + Math.sin(a) * l;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    grow(x2, y2, a - 0.2 - r() * 0.3, l * 0.78, w * 0.8);
    grow(x2, y2, a + 0.2 + r() * 0.3, l * 0.78, w * 0.8);
  };
  grow(128, 256, -Math.PI / 2, 52, 5);
  return new THREE.CanvasTexture(c);
})();

export const MAT = {
  sand: oceanMat({ map: sandTex, roughness: 1 }),
  stone: oceanMat({ map: stoneTex, roughness: 0.9 }),
  reef: oceanMat({ map: stoneTex, color: 0x8a7c86, roughness: 0.95 }),
  brass: oceanMat({ color: 0xc09848, metalness: 0.45, roughness: 0.4 }, { caustics: 0.6 }),
  darkMetal: oceanMat({ color: 0x24343a, metalness: 0.6, roughness: 0.5 }, { caustics: 0.5 }),
  suit: oceanMat({ color: 0x9a7a4a, roughness: 0.85 }, { caustics: 0.4 }),
  kelp: oceanMat({ color: 0x4f8a3a, emissive: 0x0c2208, roughness: 0.9, side: THREE.DoubleSide }, { caustics: 0.4, sway: 0.004 }),
  fan: oceanMat({ color: 0xb54aa0, alphaMap: fanTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }, { caustics: 0.5 }),
  /** verre des dômes et des tubes : presque invisible, seul le bord brille */
  glass: glowMat(0x5fe4ff, { rim: 0xbff8ff, alpha: 0.03 }),
  cable: new THREE.MeshStandardMaterial({ color: 0x021015, emissive: 0x4fdfff, emissiveIntensity: 0.9 }),
  port: new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffd98a, emissiveIntensity: 1.4 }),
};

export const CORALS = [0xff7a6b, 0xe0559a, 0xffa94d, 0x9a6bff, 0x3fd1c0].map((c) => oceanMat({ color: c, roughness: 0.8, emissive: c, emissiveIntensity: 0.08 }));

// ---------- Géométrie regroupée par matériau ----------
const KEEP = new Set(['position', 'normal', 'uv']);
const tmpM = new THREE.Matrix4();

/** Accumule des géométries (transformées) et les fusionne : un seul maillage par matériau. */
export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, geo: THREE.BufferGeometry, m: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
    g.clearGroups();
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }
  build({ cast = true, receive = true } = {}) {
    const group = new THREE.Group();
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

export const mat4 = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: number | [number, number, number] = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s),
  );

/** Corail branchu : segments qui se divisent, une perle au bout de chaque branche. */
export function branchCoral(b: Batch, mat: THREE.Material, len: number, r: number, depth: number, m: THREE.Matrix4, rnd: () => number) {
  const seg = new THREE.CylinderGeometry(r * 0.7, r, len, 6);
  seg.translate(0, len / 2, 0);
  b.add(mat, seg, m);
  if (depth > 0) {
    const n = 2 + (rnd() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const child = m.clone().multiply(mat4(0, len * (0.75 + rnd() * 0.25), 0, (rnd() - 0.5) * 1.2, rnd() * 6.28, (rnd() - 0.5) * 1.2));
      branchCoral(b, mat, len * 0.75, r * 0.7, depth - 1, child, rnd);
    }
  } else {
    const tip = new THREE.SphereGeometry(r * 1.1, 8, 6);
    tip.translate(0, len, 0);
    b.add(mat, tip, m);
  }
}

/** Corail cerveau : boule aplatie et plissée. */
export function brainCoralGeo(r: number, seed: number) {
  const geo = new THREE.IcosahedronGeometry(r, 3);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + Math.sin(fbm(v.x * 0.6 + seed, v.y * 0.6, v.z * 0.6, 3) * 40) * 0.05;
    v.multiplyScalar(k);
    v.y = Math.max(v.y, -r * 0.2) * 0.75;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function fanCoralGeo(h: number) {
  const g = new THREE.PlaneGeometry(h, h);
  g.translate(0, h / 2, 0);
  return g;
}

/** Ajoute un corail au hasard (cerveau, branchu ou éventail) au lot. */
export function addCoral(b: Batch, kind: number, x: number, y: number, z: number, rnd: () => number, size = 1) {
  const mat = CORALS[Math.floor(rnd() * CORALS.length)];
  const m = mat4(x, y, z, 0, rnd() * 6.28, 0);
  if (kind % 3 === 0) b.add(mat, brainCoralGeo((0.7 + rnd() * 1.2) * size, rnd() * 9), m);
  else if (kind % 3 === 1) branchCoral(b, mat, (0.8 + rnd() * 0.7) * size, 0.16 * size, 3, m, rnd);
  else b.add(MAT.fan, fanCoralGeo((2 + rnd() * 2) * size), m);
}

/** Lames de kelp (une géométrie unitaire, la hauteur vient de l'instance). */
export const kelpGeo = (() => {
  const g = new THREE.PlaneGeometry(0.7, 1, 1, 24);
  g.translate(0, 0.5, 0);
  return g;
})();

/** Forêt de kelp en instances : `items` = [x, y, z, hauteur, angle]. */
export function kelpForest(items: [number, number, number, number, number][]) {
  const mesh = new THREE.InstancedMesh(kelpGeo, MAT.kelp, items.length);
  items.forEach(([x, y, z, h, a], i) => mesh.setMatrixAt(i, tmpM.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, h, 1))));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false; // les lames ondulent hors de la boîte englobante
  mesh.castShadow = true;
  return mesh;
}

/** Libère les géométries d'un objet construit à la main (les matériaux partagés restent). */
export function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry && m.geometry !== kelpGeo) m.geometry.dispose();
    if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
  });
}
