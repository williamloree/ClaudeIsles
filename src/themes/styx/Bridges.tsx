// Ponts de marbre en arche entre le temple et chaque îlot occupé.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { STATUS_COLOR } from '../../format';
import type { Bridge } from '../../scene/layout';
import { Fire } from './Fire';
import { MAT } from './materials';

const blockGeo = new THREE.BoxGeometry(2.6, 0.45, 0.86);
const postGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8);

function BridgeMesh({ bridge }: { bridge: Bridge }) {
  const parts = useMemo(() => {
    const a = new THREE.Vector3(...bridge.from);
    const b = new THREE.Vector3(...bridge.to);
    const len = a.distanceTo(b);
    const rise = Math.min(3, len * 0.12);
    const at = (t: number) => a.clone().lerp(b, t).add(new THREE.Vector3(0, Math.sin(Math.PI * t) * rise, 0));
    const side = new THREE.Vector3().subVectors(b, a).setY(0).normalize().cross(new THREE.Vector3(0, 1, 0));
    const n = Math.max(4, Math.round(len / 0.9));
    const o = new THREE.Object3D();
    const blocks = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      o.position.copy(at(t));
      o.lookAt(at(Math.min(1, t + 0.01)));
      return { pos: o.position.toArray() as [number, number, number], quat: o.quaternion.toArray() as [number, number, number, number] };
    });
    const posts: [number, number, number][] = [];
    for (let i = 1; i < n; i += 3) for (const s of [1, -1]) posts.push(at((i + 0.5) / n).add(side.clone().multiplyScalar(1.15 * s)).add(new THREE.Vector3(0, 0.6, 0)).toArray() as [number, number, number]);
    const rails = [1, -1].map(
      (s) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 30 }, (_, i) => at(i / 29).add(side.clone().multiplyScalar(1.15 * s)).add(new THREE.Vector3(0, 1.05, 0)))), 60, 0.09, 6),
    );
    // arche de basalte sous le tablier, qui plonge vers l'eau aux deux bouts
    const arch = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => at(i / 23).add(new THREE.Vector3(0, -0.6 - (1 - Math.sin((Math.PI * i) / 23)) * 1.6, 0)))),
      48,
      0.35,
      8,
    );
    const torch = at(0.97).add(side.clone().multiplyScalar(1.6)).toArray() as [number, number, number];
    return { blocks, posts, rails, arch, torch };
  }, [bridge.from, bridge.to]);
  useEffect(() => () => [...parts.rails, parts.arch].forEach((g) => g.dispose()), [parts]);

  return (
    <group>
      {parts.blocks.map((b, i) => (
        <mesh key={i} geometry={blockGeo} position={b.pos} quaternion={b.quat} material={MAT.marble} castShadow receiveShadow />
      ))}
      {parts.posts.map((p, i) => (
        <mesh key={i} geometry={postGeo} position={p} material={MAT.marble} castShadow />
      ))}
      {parts.rails.map((g, i) => (
        <mesh key={i} geometry={g} material={MAT.marble} castShadow />
      ))}
      <mesh geometry={parts.arch} material={MAT.basalt} castShadow />
      {/* torchère à l'arrivée : sa flamme donne le statut de loin */}
      <group position={parts.torch}>
        <mesh position={[0, 0.9, 0]} material={MAT.bronze}>
          <cylinderGeometry args={[0.05, 0.08, 1.8, 6]} />
        </mesh>
        <group position={[0, 1.85, 0]}>
          <Fire color={STATUS_COLOR[bridge.status]} scale={0.5} />
        </group>
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
