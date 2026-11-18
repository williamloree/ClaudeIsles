// Lanterne flottant au-dessus du temple : une session Claude Code ouverte ailleurs (terminal, VS Code…).
// Sa flamme s'avive quand la session travaille.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, ago, cut } from '../format';
import type { Session } from '../types';
import { Fire } from './Fire';
import type { Vec3 } from './islands';
import { labelLayer } from './labels';
import { MAT } from './materials';

export function SessionSat({ session, pos, selected, onClick }: { session: Session; pos: Vec3; selected: boolean; onClick: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const live = Date.now() - session.lastActivity < 30e3;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + pos[0];
    ref.current.position.y = pos[1] + Math.sin(t * 0.7) * 0.5;
    ref.current.rotation.z = Math.sin(t * 0.9) * 0.08;
    ref.current.rotation.y += 0.002;
  });
  return (
    <group ref={ref} position={pos}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        {/* cage de bronze */}
        <mesh position={[0, 1.1, 0]} material={MAT.bronze}>
          <coneGeometry args={[0.7, 0.5, 6]} />
        </mesh>
        <mesh position={[0, -0.85, 0]} material={MAT.bronze}>
          <cylinderGeometry args={[0.6, 0.45, 0.2, 6]} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.58, 0.1, Math.sin(a) * 0.58]} material={MAT.bronze}>
              <cylinderGeometry args={[0.035, 0.035, 1.8, 4]} />
            </mesh>
          );
        })}
        <mesh position={[0, 1.55, 0]} material={MAT.bronze}>
          <torusGeometry args={[0.18, 0.04, 6, 16]} />
        </mesh>
        <group position={[0, -0.7, 0]}>
          <Fire color={session.active ? COLORS.lantern : COLORS.ash} scale={live ? 1 : 0.6} />
        </group>
      </group>
      <Html position={[0, 2.6, 0]} center zIndexRange={[40, 0]} portal={labelLayer}>
        <div className={`sat-label ${selected ? 'selected' : ''} ${session.active ? 'active' : ''}`} onClick={onClick}>
          <div className="sat-project">{session.project}</div>
          <div className="sat-title">{cut(session.title || session.lastPrompt || 'session', 34)}</div>
          {(live || selected) && <div className="sat-tool">{live && session.lastTool ? cut(session.lastTool, 40) : ago(session.lastActivity)}</div>}
        </div>
      </Html>
    </group>
  );
}
