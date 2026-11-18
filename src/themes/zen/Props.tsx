// Éléments du jardin réutilisés partout : flamme, tōrō (lanterne de pierre), rochers, torii, arbres.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAT, bentBox, flameTex, leafGeo, rng, rockGeos, roofGeo } from './materials';

// ---------- Flamme ----------
/** Flamme en sprites additifs (le bloom fait le halo) ; `light` ajoute une vraie lumière qui vacille. */
export function Flame({ color, scale = 1, light = 0, distance = 16 }: { color: string; scale?: number; light?: number; distance?: number }) {
  const group = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const mats = useMemo(
    () =>
      [0, 1, 2, 3].map(
        (i) =>
          new THREE.SpriteMaterial({
            map: flameTex,
            color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), i === 3 ? 0.6 : 0),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
          }),
      ),
    [color],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const seed = useMemo(() => Math.random() * 100, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    group.current?.children.forEach((s, i) => {
      if (!(s as THREE.Sprite).isSprite) return;
      const base = scale * (i === 3 ? 0.55 : 1 - i * 0.12);
      const k = base * (0.85 + Math.sin(t * 9 + i * 1.7) * 0.1 + Math.sin(t * 23 + i) * 0.05);
      s.scale.set(k * 0.8, k * 1.6, 1);
    });
    if (lamp.current) lamp.current.intensity = light * (0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 27) * 0.05);
  });
  return (
    <group ref={group}>
      {mats.map((m, i) => (
        <sprite key={i} material={m} position={[0, 0.5 * scale, 0]} />
      ))}
      {light > 0 && <pointLight ref={lamp} color={color} intensity={light} distance={distance} decay={1.6} position={[0, 0.8 * scale, 0]} />}
    </group>
  );
}

// ---------- Tōrō ----------
// Géométries à l'échelle 1, partagées par toutes les lanternes de pierre.
const TORO = {
  foot: new THREE.CylinderGeometry(0.5, 0.6, 0.2, 6),
  base: new THREE.CylinderGeometry(0.3, 0.48, 0.16, 6),
  shaft: new THREE.CylinderGeometry(0.14, 0.17, 1.0, 16),
  cradle: new THREE.CylinderGeometry(0.46, 0.3, 0.22, 6),
  post: new THREE.BoxGeometry(0.07, 0.55, 0.07),
  lid: new THREE.CylinderGeometry(0.36, 0.36, 0.06, 6),
  roof: roofGeo(0.78, 0.5, 6, Math.PI / 6, 0.5),
  neck: new THREE.CylinderGeometry(0.09, 0.13, 0.1, 12),
  jewel: new THREE.SphereGeometry(0.11, 14, 10),
  tip: new THREE.ConeGeometry(0.07, 0.14, 12),
};
const TORO_POSTS = Array.from({ length: 6 }, (_, k) => {
  const a = (k * Math.PI) / 3 + Math.PI / 6;
  return [Math.cos(a) * 0.29, 1.855, Math.sin(a) * 0.29] as [number, number, number];
});

/** Lanterne de pierre (kasuga-dōrō) ; sa flamme a la couleur donnée. */
export function Toro({ scale = 1, color, light = 0, flame = 1 }: { scale?: number; color: string; light?: number; flame?: number }) {
  return (
    <group>
      <group scale={scale}>
        <mesh geometry={TORO.foot} material={MAT.stone} position-y={0.1} castShadow receiveShadow />
        <mesh geometry={TORO.base} material={MAT.stone} position-y={0.28} castShadow />
        <mesh geometry={TORO.shaft} material={MAT.stone} position-y={0.86} castShadow />
        <mesh geometry={TORO.cradle} material={MAT.stone} position-y={1.47} castShadow receiveShadow />
        {TORO_POSTS.map((p, i) => (
          <mesh key={i} geometry={TORO.post} material={MAT.stone} position={p} castShadow />
        ))}
        <mesh geometry={TORO.lid} material={MAT.stone} position-y={2.14} castShadow />
        <mesh geometry={TORO.roof} material={MAT.roofStone} position-y={2.4} castShadow receiveShadow />
        <mesh geometry={TORO.neck} material={MAT.stone} position-y={2.68} />
        <mesh geometry={TORO.jewel} material={MAT.stone} position-y={2.8} />
        <mesh geometry={TORO.tip} material={MAT.stone} position-y={2.94} />
      </group>
      <group position-y={1.6 * scale}>
        <Flame color={color} scale={0.36 * scale * flame} />
      </group>
      {light > 0 && <LanternLight color={color} intensity={light} distance={16 * scale} y={1.9 * scale} />}
    </group>
  );
}

function LanternLight({ color, intensity, distance, y }: { color: string; intensity: number; distance: number; y: number }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (ref.current) ref.current.intensity = ref.current.intensity * 0.8 + intensity * (0.8 + Math.random() * 0.4) * 0.2;
  });
  return <pointLight ref={ref} color={color} intensity={intensity} distance={distance} decay={1.6} position-y={y} />;
}

// ---------- Rochers ----------
export function Rock({ size, flat = 0.65, seed = 0, position }: { size: number; flat?: number; seed?: number; position: [number, number, number] }) {
  const r = rng(seed * 13 + 5);
  const geo = rockGeos[seed % 3];
  return <mesh geometry={geo} material={MAT.stone} position={position} scale={[size * (0.8 + r() * 0.5), size * flat, size * (0.8 + r() * 0.5)]} rotation-y={r() * 6.3} castShadow receiveShadow />;
}

