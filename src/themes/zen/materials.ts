// Textures procédurales (pierre, mousse, bois, sable ratissé, papier) et matériaux partagés du jardin zen.
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { rng } from '../../scene/boats';

export { rng };

// ---------- Polices ----------
/** Police des inscriptions (étiquettes, rouleaux, lanternes). Chargée par le thème, pas par index.html. */
export const SERIF = "'Shippori Mincho', 'Yu Mincho', 'MS Mincho', Georgia, serif";
export const MONO = "'JetBrains Mono', Consolas, monospace";

/** Ajoute la feuille de style de la police (index.html ne la connaît pas), puis attend les glyphes. */
function loadFonts(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  let link = document.getElementById('zen-font') as HTMLLinkElement | null;
  const sheet = new Promise<void>((resolve) => {
    if (link?.sheet) return resolve();
    if (!link) {
      link = Object.assign(document.createElement('link'), {
        id: 'zen-font',
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&display=swap',
      });
      document.head.appendChild(link);
    }
    link.addEventListener('load', () => resolve());
    link.addEventListener('error', () => resolve());
    setTimeout(resolve, 4000); // hors ligne : on écrit avec la police de secours
  });
  return sheet
    .then(() => Promise.all([document.fonts.load(`700 30px ${SERIF}`, 'CLAUDE 禅灯殻'), document.fonts.load(`600 20px ${MONO}`)]))
    .then(
      () => undefined,
      () => undefined,
    );
}
const fontsReady = loadFonts();

/** Passe à vrai quand les polices sont chargées : les canvas se redessinent alors avec la bonne écriture. */
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    fontsReady.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

// ---------- Bruit ----------
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

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

export function canvasTex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function paintTexture(size: number, paint: (u: number, v: number) => [number, number, number], repeat = 1) {
  const [c, ctx] = makeCanvas(size, size);
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
  const t = canvasTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/** Fibres de papier washi. */
export function fibers(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n = 1400, seed = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(110,90,60,${r() * 0.09})`;
    ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 6, 1);
  }
}

/** Sceau rouge (hanko) au caractère donné. */
export function seal(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, char = '禅') {
  ctx.fillStyle = '#b3261e';
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = '#f3e6c8';
  ctx.font = `700 ${Math.round(s * 0.64)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText(char, x + s / 2, y + s * 0.74);
}

const stoneTex = paintTexture(256, (u, v) => {
  const n = pnoise(u, v, 4) * 0.6 + pnoise(u, v, 16, 2) * 0.4;
  const l = Math.max(0, pnoise(u + 0.3, v, 6, 3)) * 2; // lichen
  const k = 88 + n * 55;
  return [k - l * 22, k + l * 8, k - l * 18 + 4];
}, 2);
const mossTex = paintTexture(256, (u, v) => {
  const n = pnoise(u, v, 5) * 0.6 + pnoise(u, v, 22, 2) * 0.4;
  return [30 + n * 25, 64 + n * 45, 28 + n * 18];
}, 4);
const woodTex = paintTexture(128, (u, v) => {
  const g = Math.sin(u * 40 + pnoise(u, v, 3) * 6) * 0.5 + 0.5;
  const k = 58 + g * 28;
  return [k, k * 0.72, k * 0.5];
});

/** Gravier ratissé en cercles concentriques (parvis du hub). */
export const gravelTex = (() => {
  const [c, ctx] = makeCanvas(512, 512);
  const r = rng(31);
  ctx.fillStyle = '#b1ab9d';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(r() * 512, r() * 512, 2, 2);
  }
  for (let k = 34; k < 256; k += 9) {
    ctx.strokeStyle = 'rgba(55,50,44,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(256, 256, k, 0, 6.283);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,236,0.35)';
    ctx.beginPath();
    ctx.arc(256, 256, k + 3, 0, 6.283);
    ctx.stroke();
  }
  return canvasTex(c);
})();

export const tatamiTex = (() => {
  const [c, ctx] = makeCanvas(256, 256);
  const r = rng(12);
  ctx.fillStyle = '#8c8650';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = `rgba(40,36,10,${0.1 + r() * 0.2})`;
    ctx.fillRect(0, y, 256, 1);
  }
  ctx.fillStyle = '#23263a';
  ctx.fillRect(0, 0, 14, 256);
  ctx.fillRect(242, 0, 14, 256);
  return canvasTex(c);
})();

