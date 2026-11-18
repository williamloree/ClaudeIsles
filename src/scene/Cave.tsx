// La caverne des Enfers : voûte hérissée de stalactites, piliers de roche au loin,
// braises qui montent du temple et feux follets qui errent au-dessus du fleuve.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAT, fbm, rng, softTex } from './materials';

function Stalactites() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 260;
  useEffect(() => {
    const r = rng(9);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2;
      const d = 20 + r() * 260;
      const h = 8 + r() * 30;
      const w = 1 + r() * 3;
      m.compose(new THREE.Vector3(Math.cos(a) * d, 105 - h / 2 + r() * 4, Math.sin(a) * d), q, new THREE.Vector3(w, h, w));
      ref.current!.setMatrixAt(i, m);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} material={MAT.basalt}>
      <coneGeometry args={[1, 1, 7]} />
    </instancedMesh>
  );
}

const pillarGeos = Array.from({ length: 28 }, (_, i) => {
  const r = rng(300 + i);
  const geo = new THREE.CylinderGeometry(8 + r() * 10, 14 + r() * 14, 140, 12, 10);
  const p = geo.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const k = 1 + fbm(p.getX(j) * 0.08, p.getY(j) * 0.05, i) * 0.6;
    p.setX(j, p.getX(j) * k);
    p.setZ(j, p.getZ(j) * k);
  }
  geo.computeVertexNormals();
  const a = (i / 28) * Math.PI * 2 + r() * 0.1;
  const d = 190 + r() * 90;
  return { geo, pos: [Math.cos(a) * d, 50, Math.sin(a) * d] as [number, number, number] };
});

function Particles({ count, color, size, spread, yMin, yMax, rise, spin }: { count: number; color: string; size: number; spread: number; yMin: number; yMax: number; rise: number; spin: number }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const r = rng(count * 13 + spread);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * spread;
      pos.set([Math.cos(a) * d, yMin + r() * (yMax - yMin), Math.sin(a) * d], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, spread, yMin, yMax]);
  const mat = useMemo(() => new THREE.PointsMaterial({ color, size, map: softTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), [color, size]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * spin;
    if (!rise) return;
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * rise * (1 + (i % 5) * 0.3);
      if (y > yMax) y = yMin;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

export function Cave() {
  return (
    <>
      <Stalactites />
      {pillarGeos.map((p, i) => (
        <mesh key={i} geometry={p.geo} position={p.pos} material={MAT.basalt} />
      ))}
      <mesh rotation-x={Math.PI / 2} position={[0, 105, 0]} material={MAT.basalt}>
        <planeGeometry args={[900, 900]} />
      </mesh>
      {/* braises au-dessus du temple, feux follets sur le fleuve */}
      <Particles count={400} color="#ff8a3d" size={0.35} spread={14} yMin={3} yMax={32} rise={1} spin={0.05} />
      <Particles count={180} color="#7fe9ff" size={0.9} spread={130} yMin={1} yMax={25} rise={0} spin={0.02} />
    </>
  );
}