// ---------- Torii ----------
const TORII = {
  pillar: new THREE.CylinderGeometry(0.4, 0.48, 9, 20),
  foot: new THREE.CylinderGeometry(0.56, 0.56, 1, 20),
  nuki: new THREE.BoxGeometry(9.4, 0.5, 0.38),
  strut: new THREE.BoxGeometry(0.55, 1.2, 0.32),
  shimaki: bentBox(11.6, 0.5, 0.7, 0.45),
  kasagi: bentBox(12.6, 0.42, 0.85, 0.6),
};

export function Torii({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      {[-3.4, 3.4].map((x) => (
        <group key={x} position-x={x}>
          <mesh geometry={TORII.pillar} material={MAT.vermilion} position-y={4.5} castShadow />
          <mesh geometry={TORII.foot} material={MAT.lacquer} position-y={0.2} castShadow />
        </group>
      ))}
      <mesh geometry={TORII.nuki} material={MAT.vermilion} position-y={7.1} castShadow />
      <mesh geometry={TORII.strut} material={MAT.vermilion} position-y={7.9} castShadow />
      <mesh geometry={TORII.shimaki} material={MAT.vermilion} position-y={8.65} castShadow />
      <mesh geometry={TORII.kasagi} material={MAT.lacquer} position-y={9.1} castShadow />
    </group>
  );
}

// ---------- Arbres : érables, cerisiers, pins taillés ----------
export type TreeKind = 'maple' | 'sakura' | 'pine';
const KINDS: Record<TreeKind, { cols: number[]; petal: number | null; flat: number }> = {
  maple: { cols: [0xa8231a, 0xc2381c, 0x8a1c16, 0xd2571f], petal: 0xc4401f, flat: 0.7 },
  sakura: { cols: [0xf2b8c6, 0xe7a0b5, 0xf8d3dc], petal: 0xf6c6d3, flat: 0.75 },
  pine: { cols: [0x1d3a24, 0x23452a, 0x183020], petal: null, flat: 0.38 },
};

/** Forme d'un arbre, déterministe : la même graine donne le même arbre (et les mêmes points de couronne). */
export function treeShape(h: number, kind: TreeKind, seed: number) {
  const r = rng(seed);
  const rnd = (a: number, b: number) => a + r() * (b - a);
  const K = KINDS[kind];
  const V = THREE.Vector3;
  const lean = rnd(-0.25, 0.25);
  const curve = new THREE.CatmullRomCurve3([new V(0, -0.3, 0), new V(lean * h * 0.3, h * 0.35, 0), new V(lean * h * 0.55, h * 0.62, lean * h * 0.2), new V(lean * h * 0.35, h * 0.86, 0)]);
  const tubes: THREE.BufferGeometry[] = [new THREE.TubeGeometry(curve, 16, h * 0.04, 7)];
  const crown = [curve.getPoint(1).add(new V(0, h * 0.06, 0))];
  const nb = kind === 'pine' ? 4 : 5;
  for (let b = 0; b < nb; b++) {
    const a = b * (6.283 / nb) + rnd(0, 0.6);
    const s = curve.getPoint(rnd(0.45, 0.85));
    const sp = kind === 'pine' ? 0.45 : 0.35;
    const e = s.clone().add(new V(Math.cos(a) * h * rnd(0.22, sp), h * rnd(0.04, 0.18), Math.sin(a) * h * rnd(0.22, sp)));
    tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([s, s.clone().lerp(e, 0.5).add(new V(0, h * 0.06, 0)), e]), 6, h * 0.018, 5));
    crown.push(e);
  }
  const per = 7;
  const leaves: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const o = new THREE.Object3D();
  for (const c of crown)
    for (let k = 0; k < per; k++) {
      const s = h * rnd(0.07, 0.13) * (kind === 'pine' ? 1.3 : 1);
      o.position.copy(c).add(new V(rnd(-1, 1) * h * 0.13, rnd(-0.4, 0.8) * h * 0.06, rnd(-1, 1) * h * 0.13));
      o.scale.set(s, s * K.flat, s);
      o.rotation.set(0, rnd(0, 6), 0);
      o.updateMatrix();
      leaves.push({ m: o.matrix.clone(), c: new THREE.Color(K.cols[Math.floor(r() * K.cols.length)]) });
    }
  return { tubes, crown, leaves, petal: K.petal };
}

export function Tree({ h, kind, seed }: { h: number; kind: TreeKind; seed: number }) {
  const { trunk, leaves } = useMemo(() => {
    const shape = treeShape(h, kind, seed);
    const trunk = mergeGeometries(shape.tubes)!;
    shape.tubes.forEach((g) => g.dispose());
    const leaves = new THREE.InstancedMesh(leafGeo, MAT.leaf, shape.leaves.length);
    shape.leaves.forEach((l, i) => {
      leaves.setMatrixAt(i, l.m);
      leaves.setColorAt(i, l.c);
    });
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    return { trunk, leaves };
  }, [h, kind, seed]);
  useEffect(
    () => () => {
      trunk.dispose();
      leaves.dispose();
    },
    [trunk, leaves],
  );
  return (
    <group>
      <mesh geometry={trunk} material={MAT.bark} castShadow receiveShadow />
      <primitive object={leaves} />
    </group>
  );
}
