// Le hub : un tholos (temple rond) sur le grand îlot ; Claude est la flamme éternelle de l'autel.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../format';
import { useStore } from '../store';
import { Brazier, Fire } from './Fire';
import { HUB_TEMPLATE } from './islands';
import { Column, Islet } from './Islet';
import { labelLayer } from './labels';
import { MAT } from './materials';

const T = HUB_TEMPLATE.top;
const TT = T + 1.05; // sol du temple, au-dessus des trois marches

export function Hub() {
  const busy = useStore((s) => s.hub.busy);
  const connected = useStore((s) => s.connected);
  const select = useStore((s) => s.select);
  const setTerminal = useStore((s) => s.setTerminal);
  // L'étiquette (DOM) passerait par-dessus l'élément qu'on regarde de près.
  const focusElsewhere = useStore((s) => !!s.selection && s.selection.kind !== 'hub');
  const core = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (core.current) {
      core.current.rotation.y += dt * (busy ? 2.5 : 0.5);
      core.current.position.y = TT + 3.6 + Math.sin(t * (busy ? 4 : 1.4)) * (busy ? 0.45 : 0.25);
    }
    if (coreMat.current) coreMat.current.emissiveIntensity = busy ? 5 + Math.sin(t * 9) * 1.5 : 4;
  });

  const open = () => {
    select({ kind: 'hub', id: 'hub' });
    setTerminal(true);
  };

  return (
    <Islet template={HUB_TEMPLATE} position={[0, 0, 0]} onClick={open}>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[0, T + 0.17 + k * 0.35, 0]} material={MAT.marble} castShadow receiveShadow>
          <cylinderGeometry args={[8.4 - k * 0.6, 8.6 - k * 0.6, 0.35, 64]} />
        </mesh>
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 6.6, TT, Math.sin(a) * 6.6]}>
            <Column h={6.5} r={0.38} />
          </group>
        );
      })}
      <mesh position={[0, TT + 6.95, 0]} material={MAT.marble} castShadow>
        <cylinderGeometry args={[7.3, 7.3, 0.9, 64, 1, true]} />
      </mesh>
      <mesh position={[0, TT + 8.9, 0]} material={MAT.roof} castShadow>
        <coneGeometry args={[7.8, 3, 64]} />
      </mesh>

      <group
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <mesh position={[0, TT + 0.7, 0]} material={MAT.marble} castShadow receiveShadow>
          <cylinderGeometry args={[1.2, 1.5, 1.4, 24]} />
        </mesh>
        <group position={[0, TT + 1.3, 0]}>
          <Fire color={COLORS.claude} scale={busy ? 3.8 : 3.2} light={busy ? 90 : 60} />
        </group>
        <mesh ref={core} position={[0, TT + 3.6, 0]}>
          <icosahedronGeometry args={[0.9, 4]} />
          <meshStandardMaterial ref={coreMat} color="#220a00" emissive="#ff8a3d" emissiveIntensity={4} />
        </mesh>
      </group>

      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4 + 0.39;
        return (
          <group key={i} position={[Math.cos(a) * 10, T, Math.sin(a) * 10]}>
            <Brazier color="#ff8a3d" scale={1.1} />
          </group>
        );
      })}

      {!focusElsewhere && (
        <Html position={[0, TT + 12.5, 0]} center zIndexRange={[40, 0]} portal={labelLayer}>
          <div className={`hub-label ${busy ? 'busy' : ''}`} onClick={open}>
            <div className="hub-name">CLAUDE</div>
            <div className="hub-state">{!connected ? 'le serveur s’est tu' : busy ? 'la flamme réfléchit…' : 'la flamme éternelle t’écoute'}</div>
          </div>
        </Html>
      )}
    </Islet>
  );
}
