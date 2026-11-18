// Ponts rouges en arc (taikobashi) entre le parvis du hub et chaque îlot occupé.
// Une petite lanterne de pierre, à l'arrivée, donne le statut de l'agent de loin.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { STATUS_COLOR } from '../../format';
import type { Bridge } from '../../scene/layout';
import { MAT } from './materials';
import { Toro } from './Props';

const plankGeo = new THREE.BoxGeometry(2.3, 0.12, 0.42);
const postGeo = new THREE.CylinderGeometry(0.08, 0.09, 1.05, 8);
const giboshiGeo = new THREE.SphereGeometry(0.15, 12, 8);
const tipGeo = new THREE.ConeGeometry(0.07, 0.22, 10);
const beamGeo = new THREE.BoxGeometry(2.6, 0.18, 0.2);

type P = [number, number, number];
type Q = [number, number, number, number];

function BridgeMesh({ bridge }: { bridge: Bridge }) {
  const parts = useMemo(() => {
    const V = THREE.Vector3;
    const a = new V(...bridge.from);
    const b = new V(...bridge.to);
    const len = a.distanceTo(b);
    const rise = Math.min(4.2, len * 0.22);
    const at = (t: number) => a.clone().lerp(b, t).add(new V(0, Math.sin(Math.PI * t) * rise, 0));
    const dir = new V().subVectors(b, a).setY(0).normalize();
    const side = dir.clone().cross(new V(0, 1, 0));
    const off = (t: number, s: number, y: number) => at(t).add(side.clone().multiplyScalar(s)).add(new V(0, y, 0));
    const tube = (f: (t: number) => THREE.Vector3, r: number) =>
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 32 }, (_, i) => f(i / 31))), 64, r, 6);
    const o = new THREE.Object3D();
    const n = Math.round(len / 0.45);
    const planks = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      o.position.copy(at(t));
      o.lookAt(at(Math.min(1, t + 0.01)));
      return { pos: o.position.toArray() as P, quat: o.quaternion.toArray() as Q };
    });
    const tubes: THREE.BufferGeometry[] = [];
    const posts: P[] = [];
    const caps: P[] = [];
    const tips: P[] = [];
    const nP = Math.max(5, Math.round(len / 2.6));
    for (const s of [1.12, -1.12]) {
      tubes.push(tube((t) => off(t, s, -0.12), 0.13), tube((t) => off(t, s, 1.0), 0.07), tube((t) => off(t, s, 0.55), 0.045));
      for (let k = 0; k <= nP; k++) {
        posts.push(off(k / nP, s, 0.5).toArray() as P);
        if (k === 0 || k === nP) {
          caps.push(off(k / nP, s, 1.12).toArray() as P);
          tips.push(off(k / nP, s, 1.33).toArray() as P);
        }
      }
    }
    // piles sous l'arche, jusque dans l'eau
    const beams: { pos: P; quat: Q }[] = [];
    const piles: { pos: P; h: number }[] = [];
    for (const t of [0.22, 0.5, 0.78]) {
      const y = at(t).y - 0.12;
      o.position.copy(at(t)).add(new V(0, -0.25, 0));
      o.lookAt(o.position.clone().add(dir));
      beams.push({ pos: o.position.toArray() as P, quat: o.quaternion.toArray() as Q });
      for (const s of [0.95, -0.95]) {
        const h = y + 1.2;
        const p = off(t, s, 0);
        piles.push({ pos: [p.x, y - h / 2, p.z], h });
      }
    }
    const pileGeos = piles.map((p) => new THREE.CylinderGeometry(0.13, 0.15, p.h, 10));
    const lantern = off(0.985, 2.1, 0).toArray() as P;
    lantern[1] = bridge.to[1] - 0.1;
    return { planks, tubes, posts, caps, tips, beams, piles, pileGeos, lantern };
  }, [bridge.from, bridge.to]);
  useEffect(() => () => [...parts.tubes, ...parts.pileGeos].forEach((g) => g.dispose()), [parts]);

  return (
    <group>
      {parts.planks.map((p, i) => (
        <mesh key={i} geometry={plankGeo} material={MAT.wood} position={p.pos} quaternion={p.quat} castShadow receiveShadow />
      ))}
      {parts.tubes.map((g, i) => (
        <mesh key={i} geometry={g} material={MAT.vermilion} castShadow />
      ))}
      {parts.posts.map((p, i) => (
        <mesh key={i} geometry={postGeo} material={MAT.vermilion} position={p} castShadow />
      ))}
      {parts.caps.map((p, i) => (
        <mesh key={i} geometry={giboshiGeo} material={MAT.brass} position={p} />
      ))}
      {parts.tips.map((p, i) => (
        <mesh key={i} geometry={tipGeo} material={MAT.brass} position={p} />
      ))}
      {parts.beams.map((b, i) => (
        <mesh key={i} geometry={beamGeo} material={MAT.vermilion} position={b.pos} quaternion={b.quat} castShadow />
      ))}
      {parts.piles.map((p, i) => (
        <mesh key={i} geometry={parts.pileGeos[i]} material={MAT.vermilion} position={p.pos} castShadow />
      ))}
      {/* lanterne de statut à l'arrivée sur l'îlot */}
      <group position={parts.lantern}>
        <Toro scale={0.6} color={STATUS_COLOR[bridge.status]} flame={1.6} />
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
