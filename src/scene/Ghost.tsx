// Esprit d'un agent : robe spectrale qui ondule et s'effiloche, capuche au visage d'ombre,
// yeux luisants qui clignent, manches flottantes, plume qui écrit quand l'agent travaille.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { ghostMaterial } from './materials';

export type GhostPose = 'write' | 'idle' | 'mourn' | 'sit';

const voidMat = new THREE.MeshBasicMaterial({ color: '#020304' });

const robeGeo = new THREE.LatheGeometry(
  [
    [0.0, -0.95],
    [0.64, -0.92],
    [0.56, -0.6],
    [0.43, -0.2],
    [0.34, 0.2],
    [0.37, 0.55],
    [0.3, 0.76],
    [0.14, 0.88],
    [0.0, 0.9],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
  40,
);
const sleeveGeo = new THREE.CylinderGeometry(0.07, 0.15, 0.62, 16, 6, true);
sleeveGeo.translate(0, -0.31, 0);

export function Ghost({ color, pose = 'idle', scale = 1, seed = 0 }: { color: string; pose?: GhostPose; scale?: number; seed?: number }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const robe = useMemo(() => ghostMaterial(color, { fadeBottom: -0.8, wave: 1 }), [color]);
  const body = useMemo(() => ghostMaterial(color, { strength: 0.55 }), [color]);
  const hood = useMemo(() => ghostMaterial(color, { strength: 1.2 }), [color]);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false }), [color]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 7.3;
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.3) * (pose === 'write' ? 0.05 : 0.12);
      root.current.rotation.y = pose === 'idle' ? Math.sin(t * 0.4) * 0.25 : 0;
    }
    // Le visage regarde vers -z : rotation.x négative = tête penchée en avant, positive = bras vers l'avant.
    if (head.current) head.current.rotation.x = pose === 'mourn' ? -0.55 : pose === 'write' ? -0.28 + Math.sin(t * 2) * 0.04 : Math.sin(t * 0.7) * 0.06;
    if (armR.current && armL.current) {
      if (pose === 'write') {
        armR.current.rotation.set(1.05 + Math.sin(t * 9) * 0.07, 0, -0.15 + Math.sin(t * 13) * 0.08);
        armL.current.rotation.set(0.9, 0, 0.25);
      } else if (pose === 'sit') {
        armR.current.rotation.set(0.7, 0, -0.1);
        armL.current.rotation.set(0.7, 0, 0.1);
      } else if (pose === 'mourn') {
        armR.current.rotation.set(1.9, 0, 0.5);
        armL.current.rotation.set(1.9, 0, -0.5);
      } else {
        armR.current.rotation.set(0.15 + Math.sin(t * 1.1) * 0.1, 0, -0.25);
        armL.current.rotation.set(0.15 + Math.sin(t * 1.1 + 1) * 0.1, 0, 0.25);
      }
    }
    // clignement : les yeux se ferment brièvement toutes les quelques secondes
    if (eyes.current) eyes.current.scale.y = (t % 4.3) < 0.12 ? 0.1 : 1;
  });

  return (
    <group scale={scale}>
      <group ref={root}>
        <mesh geometry={robeGeo} material={robe} />
        <mesh position={[0, 0.15, 0]} material={body}>
          <capsuleGeometry args={[0.2, 0.6, 6, 16]} />
        </mesh>

        <group ref={head} position={[0, 0.98, 0]}>
          <mesh position={[0, 0.14, 0.02]} scale={[1, 1.12, 1.08]} material={hood}>
            <sphereGeometry args={[0.28, 28, 20]} />
          </mesh>
          {/* pointe de la capuche, tombant vers l'arrière */}
          <mesh position={[0, 0.3, 0.2]} rotation={[0.9, 0, 0]} material={hood}>
            <coneGeometry args={[0.16, 0.42, 16, 1, true]} />
          </mesh>
          {/* visage : un vide noir */}
          <mesh position={[0, 0.11, -0.09]} scale={[1, 1.15, 0.9]} material={voidMat}>
            <sphereGeometry args={[0.2, 20, 16]} />
          </mesh>
          <group ref={eyes} position={[0, 0.13, -0.26]}>
            {[-0.075, 0.075].map((x) => (
              <mesh key={x} position={[x, 0, 0]} material={eyeMat} scale={[1, 0.7, 1]}>
                <sphereGeometry args={[0.032, 10, 8]} />
              </mesh>
            ))}
          </group>
        </group>

        {[
          [armL, -0.33],
          [armR, 0.33],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0.66, 0]}>
            <mesh geometry={sleeveGeo} material={robe} />
            <mesh position={[0, -0.66, 0]} material={hood}>
              <sphereGeometry args={[0.06, 10, 8]} />
            </mesh>
            {x === 0.33 && pose === 'write' && (
              <group position={[0, -0.68, -0.02]} rotation={[0.6, 0, 0]}>
                <mesh position={[0, 0.12, 0]} material={hood}>
                  <cylinderGeometry args={[0.006, 0.01, 0.3, 6]} />
                </mesh>
                <mesh position={[0, 0.28, 0]} rotation={[0, 0, 0.2]} material={hood}>
                  <coneGeometry args={[0.04, 0.24, 6, 1, true]} />
                </mesh>
              </group>
            )}
          </group>
        ))}

        <Sparkles count={14} scale={[1.4, 2.2, 1.4]} position={[0, 0.2, 0]} size={2.2} speed={0.35} color={color} opacity={0.8} />
      </group>
    </group>
  );
}
