// Icebergs tabulaires (floes des agents et grand iceberg du hub) : géométrie calculée une seule fois
// par emplacement, à graine fixe. Flancs bleu profond sous l'eau, pâles puis blancs vers le plateau.
import * as THREE from 'three';
import { HUB_RADIUS, ISLAND_SLOTS, ISLET_TOP, type Vec3 } from '../../scene/slots';
import { fbm, noise, rng } from './materials';

export function bergGeometry(radius: number, seed: number, h = 6, segs = 40) {
  const hs = 6;
  const geo = new THREE.CylinderGeometry(radius, radius * 1.22, h, segs, hs);
  const p = geo.attributes.position;
  const nT = (segs + 1) * (hs + 1); // sommets du flanc ; au-delà : les deux couvercles
  const deep = new THREE.Color(0x1d6c9a);
  const pale = new THREE.Color(0xb7e2f4);
  const white = new THREE.Color(0xf2f8ff);
  const c = new THREE.Color();
  const cols: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const edge = y > h / 2 - 0.01;
    let k = 1 + fbm(Math.cos(a) * 1.7 + seed, y * 0.16, Math.sin(a) * 1.7, 4) * 0.42;
    if (!edge) k += noise.noise(x * 0.7, y * 0.9 + seed, z * 0.7) * 0.08;
    p.setX(i, x * k);
    p.setZ(i, z * k);
    if (i >= nT) c.copy(y > 0 ? white : deep);
    else if (edge) c.copy(white);
    else {
      const t = (y + h / 2) / h;
      c.copy(deep).lerp(pale, Math.pow(t, 0.7));
      // strates de glace bleue dans les flancs
      c.lerp(deep, Math.max(0, Math.sin(y * 2.6 + fbm(a, seed, 0) * 3)) * 0.2);
    }
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  // plateau à ISLET_TOP : les étiquettes et le vol de caméra tombent juste
  geo.translate(0, ISLET_TOP - h / 2, 0);
  return geo;
}

export type Decor = { type: 'tent' | 'shard' | 'mound'; pos: Vec3; angle: number; s: number; rot: number };

export interface FloeTemplate {
  geo: THREE.BufferGeometry;
  decor: Decor[];
}

const BERG_R = 6.3;

function buildFloe(seed: number): FloeTemplate {
  const r = rng(Math.round(seed * 1000));
  const spot = (lo: number, hi: number): [Vec3, number] => {
    const a = r() * Math.PI * 2;
    const d = lo + r() * (hi - lo);
    return [[Math.cos(a) * d, ISLET_TOP, Math.sin(a) * d], a];
  };
  const decor: Decor[] = [];
  {
    const [pos, angle] = spot(3.6, 4.2);
    decor.push({ type: 'tent', pos, angle, s: 1, rot: r() * 3 });
  }
  for (let k = 0; k < 3; k++) {
    const [pos, angle] = spot(3.5, 5);
    decor.push({ type: 'shard', pos, angle, s: 0.7 + r() * 0.6, rot: r() * 6 });
  }
  for (let k = 0; k < 4; k++) {
    const [pos, angle] = spot(2.8, 5.3);
    decor.push({ type: 'mound', pos, angle, s: 0.5 + r() * 0.5, rot: 0.3 + r() * 0.2 });
  }
  return { geo: bergGeometry(BERG_R, seed, 6), decor };
}

/** Floe de chaque emplacement (même ordre que `ISLAND_SLOTS`). */
export const FLOES: FloeTemplate[] = ISLAND_SLOTS.map((_, i) => buildFloe(5 + i * 2.7));

export const HUB_GEO = bergGeometry(HUB_RADIUS, 0.7, 10, 56);
