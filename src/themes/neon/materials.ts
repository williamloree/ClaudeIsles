// Textures procédurales (tôle mouillée, fenêtres, enseignes, halos) et matériaux partagés de la ville néon.
import * as THREE from 'three';
import { rng } from '../../scene/boats';

export { rng };

export const PINK = '#ff3cac';
export const CYAN = '#2de2e6';
export const HAZE = '#2a0c35';
/** Couleurs des enseignes. */
export const NEONS = ['#ff3cac', '#2de2e6', '#f9f871', '#ff6c11', '#9b5cff', '#3cff8f'];

/** Horloge partagée par tous les shaders (avancée une fois par image dans la scène). */
export const uTime = { value: 0 };

export const ORBITRON = "Orbitron, 'Segoe UI', sans-serif";
export const MONO = "'JetBrains Mono', Consolas, monospace";

export function drawTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Lignes de balayage d'un vieil écran. */
export function scanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
}

const r0 = rng(31);
const metalTex = drawTexture(256, 256, (ctx) => {
  ctx.fillStyle = '#0d0e18';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${r0() * 0.035})`;
    ctx.fillRect(r0() * 256, r0() * 256, 2, 2);
  }
  ctx.strokeStyle = 'rgba(80,110,170,0.35)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= 256; k += 32) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k, 256);
    ctx.moveTo(0, k);
    ctx.lineTo(256, k);
    ctx.stroke();
  }
});
metalTex.wrapS = metalTex.wrapT = THREE.RepeatWrapping;
metalTex.repeat.set(4, 4);

export const MAT = {
  /** pont mouillé : il reflète les néons */
  // (pas de carte d'environnement : un métal trop pur paraîtrait noir)
  deck: new THREE.MeshStandardMaterial({ map: metalTex, color: 0xc4c8e8, metalness: 0.45, roughness: 0.32, emissive: 0x0a0618 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x22242f, metalness: 0.8, roughness: 0.4 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0c0d14, metalness: 0.6, roughness: 0.5 }),
};

export const glowTex = drawTexture(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});
glowTex.colorSpace = THREE.NoColorSpace;

export const mistTex = drawTexture(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
});
mistTex.colorSpace = THREE.NoColorSpace;

/** Halo additif (sprite). Le matériau est neuf : à libérer par l'appelant s'il est créé dans un useMemo. */
export const glowMaterial = (color: THREE.ColorRepresentation, opacity = 1) =>
  new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity });

const neonCache = new Map<string, THREE.MeshBasicMaterial>();
/** Tube néon partagé (couleur > 1 : c'est lui que le bloom attrape). */
export function neon(color: THREE.ColorRepresentation, k = 2.2) {
  const key = `${new THREE.Color(color).getHexString()}|${k}`;
  let m = neonCache.get(key);
  if (!m) neonCache.set(key, (m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) })));
  return m;
}

const beamCache = new Map<string, THREE.ShaderMaterial>();
/** Faisceau lumineux : cône additif qui s'estompe vers le haut (uv.y). */
export function beamMat(color: string, alpha = 0.5) {
  const key = `${color}|${alpha}`;
  let m = beamCache.get(key);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, k: { value: alpha } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float k; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(1.0 - vUv.y, 2.0) * f * f * k; gl_FragColor = vec4(color * a, a); }`,
  });
  beamCache.set(key, m);
  return m;
}

const holoCache = new Map<string, THREE.ShaderMaterial>();
/** Hologramme : franges (Fresnel), lignes de balayage, bande qui monte et, en cas d'échec, glitch. */
export function holoMat(color: string, glitch = 0, strength = 1) {
  const key = `${color}|${glitch}|${strength}`;
  let m = holoCache.get(key);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, time: uTime, glitch: { value: glitch }, strength: { value: strength } },
    vertexShader: `uniform float time; uniform float glitch; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
        float g = step(0.93, fract(sin(floor(w.y * 8.0) + floor(time * 12.0)) * 43758.5453)); w.x += g * glitch * 0.18;
        vY = w.y; vec4 mv = viewMatrix * w; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float time; uniform float glitch; uniform float strength; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5); float scan = 0.65 + 0.35 * sin(vY * 60.0 - time * 8.0);
        float b = fract(vY * 0.4 - time * 0.5); float band = smoothstep(0.0, 0.05, b) * (1.0 - smoothstep(0.05, 0.12, b));
        float fl = 1.0 - glitch * 0.6 * step(0.7, fract(sin(floor(time * 15.0)) * 43758.5453));
        float a = ((0.15 + f * 0.9) * scan + band * 0.6) * fl * strength; gl_FragColor = vec4(color * a * 1.6, a); }`,
  });
  holoCache.set(key, m);
  return m;
}

/** Impulsions qui filent le long d'une passerelle (uv.x de départ → arrivée). Neuf : à libérer. */
export function flowMat(color: string, len: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(color) }, time: uTime, len: { value: len }, speed: { value: 0.9 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 color; uniform float time; uniform float len; uniform float speed; varying vec2 vUv;
      void main(){ float d = fract(vUv.x * len / 5.0 - time * speed); float a = pow(d, 8.0) * 1.6 + 0.12; float e = 1.0 - abs(vUv.y - 0.5) * 2.0;
        gl_FragColor = vec4(color * a * e * 2.0, a * e); }`,
  });
}

// ---------- Enseignes ----------
const signCache = new Map<string, THREE.CanvasTexture>();
/** Enseigne néon dessinée sur canvas (mise en cache : le même mot dans la même couleur sert partout). */
export function signTexture(text: string, color: string, vertical = false) {
  const key = `${text}|${color}|${vertical}`;
  let t = signCache.get(key);
  if (t) return t;
  const w = vertical ? 128 : 512;
  const h = vertical ? 512 : 128;
  t = drawTexture(w, h, (ctx) => {
    ctx.fillStyle = '#07030a';
    ctx.fillRect(0, 0, w, h);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const draw = (s: string, x: number, y: number, size: number) => {
      ctx.font = `700 ${size}px ${ORBITRON}`;
      ctx.shadowBlur = 26;
      ctx.fillStyle = color;
      ctx.fillText(s, x, y);
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.75;
      ctx.fillText(s, x, y);
      ctx.globalAlpha = 1;
    };
    if (vertical) {
      const L = [...text].slice(0, 6);
      L.forEach((ch, i) => draw(ch, 64, 256 + (i - (L.length - 1) / 2) * 74, 64));
    } else draw(text, 256, 68, text.length > 7 ? 46 : 62);
  });
  signCache.set(key, t);
  return t;
}

/** Les textures dessinées avant le chargement d'Orbitron sont refaites une fois la police prête. */
export function clearSignCache() {
  signCache.forEach((t) => t.dispose());
  signCache.clear();
}

// ---------- Hexagones ----------
/** Sommet `k` d'un hexagone de rayon `r` (alignés sur ceux de CylinderGeometry(…, 6)). */
export function hexCorner(r: number, k: number): [number, number] {
  const a = Math.PI / 6 + (k * Math.PI) / 3;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

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