const shojiTex = (() => {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = '#ffd9a0';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#3a2010';
  for (let k = 0; k <= 4; k++) {
    ctx.fillRect(k * 15.5, 0, 3, 64);
    ctx.fillRect(0, k * 15.5, 64, 3);
  }
  return canvasTex(c);
})();

export const MAT = {
  stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92 }),
  roofStone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92, side: THREE.DoubleSide }),
  moss: new THREE.MeshStandardMaterial({ map: mossTex, roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 }),
  vermilion: new THREE.MeshStandardMaterial({ color: 0xc23a22, roughness: 0.5, emissive: 0x2a0602 }),
  lacquer: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.7, side: THREE.DoubleSide }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.85, roughness: 0.35 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x2a1e18, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true, emissive: 0x100606 }),
  gravel: new THREE.MeshStandardMaterial({ map: gravelTex, bumpMap: gravelTex, bumpScale: 1.5, roughness: 1 }),
  tatami: new THREE.MeshStandardMaterial({ map: tatamiTex, roughness: 0.9 }),
  shoji: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb060, emissiveMap: shojiTex, emissiveIntensity: 1.3 }),
  robe: new THREE.MeshStandardMaterial({ color: 0x262c44, roughness: 0.9 }),
  kesa: new THREE.MeshStandardMaterial({ color: 0xc77a22, roughness: 0.8 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xc9986b, roughness: 0.7 }),
  zabuton: new THREE.MeshStandardMaterial({ color: 0x4a2346, roughness: 1 }),
};

// ---------- Géométries partagées ----------
/** Rochers : icosaèdres déformés par le bruit. */
export const rockGeos = [0, 1, 2].map((s) => {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + fbm(v.x * 1.3 + s * 5, v.y * 1.3, v.z * 1.3, 3) * 0.5);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
});
export const leafGeo = new THREE.IcosahedronGeometry(1, 1);

/** Toit japonais : cône polygonal concave, coins relevés. */
export function roofGeo(R: number, h: number, sides: number, rot = 0, lift = 0.3) {
  const geo = new THREE.ConeGeometry(R, h, sides * 8, 6, true);
  const p = geo.attributes.position;
  const seg = (Math.PI * 2) / sides;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const s = r / R;
    const phi = Math.atan2(z, x);
    const d = ((((phi - rot) % seg) + seg) % seg) - seg / 2;
    const c = Math.abs(d) / (seg / 2);
    const pr = (s * R * Math.cos(seg / 2)) / Math.cos(d);
    p.setXYZ(i, Math.cos(phi) * pr, h / 2 - h * (1 - (1 - s) ** 2) + lift * h * c ** 4 * s ** 3, Math.sin(phi) * pr);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Poutre dont les extrémités se relèvent (kasagi du torii). */
export function bentBox(w: number, h: number, d: number, curve: number) {
  const geo = new THREE.BoxGeometry(w, h, d, 32, 1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + curve * (p.getX(i) / (w / 2)) ** 2);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Lumière ----------
function spriteTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const [c, ctx] = makeCanvas(w, h);
  draw(ctx);
  return new THREE.CanvasTexture(c);
}

export const flameTex = spriteTex(64, 128, (ctx) => {
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

export const glowTex = spriteTex(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});

/** Normales d'eau périodiques, faites de vagues sinusoïdales (pas de fichier à télécharger). */
export const waterNormals = (() => {
  const N = 256;
  const [c, ctx] = makeCanvas(N, N);
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

/** Lune : direction de la lumière, et direction (plus basse) du disque, visible depuis la vue d'ensemble. */
export const MOON_LIGHT = new THREE.Vector3(-0.32, 0.4, -0.86).normalize();
export const MOON_DISC = new THREE.Vector3(-0.36, 0.17, -0.92).normalize();
