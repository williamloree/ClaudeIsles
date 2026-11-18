// Îlots prédéfinis sur le Styx : géométrie calculée une seule fois (graine fixe),
// puis chaque agent ou tâche reçoit simplement un emplacement libre.
import * as THREE from 'three';
import { fbm, rng } from './materials';

export type Vec3 = [number, number, number];

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

  const top = 1.9 + 0.17;
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

export interface Slot {
  pos: Vec3;
  template: IsletTemplate;
}

// 16 emplacements sur deux anneaux. Les ponts de l'anneau extérieur passent entre
// les îlots de l'anneau intérieur (décalage de 22,5°).
export const ISLAND_SLOTS: Slot[] = Array.from({ length: 16 }, (_, i) => {
  const inner = i < 8;
  const k = inner ? i : i - 8;
  const angle = (k / 8) * Math.PI * 2 + (inner ? Math.PI / 8 : 0);
  const radius = inner ? 36 : 56;
  return {
    pos: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as Vec3,
    template: buildIslet(5 + i * 2.7, 7),
  };
});

export const HUB_TEMPLATE = buildIslet(0.7, 17, false);
export const HUB_ISLET_R = 14.6; // bord du dallage du hub, départ des ponts

// Stèles des shells, entre les départs de ponts.
export const STELE_SLOTS: Vec3[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
  return [Math.cos(a) * 12.4, HUB_TEMPLATE.top, Math.sin(a) * 12.4];
});

// Lanternes des sessions Claude Code, flottant au-dessus du temple.
export const SESSION_SLOTS: Vec3[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  return [Math.cos(a) * 20, 16 + (i % 2) * 3, Math.sin(a) * 20];
});
