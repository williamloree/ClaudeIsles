// Passerelles lumineuses entre la tour et chaque plateforme occupée : tablier de tôle, bordures cyan,
// rampes roses, et des impulsions aux couleurs du statut qui filent vers l'agent (vite s'il travaille).
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STATUS_COLOR } from '../../format';
import type { Bridge } from '../../scene/layout';
import { ISLET_TOP } from '../../scene/slots';
import type { Status } from '../../types';
import { CYAN, MAT, PINK, flowMat, glowMaterial, neon } from './materials';

const SPEED: Record<Status, number> = { running: 0.9, completed: 0.3, failed: 0.15, killed: 0.15, stopped: 0.1, stale: 0.1 };
const PIER_H = ISLET_TOP + 3;

function BridgeMesh({ bridge }: { bridge: Bridge }) {
  const color = STATUS_COLOR[bridge.status];
  const { len, pos, rotY, geos } = useMemo(() => {
    const a = new THREE.Vector3(bridge.from[0], ISLET_TOP, bridge.from[2]);
    const b = new THREE.Vector3(bridge.to[0], ISLET_TOP, bridge.to[2]);
    const len = a.distanceTo(b);
    const posts: THREE.BufferGeometry[] = [];
    const piers: THREE.BufferGeometry[] = [];
    for (const s of [1, -1]) for (let x = -len / 2 + 1; x < len / 2; x += 3) posts.push(new THREE.BoxGeometry(0.08, 1, 0.08).translate(x, 0.5, 1.12 * s));
    for (let x = -len / 2 + 5; x < len / 2 - 3; x += 9) piers.push(new THREE.CylinderGeometry(0.25, 0.3, PIER_H, 6).translate(x, -PIER_H / 2 - 0.2, 0));
    const geos = {
      deck: new THREE.BoxGeometry(len, 0.25, 2.4),
      flow: new THREE.PlaneGeometry(len, 0.7),
      strip: new THREE.BoxGeometry(len, 0.06, 0.06),
      rail: new THREE.BoxGeometry(len, 0.05, 0.05),
      posts: mergeGeometries(posts),
      piers: piers.length ? mergeGeometries(piers) : null,
    };
    posts.forEach((g) => g.dispose());
    piers.forEach((g) => g.dispose());
    // repère : +x de la tour vers la plateforme
    return { len, pos: a.clone().lerp(b, 0.5).toArray() as [number, number, number], rotY: -Math.atan2(b.z - a.z, b.x - a.x), geos };
  }, [bridge.from, bridge.to]);
  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos]);

  const flow = useMemo(() => flowMat(color, len), [color, len]);
  useEffect(() => () => flow.dispose(), [flow]);
  flow.uniforms.speed.value = SPEED[bridge.status];
  const beacon = useMemo(() => glowMaterial(color, 0.9), [color]);
  useEffect(() => () => beacon.dispose(), [beacon]);

  return (
    <group position={pos} rotation-y={rotY}>
      <mesh geometry={geos.deck} material={MAT.deck} position-y={-0.125} />
      <mesh geometry={geos.flow} material={flow} rotation-x={-Math.PI / 2} position-y={0.02} />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={geos.strip} material={neon(CYAN, 2)} position={[0, 0.02, 1.2 * s]} />
          <mesh geometry={geos.rail} material={neon(PINK, 2.2)} position={[0, 1, 1.12 * s]} />
        </group>
      ))}
      <mesh geometry={geos.posts} material={MAT.metal} />
      {geos.piers && <mesh geometry={geos.piers} material={MAT.metal} />}
      {/* balise d'arrivée : couleur du statut, visible de loin */}
      <group position={[len / 2 - 1.2, 0, 1.6]}>
        <mesh position-y={1.1} material={MAT.metal}>
          <boxGeometry args={[0.16, 2.2, 0.16]} />
        </mesh>
        <mesh position-y={2.3} material={neon(color, 2.6)}>
          <octahedronGeometry args={[0.22, 0]} />
        </mesh>
        <sprite material={beacon} position-y={2.3} scale={2.2} />
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
