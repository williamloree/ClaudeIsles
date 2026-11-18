// Îles flottantes : dessus herbeux bombé, dessous rocheux déchiqueté qui plonge vers les nuages,
// herbe en touffes, sapins et rochers. Une île par emplacement, calculée à la demande (graine fixe).
import * as THREE from 'three';
import { HUB_RADIUS, ISLAND_SLOTS, ISLET_RADIUS, ISLET_TOP, STELE_SLOTS, type Vec3 } from '../../scene/slots';
import { fbm, rng } from './materials';

export interface Tree {
  pos: Vec3;
  h: number;
  shade: number;
  rot: number;
}

export interface IslandTemplate {
  radius: number;
  /** Altitude du sol (repère de l'île) : vaut ISLET_TOP au centre. */
  height: (x: number, z: number) => number;
  top: THREE.BufferGeometry;
  under: THREE.BufferGeometry;
  /** Matrices et couleurs des brins d'herbe. */
  blades: { matrices: Float32Array; colors: Float32Array; count: number };
  trees: Tree[];
  rocks: { pos: Vec3; geo: THREE.BufferGeometry; rot: number }[];
}

const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

interface Options {
  /** Rayon dégagé au centre (bureau, place). */
  keepClear: number;
  trees: number;
  /** Rayon des arbres : [min, max] en fraction du rayon. */
  treeRing: [number, number];
  /** Directions (angles) à laisser libres : arrivée du pont, écrans… */
  avoid: (a: number, d: number) => boolean;
  /** Arbres placés à la main (hub). */
  extraTrees?: { a: number; d: number }[];
  /** Bombé du dessus. */
  dome: number;
}

function build(seed: number, radius: number, o: Options): IslandTemplate {
  const r = rng(Math.round(seed * 1000));
  const rim = (a: number) => 1 + 0.09 * fbm(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3, seed);
  // sol presque plat au centre (là où l'on pose les choses), qui s'arrondit vers le bord
  const height = (x: number, z: number) => {
    const d = Math.min(1.1, Math.hypot(x, z) / radius);
    return ISLET_TOP - o.dome * Math.pow(d, 5) + fbm(x * 0.12 + seed, z * 0.12, 3.1) * 0.6 * d * d;
  };

  // Dessus herbeux
  const top = new THREE.SphereGeometry(1, 96, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = top.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = radius * rim(a);
    const x = p.getX(i) * k;
    const z = p.getZ(i) * k;
    p.setXYZ(i, x, height(x, z), z);
  }
  top.computeVertexNormals();

  // Dessous rocheux, déchiqueté, qui s'effile en pointe
  const depth = radius * (1.5 + r() * 0.5);
  const under = new THREE.CylinderGeometry(1, 1, 1, 96, 36, true);
  const q = under.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const t = 0.5 - q.getY(i); // 0 en haut, 1 à la pointe
    const a = Math.atan2(q.getZ(i), q.getX(i));
    const taper = Math.pow(1 - t, 0.75);
    const n = fbm(Math.cos(a) * 2 + seed, Math.sin(a) * 2, t * 4, 5);
    const rad = radius * rim(a) * taper * (1 + (t > 0.02 ? n * 0.45 : 0));
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const rimY = height(Math.cos(a) * radius * rim(a), Math.sin(a) * radius * rim(a));
    q.setXYZ(i, x, rimY - t * depth * (1 + n * 0.15) + (t < 0.02 ? 0 : -0.2), z);
  }
  under.computeVertexNormals();

  // Herbe en touffes
  const want = Math.round(radius * radius * 22);
  const mats: number[] = [];
  const cols: number[] = [];
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const col = new THREE.Color();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < want; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * radius * 0.92;
    if (d < o.keepClear) continue;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    m4.compose(v.set(x, height(x, z), z), quat.setFromEuler(euler.set((r() - 0.5) * 0.5, r() * Math.PI, 0)), s.set(1, 0.6 + r() * 0.9, 1));
    mats.push(...m4.elements);
    col.setHSL(0.24 + r() * 0.05, 0.5, 0.25 + r() * 0.15);
    cols.push(col.r, col.g, col.b);
  }

  // Sapins et rochers, hors des passages
  const spot = (lo: number, hi: number): [number, number] => {
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2;
      const d = radius * (lo + r() * (hi - lo));
      if (!o.avoid(a, d)) return [a, d];
    }
    return [0, -1];
  };
  const trees: Tree[] = [];
  const addTree = (a: number, d: number) => {
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    trees.push({ pos: [x, height(x, z) - 0.05, z], h: 3 + r() * 3, shade: Math.floor(r() * 3), rot: r() * Math.PI });
  };
  for (let i = 0; i < o.trees; i++) {
    const [a, d] = spot(...o.treeRing);
    if (d > 0) addTree(a, d);
  }
  o.extraTrees?.forEach((t) => addTree(t.a, t.d));
  const rocks: IslandTemplate['rocks'] = [];
  for (let i = 0; i < 3; i++) {
    const [a, d] = spot(o.treeRing[0], 0.85);
    if (d < 0) continue;
    const geo = new THREE.DodecahedronGeometry(0.5 + r() * 0.7, 1);
    const rp = geo.attributes.position;
    for (let j = 0; j < rp.count; j++) rp.setXYZ(j, rp.getX(j) * (1 + fbm(rp.getX(j), rp.getY(j), rp.getZ(j)) * 0.5), rp.getY(j) * 0.7, rp.getZ(j));
    geo.computeVertexNormals();
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    rocks.push({ pos: [x, height(x, z), z], geo, rot: r() * Math.PI });
  }

  return {
    radius,
    height,
    top,
    under,
    blades: { matrices: new Float32Array(mats), colors: new Float32Array(cols), count: cols.length / 3 },
    trees,
    rocks,
  };
}

const cache = new Map<number, IslandTemplate>();

/** Île d'un emplacement (même ordre que `ISLAND_SLOTS`) ; -1 = le hub. */
export function islandTemplate(slot: number): IslandTemplate {
  let t = cache.get(slot);
  if (t) return t;
  if (slot < 0) {
    // Hub : la place au centre, les écrans des shells et les départs de ponts restent dégagés.
    const steleAngles = STELE_SLOTS.map((p) => Math.atan2(p[2], p[0]));
    t = build(1.7, HUB_RADIUS, {
      keepClear: 8.6,
      trees: 6,
      treeRing: [0.55, 0.66],
      dome: 0.9,
      avoid: (a) => steleAngles.some((s) => angDist(a, s) < 0.3),
      // un sapin entre deux départs de pont sur deux (l'autre intervalle porte un écran)
      extraTrees: Array.from({ length: 8 }, (_, k) => ({ a: (3 * Math.PI) / 16 + (k * Math.PI) / 4, d: 15.4 })),
    });
  } else {
    const pos = ISLAND_SLOTS[slot];
    const toHub = Math.atan2(-pos[2], -pos[0]);
    t = build(10 + slot * 3.3, ISLET_RADIUS, {
      keepClear: 3.4,
      trees: 3,
      treeRing: [0.6, 0.78],
      dome: 0.9,
      // pas d'arbre devant le pont, ni sur la balise (côté droit du bureau)
      avoid: (a) => angDist(a, toHub) < 0.75,
    });
  }
  cache.set(slot, t);
  return t;
}

/** Altitude du sol en un point du monde, sur l'île d'un emplacement (-1 = hub). */
export function groundAt(slot: number, x: number, z: number) {
  const c = slot < 0 ? [0, 0, 0] : ISLAND_SLOTS[slot];
  return islandTemplate(slot).height(x - c[0], z - c[2]);
}
