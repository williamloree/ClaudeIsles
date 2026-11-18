// Ponts de cordes suspendus entre l'île centrale et chaque île occupée : planches, mains courantes,
// suspentes, poteaux. Une lanterne à l'arrivée donne le statut de loin.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR } from '../../format';
import type { Bridge } from '../../scene/layout';
import { groundAt } from './islands';
import { MAT, bulbMaterial, glowMaterial, rng } from './materials';

const plankGeo = new THREE.BoxGeometry(1.9, 0.06, 0.32);
const hangGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 4);
const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.5, 8);
const HALF = 0.95; // demi-largeur du tablier

function Instances({ geo, mat, matrices, shadow }: { geo: THREE.BufferGeometry; mat: THREE.Material; matrices: THREE.Matrix4[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    matrices.forEach((x, i) => m.setMatrixAt(i, x));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh key={matrices.length} ref={ref} args={[geo, mat, matrices.length]} castShadow={shadow} receiveShadow={shadow} />;
}

function BridgeMesh({ bridge }: { bridge: Bridge }) {
  const running = bridge.status === 'running';
  const color = STATUS_COLOR[bridge.status];
  const parts = useMemo(() => {
    // les extrémités se posent sur l'herbe des deux îles
    const a = new THREE.Vector3(bridge.from[0], groundAt(-1, bridge.from[0], bridge.from[2]) + 0.05, bridge.from[2]);
    const b = new THREE.Vector3(bridge.to[0], groundAt(bridge.slot, bridge.to[0], bridge.to[2]) + 0.05, bridge.to[2]);
    const len = a.distanceTo(b);
    const sag = Math.min(2.5, len * 0.08);
    const at = (t: number) => a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(Math.PI * t) * sag, 0));
    const side = new THREE.Vector3().subVectors(b, a).setY(0).normalize().cross(new THREE.Vector3(0, 1, 0)).multiplyScalar(HALF);
    const r = rng(bridge.slot * 31 + 5);
    const o = new THREE.Object3D();
    const n = Math.round(len / 0.42);
    const planks = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      o.position.copy(at(t));
      o.lookAt(at(Math.min(1, t + 0.01)));
      o.rotateZ((r() - 0.5) * 0.06);
      o.updateMatrix();
      return o.matrix.clone();
    });
    const ropes = [1, -1].map(
      (s) =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(Array.from({ length: 30 }, (_, i) => at(i / 29).add(side.clone().multiplyScalar(s)).add(new THREE.Vector3(0, 1 + Math.sin((Math.PI * i) / 29) * 0.25, 0)))),
          60,
          0.04,
          6,
        ),
    );
    // suspentes verticales entre le tablier et la main courante
    const hangs: THREE.Matrix4[] = [];
    const steps = Math.max(8, Math.round(len / 1.4));
    for (const s of [1, -1])
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const h = 1 + Math.sin(Math.PI * t) * 0.25;
        o.position.copy(at(t).add(side.clone().multiplyScalar(s))).add(new THREE.Vector3(0, h / 2, 0));
        o.rotation.set(0, 0, 0);
        o.scale.set(1, h, 1);
        o.updateMatrix();
        hangs.push(o.matrix.clone());
      }
    o.scale.set(1, 1, 1);
    const posts: [number, number, number][] = [];
    for (const t of [0, 1]) for (const s of [1, -1]) posts.push(at(t).add(side.clone().multiplyScalar(s)).add(new THREE.Vector3(0, 0.6, 0)).toArray() as [number, number, number]);
    // lanterne de statut, accrochée au poteau d'arrivée
    const lantern = at(1).add(side.clone().multiplyScalar(1)).add(new THREE.Vector3(0, 1.45, 0)).toArray() as [number, number, number];
    return { planks, ropes, hangs, posts, lantern };
  }, [bridge.from, bridge.to, bridge.slot]);
  useEffect(() => () => parts.ropes.forEach((g) => g.dispose()), [parts]);

  const glow = useRef<THREE.Sprite>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    if (glow.current) glow.current.scale.setScalar(running ? 1.5 + Math.sin((clock.elapsedTime + seed) * 4) * 0.3 : 1.2);
  });

  return (
    <group>
      <Instances geo={plankGeo} mat={MAT.wood} matrices={parts.planks} shadow />
      <Instances geo={hangGeo} mat={MAT.rope} matrices={parts.hangs} />
      {parts.ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={MAT.rope} castShadow />
      ))}
      {parts.posts.map((p, i) => (
        <mesh key={i} geometry={postGeo} material={MAT.wood} position={p} castShadow />
      ))}
      <group position={parts.lantern}>
        <mesh material={MAT.metal} position={[0, 0.16, 0]}>
          <coneGeometry args={[0.16, 0.12, 8]} />
        </mesh>
        <mesh material={bulbMaterial(color)}>
          <boxGeometry args={[0.16, 0.22, 0.16]} />
        </mesh>
        <sprite ref={glow} material={glowMaterial(color)} />
      </group>
    </group>
  );
}

export function Bridges({ bridges }: { bridges: Bridge[] }) {
  return (
    <>
      {bridges.map((b) => (
        <BridgeMesh key={b.id} bridge={b} />
      ))}
    </>
  );
}
