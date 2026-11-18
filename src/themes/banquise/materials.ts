// Textures procédurales (glace craquelée, neige, halos, flamme, normales d'eau) et matériaux partagés de la banquise.
// Pas de `transmission` (beaucoup trop lent en rendu logiciel) : la glace luit par un liseré de Fresnel.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

export { rng } from '../../scene/boats';

export const noise = new ImprovedNoise();
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

const iceTex = paintTexture(
  256,
  (u, v) => {
    const n = pnoise(u, v, 3) * 0.6 + pnoise(u, v, 12, 2) * 0.4;
    const crack = Math.abs(pnoise(u + 0.3, v, 5, 3)) < 0.025 ? 0.78 : 1; // fines craquelures
    const k = (226 + n * 40) * crack;
    return [k * 0.9, k * 0.97, Math.min(255, k * 1.04)];
  },
  2,
);
const snowTex = paintTexture(
  256,
  (u, v) => {
    const k = 236 + pnoise(u, v, 9, 3) * 30 + pnoise(u, v, 40, 1) * 12; // grain fin de la neige
    return [k * 0.96, k * 0.98, Math.min(255, k)];
  },
  3,
);

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return new THREE.CanvasTexture(c);
}

/** Halo doux et lumineux (lanternes, clignotant). */
export const glowTex = canvasTex(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Brume, buée, flocons. */
export const mistTex = canvasTex(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

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

/** Normales d'eau périodiques, faites de vagues sinusoïdales (houle plus calme que le Styx). */
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
      n.set(-dx * 0.06, -dy * 0.06, 1).normalize();
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

/** Liseré de Fresnel : la glace s'allume sur ses bords. */
function withRim<M extends THREE.MeshStandardMaterial>(mat: M, color: number, power: number, k: number, key: string) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.rimColor = { value: new THREE.Color(color) };
    s.fragmentShader =
      'uniform vec3 rimColor;\n' +
      s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  totalEmissiveRadiance += rimColor * ${k.toFixed(3)} * pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), ${power.toFixed(2)});`,
      );
  };
  mat.customProgramCacheKey = () => 'banquise-rim-' + key;
  return mat;
}

export const MAT = {
  /** flancs d'iceberg : couleurs par sommet (bleu profond → blanc), facettes */
  berg: withRim(new THREE.MeshStandardMaterial({ vertexColors: true, map: iceTex, bumpMap: iceTex, bumpScale: 0.6, roughness: 0.28, flatShading: true, emissive: 0x06182a }), 0x7fd4ff, 2.2, 0.55, 'berg'),
  facet: withRim(new THREE.MeshStandardMaterial({ color: 0xa6d8f0, map: iceTex, roughness: 0.2, flatShading: true, emissive: 0x0a2236 }), 0x92e0ff, 2.0, 0.75, 'facet'),
  clear: withRim(
    new THREE.MeshPhysicalMaterial({ color: 0xc8ecff, ior: 1.31, roughness: 0.08, specularIntensity: 1, transparent: true, opacity: 0.7, flatShading: true, emissive: 0x0d3350 }),
    0xa6ecff,
    1.6,
    1.1,
    'clear',
  ),
  block: withRim(new THREE.MeshStandardMaterial({ color: 0xb4dcf0, map: iceTex, roughness: 0.22, emissive: 0x0a2236 }), 0x8fdcff, 2.4, 0.5, 'block'),
  snow: withRim(new THREE.MeshStandardMaterial({ color: 0xe6f0fa, map: snowTex, roughness: 0.92, emissive: 0x0d1a26 }), 0xbfe4ff, 3.0, 0.35, 'snow'),
  plate: withRim(new THREE.MeshStandardMaterial({ color: 0xc6dcea, map: snowTex, roughness: 0.6, emissive: 0x0a1824 }), 0x9fd8ff, 2.6, 0.4, 'plate'),
  far: withRim(new THREE.MeshStandardMaterial({ color: 0x8fb9d0, roughness: 0.5, flatShading: true, emissive: 0x0a1a28 }), 0x7fc8f0, 2.0, 0.5, 'far'),
  wood: new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 0.85 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x38444f, metalness: 0.8, roughness: 0.35 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x9a7438, metalness: 0.9, roughness: 0.3 }),
  rope: new THREE.MeshStandardMaterial({ color: 0x8a7352, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x4e5560, roughness: 0.95, flatShading: true }),
  fur: new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 1 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.9 }),
  face: new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 1 }),
  pack: new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.9 }),
  canvas: new THREE.MeshStandardMaterial({ color: 0xb8773a, roughness: 0.9, side: THREE.DoubleSide }),
};

/** Parkas des explorateurs (une par graine). */
export const PARKAS = [0x8f2a1c, 0x2b5f86, 0xb07a24, 0x3f6a46].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
