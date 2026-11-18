// Îlots de basalte du Styx, un par emplacement : géométrie calculée une seule fois (graine fixe).
import * as THREE from 'three';
import { HUB_RADIUS, ISLAND_SLOTS, ISLET_RADIUS, ISLET_TOP, type Vec3 } from '../../scene/slots';
import { fbm, rng } from './materials';

export type Decor =
  | { type: 'column'; pos: Vec3; angle: number; h: number }
  | { type: 'fallen'; pos: Vec3; angle: number }
  | { type: 'cypress'; pos: Vec3; angle: number; h: number }
  | { type: 'urn'; pos: Vec3; angle: number; s: number };

export interface IsletTemplate {
  radius: number;
  /** hauteur du dallage au-dessus de l'eau */
  top: number;
  rock: THREE.BufferGeometry;
  flowers: Float32Array;
  decor: Decor[];
}

export function buildIslet(seed: number, radius: number, withDecor = true): IsletTemplate {
  const r = rng(seed);
  const rock = new THREE.CylinderGeometry(radius, radius * 1.35, 9, 72, 8, false);
  const p = rock.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const y = p.getY(i);
    const k = 1 + fbm(Math.cos(a) * 2 + seed, y * 0.25, Math.sin(a) * 2, 5) * 0.35 * (y < 4.4 ? 1 : 0.25);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  rock.computeVertexNormals();
  rock.translate(0, -2.6, 0);

  const top = ISLET_TOP;
  // asphodèles, les fleurs pâles des Enfers, au bord de l'îlot
  const flowers = new Float32Array(70 * 3);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2;
    const d = radius * (0.85 + r() * 0.25);
    flowers.set([Math.cos(a) * d, 1.8 + r() * 0.4, Math.sin(a) * d], i * 3);
  }

  const decor: Decor[] = [];
  if (withDecor) {
    const spot = (lo = 0.55, hi = 0.75): [Vec3, number] => {
      const a = r() * Math.PI * 2;
      const d = radius * (lo + r() * (hi - lo));
      return [[Math.cos(a) * d, top, Math.sin(a) * d], a];
    };
    for (let i = 0; i < 2; i++) {
      const [pos, angle] = spot();
      decor.push({ type: 'column', pos, angle, h: 2.5 + r() * 2.5 });
    }
    {
      const [pos, angle] = spot();
      decor.push({ type: 'fallen', pos, angle });
    }
    for (let i = 0; i < 2; i++) {
      const [pos, angle] = spot(0.66, 0.8);
      decor.push({ type: 'cypress', pos, angle, h: 4 + r() * 3 });
    }
    {
      const [pos, angle] = spot(0.45, 0.6);
      decor.push({ type: 'urn', pos, angle, s: 0.7 + r() * 0.4 });
    }
  }
  return { radius, top, rock, flowers, decor };
}

/** Îlot de chaque emplacement (même ordre que `ISLAND_SLOTS`). */
export const ISLET_TEMPLATES: IsletTemplate[] = ISLAND_SLOTS.map((_, i) => buildIslet(5 + i * 2.7, ISLET_RADIUS));

export const HUB_TEMPLATE = buildIslet(0.7, HUB_RADIUS, false);
