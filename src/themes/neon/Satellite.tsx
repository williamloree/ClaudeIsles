// Satellite en orbite basse au-dessus de la tour : une session Claude Code ouverte ailleurs
// (terminal, VS Code…). Son feu clignote vert quand elle travaille, rouge sinon.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SessionLabel, clickable } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Session } from '../../types';
import { CYAN, MAT, drawTexture, glowMaterial, neon } from './materials';

const solarTex = drawTexture(128, 64, (ctx) => {
  ctx.fillStyle = '#04081c';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#1d4cff';
  for (let y = 2; y < 64; y += 10) for (let x = 2; x < 128; x += 10) ctx.fillRect(x, y, 8, 8);
});
const solarMat = new THREE.MeshStandardMaterial({ map: solarTex, emissive: 0xffffff, emissiveMap: solarTex, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 });
const panelGeo = new THREE.BoxGeometry(2.2, 0.04, 0.9);
const ringGeo = new THREE.TorusGeometry(0.65, 0.04, 6, 32);

export function Satellite({ session, pos, selected }: { session: Session; pos: Vec3; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const live = Date.now() - session.lastActivity < 30e3;
  const blink = useMemo(() => glowMaterial(live ? '#3cff8f' : '#ff2a2a', 1), [live]);
  useEffect(() => () => blink.dispose(), [blink]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + pos[0];
    if (ref.current) {
      ref.current.position.y = Math.sin(t * 0.8) * 0.5;
      ref.current.rotation.y += 0.003;
      ref.current.rotation.z = Math.sin(t * 0.6) * 0.06;
    }
    blink.opacity = Math.sin(t * (live ? 6 : 2.5)) > 0.6 ? 1 : 0.15;
  });
  return (
    <group position={pos}>
      <group ref={ref} scale={1.4} {...clickable(() => useStore.getState().select({ kind: 'session', id: session.id }))}>
        <mesh material={MAT.metal}>
          <boxGeometry args={[0.9, 0.9, 1.3]} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={panelGeo} material={solarMat} position-x={x * 1.65} />
        ))}
        <mesh position-y={-0.6} material={MAT.metal}>
          <coneGeometry args={[0.4, 0.3, 16, 1, true]} />
        </mesh>
        <mesh geometry={ringGeo} material={neon(session.active ? CYAN : '#6a6f8a', 2.4)} rotation-x={Math.PI / 2} />
        <sprite material={blink} position-y={0.6} scale={1.4} />
        {selected && <mesh geometry={ringGeo} material={neon(CYAN, 2.6)} scale={2.6} rotation-x={Math.PI / 2} />}
      </group>
      <SessionLabel session={session} selected={selected} position={[0, 2.8, 0]} />
    </group>
  );
}
