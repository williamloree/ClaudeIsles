// Montgolfière au-dessus de l'île centrale : une session Claude Code ouverte ailleurs (terminal, VS Code…).
// Le brûleur s'allume quand la session travaille.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SessionLabel, clickable } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Session } from '../../types';
import { MAT, bulbMaterial, glowMaterial } from './materials';

// enveloppe en goutte inversée (profil tourné autour de l'axe vertical)
const envelopeGeo = new THREE.LatheGeometry(
  [
    [0.42, -1.75],
    [0.7, -1.3],
    [1.25, -0.6],
    [1.75, 0.2],
    [1.95, 0.9],
    [1.85, 1.6],
    [1.45, 2.2],
    [0.8, 2.6],
    [0, 2.75],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
  32,
);
const basketGeo = new THREE.CylinderGeometry(0.42, 0.36, 0.5, 12);
const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4);

// fuseaux de couleurs (une palette par emplacement)
const PALETTES = [
  ['#c8432f', '#f2e6cf'],
  ['#2f5e9e', '#f1c94a'],
  ['#3e7d4a', '#efe3c4'],
  ['#8a3f7a', '#f2b45a'],
];
const envelopeMats = PALETTES.map(([a, b]) => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect((i * 256) / 12, 0, 256 / 12 + 1, 64);
  }
  // bande décorative à l'équateur
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, 34, 256, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, side: THREE.DoubleSide });
});

export function Balloon({ session, slot, pos, selected }: { session: Session; slot: number; pos: Vec3; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Sprite>(null);
  const live = Date.now() - session.lastActivity < 30e3;
  const burning = session.active || live;
  const cords = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const top = new THREE.Vector3(Math.cos(a) * 0.42, -1.75, Math.sin(a) * 0.42);
        const bot = new THREE.Vector3(Math.cos(a) * 0.36, -2.55, Math.sin(a) * 0.36);
        const o = new THREE.Object3D();
        o.position.copy(top).lerp(bot, 0.5);
        o.lookAt(bot);
        o.rotateX(Math.PI / 2);
        return { pos: o.position.toArray() as Vec3, quat: o.quaternion.toArray() as [number, number, number, number], len: top.distanceTo(bot) };
      }),
    [],
  );
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + pos[0];
    ref.current.position.y = pos[1] + Math.sin(t * 0.5) * 0.6;
    ref.current.rotation.z = Math.sin(t * 0.7) * 0.04;
    ref.current.rotation.y += 0.0015;
    if (flame.current) {
      const k = burning ? 0.9 + Math.sin(t * 13) * 0.2 + Math.sin(t * 31) * 0.1 : 0.25;
      flame.current.scale.set(0.5 * k, 0.9 * k, 1);
    }
  });
  return (
    <group ref={ref} position={pos}>
      <group scale={1.5} {...clickable(() => useStore.getState().select({ kind: 'session', id: session.id }))}>
        <mesh geometry={envelopeGeo} material={envelopeMats[slot % envelopeMats.length]} castShadow />
        {cords.map((c, i) => (
          <mesh key={i} geometry={cordGeo} material={MAT.rope} position={c.pos} quaternion={c.quat} scale={[1, c.len, 1]} />
        ))}
        <mesh geometry={basketGeo} material={MAT.wood} position={[0, -2.8, 0]} castShadow />
        {/* brûleur */}
        <mesh position={[0, -1.95, 0]} material={MAT.metal}>
          <cylinderGeometry args={[0.12, 0.16, 0.2, 10]} />
        </mesh>
        <sprite ref={flame} material={glowMaterial('#ffb35c', 0.95)} position={[0, -1.55, 0]} />
        {burning && (
          <mesh position={[0, -1.7, 0]} material={bulbMaterial('#ffb35c', 2)}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </mesh>
        )}
      </group>
      {selected && (
        <mesh position={[0, 0.75, 0]}>
          <torusGeometry args={[3.4, 0.07, 6, 48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      )}
      <SessionLabel session={session} selected={selected} position={[0, 5.4, 0]} />
    </group>
  );
}
