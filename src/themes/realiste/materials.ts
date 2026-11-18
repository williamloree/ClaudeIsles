// Textures procédurales (herbe, roche, bois, nuage, eau) et matériaux partagés des îles célestes.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { rng } from '../../scene/boats';

export { rng };

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
  fbm(Math.cos(u * 2 * Math.PI) * s, Math.sin(u * 2 * Math.PI) * s, Math.cos(v * 2 * Math.PI) * s + Math.sin(v * 2 * Math.PI) * s * 0.5 + 7.3, o);

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

const grassTex = paintTexture(256, (u, v) => {
  const n = pnoise(u, v, 3) * 0.5 + pnoise(u, v, 12, 2) * 0.5;
  return [62 + n * 50, 118 + n * 70, 36 + n * 26];
}, 6);
const rockTex = paintTexture(256, (u, v) => {
  const n = pnoise(u, v, 2.5) + Math.sin(v * 40 + pnoise(u, v, 4) * 6) * 0.08;
  const k = 110 + n * 90;
  return [k * 1.02, k * 0.9, k * 0.78];
}, 3);
const woodTex = paintTexture(256, (u, v) => {
  const g = Math.sin((u * 30 + pnoise(u, v, 2) * 4) * Math.PI) * 0.5 + 0.5;
  return [120 + g * 50, 78 + g * 30, 45 + g * 15];
});

export const MAT = {
  grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
  rock: new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.92 }),
  wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.7 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.35, metalness: 0.9 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.6 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xc9c4bb, roughness: 0.55 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.2 }),
  rope: new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.9 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide }),
  skin: new THREE.MeshStandardMaterial({ color: 0xd8a27c, roughness: 0.6 }),
  hair: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.8 }),
  pants: new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.9 }),
  mug: new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.3 }),
  canvas: new THREE.MeshStandardMaterial({ color: 0xe8e0cf, roughness: 0.85 }),
};

/** Feuillages de sapin : trois verts, pour que les forêts ne soient pas uniformes. */
export const FOLIAGE = [0.16, 0.185, 0.21].map((l) => new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.3, 0.45, l), roughness: 0.95 }));

/** Chemises des personnages (choisie par la graine de l'agent). */
export const SHIRTS = [0x3f5e8c, 0x7c4d3a, 0x2f6b55, 0x6b6b6b, 0x8c6d3f, 0x5a4a7c].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));

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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Nuage cotonneux : des bouffées superposées (graine fixe). */
export const cloudTex = canvasTex(256, 256, (ctx) => {
  const r = rng(321);
  for (let i = 0; i < 28; i++) {
    const x = 60 + r() * 136;
    const y = 90 + r() * 80;
    const rad = 28 + r() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
});

/** Halo doux (lanternes, balises). */
export const glowTex = canvasTex(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Matériau de halo additif, mis en cache par couleur (partagé entre balises de même statut). */
const glowCache = new Map<string, THREE.SpriteMaterial>();
export function glowMaterial(color: string, opacity = 0.9) {
  const key = `${color}|${opacity}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    glowCache.set(key, m);
  }
  return m;
}

/** Ampoule (lanterne, balise) : couleur poussée au-delà de 1 pour que le bloom la fasse briller. */
const bulbCache = new Map<string, THREE.MeshBasicMaterial>();
export function bulbMaterial(color: string, boost = 2.2) {
  const key = `${color}|${boost}`;
  let m = bulbCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(boost), toneMapped: false });
    bulbCache.set(key, m);
  }
  return m;
}
