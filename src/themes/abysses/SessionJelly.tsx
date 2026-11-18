// Petite méduse errante au-dessus de la cité : une session Claude Code ouverte ailleurs.
// Elle bat vite et brille quand la session travaille, pâlit quand elle dort.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SessionLabel, clickable } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Session } from '../../types';
import { Jelly } from './Jelly';

const HUES = ['#58f0c8', '#6fb8ff', '#ff8ad8', '#b48cff', '#7fffb0', '#ffb38a', '#8af0ff', '#e0a0ff'];

export function SessionJelly({ session, pos, slot, selected }: { session: Session; pos: Vec3; slot: number; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const live = Date.now() - session.lastActivity < 30e3;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + slot * 1.7;
    // elle dérive autour de sa place sans s'en éloigner : la caméra sait où la trouver
    ref.current.position.set(pos[0] + Math.sin(t * 0.21) * 0.8, pos[1] + Math.sin(t * 0.7) * 1.2, pos[2] + Math.cos(t * 0.17) * 0.8);
    ref.current.rotation.z = Math.sin(t * 0.5) * 0.08;
  });
  return (
    <group ref={ref} position={pos}>
      <group {...clickable(() => useStore.getState().select({ kind: 'session', id: session.id }))}>
        <Jelly
          r={1.5}
          color={HUES[slot % HUES.length]}
          rim="#d8fff6"
          tentacles={12}
          lenK={2.6}
          pace={live ? 3 : session.active ? 1.6 : 1}
          strength={selected ? 1.6 : live || session.active ? 1.15 : 0.55}
        />
      </group>
      <SessionLabel session={session} selected={selected} position={[0, 3, 0]} />
    </group>
  );
}
