// Textures procédurales (basalte, marbre, eau, flamme, brume, ondes) et matériaux partagés des Enfers.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

export { rng } from '../../scene/boats';

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

const basaltTex = paintTexture(256, (u, v) => {
  const n = pnoise(u, v, 3) * 0.7 + pnoise(u, v, 14, 2) * 0.3;
  const k = 38 + n * 40;
  return [k, k * 1.02, k * 1.05];
}, 3);
const marbleTex = paintTexture(256, (u, v) => {
  const vein = Math.abs(Math.sin((u * 3 + v * 2 + pnoise(u, v, 2.5) * 2.2) * Math.PI));
  const k = 170 + Math.pow(vein, 0.25) * 55 + pnoise(u, v, 10, 2) * 20;
  return [k, k * 0.97, k * 0.9];
}, 2);

export const MAT = {
  basalt: new THREE.MeshStandardMaterial({ map: basaltTex, roughness: 0.95 }),
  marble: new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.45 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.9 }),
  bronze: new THREE.MeshStandardMaterial({ color: 0x7a5528, metalness: 0.85, roughness: 0.4 }),
  cypress: new THREE.MeshStandardMaterial({ color: 0x0d1f16, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.8 }),
  cloak: new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 1 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.7 }),
};

/** Normales d'eau périodiques, faites de vagues sinusoïdales (pas de fichier à télécharger). */
export const waterNormals = (() => {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  const waves = Array.from({ length: 14 }, (_, i) => ({ kx: Math.round(Math.cos(i * 2.4) * (2 + i)), ky: Math.round(Math.sin(i * 2.4) * (2 + i)), a: 1 / (2 + i), p: i * 1.7 }));
  const n = new THREE.Vector3();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const c2 = Math.cos((2 * Math.PI * (w.kx * x + w.ky * y)) / N + w.p) * w.a;
        dx += c2 * w.kx;
        dy += c2 * w.ky;
      }
      n.set(-dx * 0.08, -dy * 0.08, 1).normalize();
      const i = (y * N + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return new THREE.CanvasTexture(c);
}

export const flameTex = canvasTex(64, 128, (ctx) => {
  const g = ctx.createRadialGradient(32, 92, 2, 32, 80, 60);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 2);
  ctx.quadraticCurveTo(64, 80, 32, 126);
  ctx.quadraticCurveTo(0, 80, 32, 2);
  ctx.fill();
});

export const softTex = canvasTex(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Anneau d'onde à la surface de l'eau. */
export const rippleTex = canvasTex(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 40, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

// ---------- Fantômes ----------
/** Horloge partagée par tous les shaders de fantômes (avancée une fois par image dans World). */
export const ghostTime = { value: 0 };

const ghostCache = new Map<string, THREE.ShaderMaterial>();

/**
 * Matériau spectral : bord lumineux (Fresnel), cœur presque transparent, ondulation et
 * effilochage vers le bas (`fadeBottom` = hauteur locale sous laquelle la forme se dissout).
 */
export function ghostMaterial(color: string, opts: { fadeBottom?: number; wave?: number; strength?: number } = {}) {
  const { fadeBottom = -10, wave = 0, strength = 1 } = opts;
  const key = `${color}|${fadeBottom}|${wave}|${strength}`;
  let m = ghostCache.get(key);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, time: ghostTime, fadeBottom: { value: fadeBottom }, wave: { value: wave }, strength: { value: strength } },
    vertexShader: `
      uniform float time; uniform float fadeBottom; uniform float wave;
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vA;
      void main() {
        vec3 p = position;
        float low = clamp((0.6 - p.y) / 1.2, 0.0, 1.0);
        float a = atan(p.z, p.x);
        p.xz *= 1.0 + wave * low * low * (0.12 * sin(time * 2.6 + a * 5.0 + p.y * 7.0));
        p.x += wave * low * low * 0.06 * sin(time * 1.7 + p.y * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = p.y; vA = a;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color; uniform float time; uniform float fadeBottom; uniform float strength;
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vA;
      void main() {
        float f = pow(1.0 - abs(dot(vN, vV)), 1.7);
        float flick = 0.86 + 0.14 * sin(time * 3.0 + vY * 6.0);
        float tatter = fadeBottom + 0.12 * sin(vA * 9.0 + time * 2.0) + 0.06 * sin(vA * 23.0 - time * 3.0);
        float fade = smoothstep(tatter, tatter + 0.45, vY);
        gl_FragColor = vec4(color * (0.2 + f * 1.7) * flick * strength * fade, (0.22 + f * 0.7) * fade);
      }`,
  });
  ghostCache.set(key, m);
  return m;
}
