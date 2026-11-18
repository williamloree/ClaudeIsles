// Flammes en sprites additifs (le bloom fait le halo) ; une vraie lumière seulement si demandé.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAT, flameTex } from './materials';

export function Fire({ color, scale = 1, light = 0 }: { color: string; scale?: number; light?: number }) {
  const group = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const mats = useMemo(
    () =>
      [0, 1, 2, 3].map(
        (i) =>
          new THREE.SpriteMaterial({
            map: flameTex,
            color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), i === 3 ? 0.6 : 0),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
          }),
      ),
    [color],
  );
  const seed = useMemo(() => Math.random() * 100, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    group.current?.children.forEach((s, i) => {
      if (!(s as THREE.Sprite).isSprite) return;
      const base = scale * (i === 3 ? 0.55 : 1 - i * 0.12);
      const k = base * (0.85 + Math.sin(t * 9 + i * 1.7) * 0.1 + Math.sin(t * 23 + i) * 0.05);
      s.scale.set(k * 0.8, k * 1.6, 1);
      s.position.x = Math.sin(t * 5 + i) * 0.05 * scale;
    });
    if (lamp.current) lamp.current.intensity = light * (0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 27) * 0.05);
  });
  return (
    <group ref={group}>
      {mats.map((m, i) => (
        <sprite key={i} material={m} position={[0, 0.5 * scale, 0]} />
      ))}
      {light > 0 && <pointLight ref={lamp} color={color} intensity={light} distance={22 * scale} decay={1.6} position={[0, 0.8 * scale, 0]} />}
    </group>
  );
}

export function Brazier({ color, scale = 1, light = 0 }: { color: string; scale?: number; light?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.65, 0]} material={MAT.bronze} castShadow>
        <cylinderGeometry args={[0.08, 0.14, 1.3, 8]} />
      </mesh>
      <mesh position={[0, 0.06, 0]} material={MAT.bronze}>
        <cylinderGeometry args={[0.35, 0.42, 0.12, 12]} />
      </mesh>
      <mesh position={[0, 1.55, 0]} material={MAT.bronze} castShadow>
        <sphereGeometry args={[0.55, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <group position={[0, 1.5, 0]}>
        <Fire color={color} light={light} />
      </group>
    </group>
  );
}
