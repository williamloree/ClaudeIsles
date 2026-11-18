// Plateforme hexagonale sur pilotis : dalle de tôle mouillée, jupe sombre et liseré néon.
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ISLET_TOP } from '../../scene/slots';
import { MAT, hexCorner, neon } from './materials';

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

/** Six barres le long des arêtes d'un hexagone de rayon `r` (une seule géométrie). */
export function hexRimGeo(r: number, th = 0.12) {
  return cached(`rim|${r}|${th}`, () =>
    mergeGeometries(
      Array.from({ length: 6 }, (_, k) => {
        const [x0, z0] = hexCorner(r, k);
        const [x1, z1] = hexCorner(r, k + 1);
        return new THREE.BoxGeometry(r + th, th, th).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      }),
    ),
  );
}

const slabGeo = (r: number) => cached(`slab|${r}`, () => new THREE.CylinderGeometry(r, r, 1.2, 6));
const skirtGeo = (r: number) => cached(`skirt|${r}`, () => new THREE.CylinderGeometry(r * 0.96, r * 0.9, 1.4, 6));
// pilotis plantés dans l'eau, sous les sommets
const PILE_H = ISLET_TOP + 3;
const pilesGeo = (r: number) =>
  cached(`piles|${r}`, () =>
    mergeGeometries(
      Array.from({ length: 6 }, (_, k) => {
        const [x, z] = hexCorner(r * 0.82, k);
        return new THREE.CylinderGeometry(0.45, 0.55, PILE_H, 8).translate(x, ISLET_TOP - 1.2 - PILE_H / 2, z);
      }),
    ),
  );

export function HexRim({ r, y, material, th }: { r: number; y: number; material: THREE.Material; th?: number }) {
  return <mesh geometry={hexRimGeo(r, th)} position-y={y} material={material} />;
}

/** Sol praticable à ISLET_TOP. `rimMat` : liseré du haut (animé par l'appelant pour le statut). */
export function HexPlatform({ radius, rim, rimMat, children }: { radius: number; rim: string; rimMat?: THREE.Material; children?: ReactNode }) {
  return (
    <group>
      <mesh geometry={slabGeo(radius)} position-y={ISLET_TOP - 0.6} material={MAT.deck} receiveShadow />
      <mesh geometry={skirtGeo(radius)} position-y={ISLET_TOP - 1.9} material={MAT.dark} />
      <mesh geometry={pilesGeo(radius)} material={MAT.metal} />
      <HexRim r={radius + 0.04} y={ISLET_TOP + 0.02} material={rimMat ?? neon(rim, 2.4)} th={0.14} />
      <HexRim r={radius * 0.97} y={ISLET_TOP - 1.1} material={neon(rim, 1.2)} th={0.08} />
      {children}
    </group>
  );
}
