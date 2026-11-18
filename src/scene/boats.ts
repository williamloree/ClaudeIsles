// Anciens agents et anciennes tâches qui dérivent autour du monde (barques, dirigeables, drones…
// selon le thème). Les trajectoires sont communes : la caméra sait où les suivre.
import * as THREE from 'three';
import type { Status } from '../types';

export interface Boat {
  key: string; // `agent:<id>` ou `task:<id>`, ou `ambient:<n>` (figurant sans agent connu)
  title: string;
  status: Status;
  endedAt: number | null;
  subtitle: string;
}

/** Générateur pseudo-aléatoire à graine : les décors sont identiques d'un chargement à l'autre. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Lane {
  r: number;
  w: number;
  phase: number;
  wobble: number;
}

/** Voie stable d'une barque : dépend de son identifiant, pas de sa place dans la liste. */
export function laneIndex(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 997;
}

export function laneFor(i: number): Lane {
  const r = rng(1000 + i * 77);
  const dir = i % 3 === 1 ? -1 : 1;
  // au-delà de l'anneau extérieur d'îlots (56 + 9,5) ; vitesse lente de promenade
  return { r: 68 + (i % 4) * 4.5 + r() * 2, w: dir * (0.012 + r() * 0.01), phase: i * 2.399, wobble: 1.5 + r() * 2 };
}

/** Position sur la voie à l'instant `t` (y = 0 : à chaque thème de choisir l'altitude). */
export function lanePoint(l: Lane, t: number, out = new THREE.Vector3()) {
  const a = l.phase + t * l.w;
  const r = l.r + Math.sin(t * 0.07 + l.phase) * l.wobble;
  return out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
}

/**
 * Position courante des barques (elles bougent) : la caméra s'en sert pour y voler et les suivre.
 * Chaque thème doit la tenir à jour, une fois par image, pour chaque barque affichée.
 */
export const livePositions = new Map<string, THREE.Vector3>();

export function setLivePosition(key: string, x: number, y: number, z: number) {
  let v = livePositions.get(key);
  if (!v) livePositions.set(key, (v = new THREE.Vector3()));
  v.set(x, y, z);
}
