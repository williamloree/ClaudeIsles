// Passerelles de blocs de glace entre le phare et chaque floe occupé : cordes sur piquets de bois,
// piles de glace jusqu'à l'eau, un traîneau qui fait la navette tant que l'agent travaille,
// et une lanterne de statut à l'arrivée.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR } from '../../format';
import type { Bridge } from '../../scene/layout';
import { Lantern } from './Fire';
import { MAT, rng } from './materials';

const blockGeo = new THREE.BoxGeometry(2.3, 0.4, 0.74);
const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 1.25, 6);
const pileGeo = new THREE.CylinderGeometry(0.7, 1.1, 1, 7);
pileGeo.translate(0, -0.5, 0); // ancrée par le haut : on l'étire jusqu'à l'eau

// traîneau
const runnerGeo = new THREE.BoxGeometry(0.05, 0.05, 1.5);
const tipGeo = new THREE.TorusGeometry(0.15, 0.025, 6, 10, Math.PI / 2);
const deckGeo = new THREE.BoxGeometry(0.72, 0.05, 1.2);
const stanchionGeo = new THREE.BoxGeometry(0.04, 0.17, 0.04);
const crateGeo = new THREE.BoxGeometry(0.5, 0.34, 0.55);
const bundleGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.6, 10);

function Sled() {
  return (
    <group>
      {[-0.3, 0.3].map((x) => (
        <group key={x}>
          <mesh geometry={runnerGeo} material={MAT.metal} position={[x, 0.03, 0]} />
          <mesh geometry={tipGeo} material={MAT.metal} position={[x, 0.18, 0.75]} rotation-y={Math.PI / 2} />
        </group>
      ))}
      <mesh geometry={deckGeo} material={MAT.wood} position={[0, 0.2, 0]} castShadow />
      {[
        [-0.3, -0.45],
        [0.3, -0.45],
        [-0.3, 0.45],
        [0.3, 0.45],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={stanchionGeo} material={MAT.wood} position={[x, 0.11, z]} />
      ))}
      <mesh geometry={crateGeo} material={MAT.wood} position={[0, 0.4, -0.2]} castShadow />
      <mesh geometry={bundleGeo} material={MAT.canvas} position={[0, 0.38, 0.35]} rotation-z={Math.PI / 2} castShadow />
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

function BridgeMesh({ bridge }: { bridge: Bridge }) {
  const blocks = useRef<THREE.InstancedMesh>(null);
  const sled = useRef<THREE.Group>(null);
  const running = bridge.status === 'running';
  const parts = useMemo(() => {
    const a = new THREE.Vector3(...bridge.from);
    const b = new THREE.Vector3(...bridge.to);
    const len = a.distanceTo(b);
    const rise = Math.min(1.6, len * 0.07);
    const at = (t: number, out = new THREE.Vector3()) => out.copy(a).lerp(b, t).add(new THREE.Vector3(0, Math.sin(Math.PI * t) * rise, 0));
    const side = new THREE.Vector3().subVectors(b, a).setY(0).normalize().cross(UP);
    const n = Math.max(4, Math.round(len / 0.8));
    const r = rng(bridge.slot * 31 + 7);
    const o = new THREE.Object3D();
    const matrices = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      o.position.copy(at(t));
      o.lookAt(at(Math.min(1, t + 0.01)));
      o.rotateZ((r() - 0.5) * 0.06); // blocs taillés à la main, pas tout à fait alignés
      o.updateMatrix();
      return o.matrix.clone();
    });
    const posts: [number, number, number][] = [];
    for (let i = 1; i < n; i += 4) for (const s of [1, -1]) posts.push(at((i + 0.5) / n).add(side.clone().multiplyScalar(1.1 * s)).add(new THREE.Vector3(0, 0.6, 0)).toArray() as [number, number, number]);
    // cordes qui pendent entre les piquets
    const ropes = [1, -1].map(
      (s) =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            Array.from({ length: 81 }, (_, j) => {
              const t = j / 80;
              return at(t)
                .add(side.clone().multiplyScalar(1.1 * s))
                .add(new THREE.Vector3(0, 1.15 - 0.22 * Math.abs(Math.sin((Math.PI * (t * n - 1.5)) / 4)), 0));
            }),
          ),
          160,
          0.035,
          5,
        ),
    );
    const piles = [0.33, 0.67].map((t) => {
      const p = at(t);
      return { pos: [p.x, p.y - 0.2, p.z] as [number, number, number], h: p.y + 1, rot: r() * 6 };
    });
    const lantern = at(0.97).add(side.clone().multiplyScalar(1.6)).toArray() as [number, number, number];
    return { at, matrices, posts, ropes, piles, lantern, ph: r() * 6 };
  }, [bridge.from, bridge.to, bridge.slot]);
  useEffect(() => () => parts.ropes.forEach((g) => g.dispose()), [parts]);
  useLayoutEffect(() => {
    const m = blocks.current;
    if (!m) return;
    parts.matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [parts]);

  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    if (!sled.current) return;
    // va-et-vient pendant le travail ; garé à l'arrivée sinon
    const u = running ? 0.08 + 0.84 * (0.5 - 0.5 * Math.cos(clock.elapsedTime * 0.22 + parts.ph)) : 0.9;
    parts.at(u, p).y += 0.2;
    parts.at(Math.min(1, u + 0.01), q).y += 0.2;
    sled.current.position.copy(p);
    sled.current.lookAt(q);
  });

  return (
    <group>
      <instancedMesh key={parts.matrices.length} ref={blocks} args={[blockGeo, MAT.block, parts.matrices.length]} castShadow receiveShadow />
      {parts.posts.map((pp, i) => (
        <mesh key={i} geometry={postGeo} position={pp} material={MAT.wood} castShadow />
      ))}
      {parts.ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={MAT.rope} />
      ))}
      {parts.piles.map((pl, i) => (
        <mesh key={i} geometry={pileGeo} material={MAT.facet} position={pl.pos} rotation-y={pl.rot} scale={[1, pl.h, 1]} castShadow />
      ))}
      <group ref={sled}>
        <Sled />
      </group>
      {/* lanterne de statut à l'arrivée : on lit l'état de loin */}
      <group position={parts.lantern}>
        <Lantern color={STATUS_COLOR[bridge.status]} scale={1.3} glow={running ? 1.2 : 0.8} />
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
