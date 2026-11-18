// Feux en sprites additifs (le bloom fait le halo) et lanterne-tempête dont le verre prend la couleur du statut.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAT, flameTex, glowTex } from './materials';

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
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
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

// géométries partagées de la lanterne
const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6);
const armGeo = new THREE.BoxGeometry(0.62, 0.05, 0.05);
const hookGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 4);
const baseGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.06, 12);
const glassGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.3, 14);
const barGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4);
const capGeo = new THREE.ConeGeometry(0.18, 0.16, 12);
const handleGeo = new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI);

/** Lanterne-tempête, suspendue à une potence de bois (`post`) ou posée. Elle se balance au vent. */
export function Lantern({ color, post = true, scale = 1, light = 0, glow = 1 }: { color: string; post?: boolean; scale?: number; light?: number; glow?: number }) {
  const swing = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: 2.6 }), [color]);
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), [color]);
  useEffect(
    () => () => {
      glass.dispose();
      halo.dispose();
    },
    [glass, halo],
  );
  const ph = useMemo(() => Math.random() * 6, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = Math.sin(t * 11 + ph) * 0.1 + Math.sin(t * 23 + ph * 2) * 0.06;
    glass.emissiveIntensity = (2.4 + f * 2.5) * glow;
    halo.opacity = 0.5 * glow + f * 0.3;
    if (swing.current) swing.current.rotation.z = Math.sin(t * 1.6 + ph) * 0.06;
    if (lamp.current) lamp.current.intensity = light * (0.9 + f);
  });
  return (
    <group>
      {post && (
        <>
          <mesh geometry={poleGeo} material={MAT.wood} position={[0, 1.1, 0]} castShadow />
          <mesh geometry={armGeo} material={MAT.wood} position={[0.28, 2.12, 0]} castShadow />
          <mesh geometry={hookGeo} material={MAT.metal} position={[0.55, 1.99, 0]} />
        </>
      )}
      <group position={post ? [0.55, 1.88, 0] : [0, 0, 0]}>
        {/* pivot au crochet : la lanterne pend et se balance */}
        <group ref={swing}>
          <group position={post ? [0, -0.58, 0] : [0, 0, 0]} scale={scale}>
            <mesh geometry={baseGeo} material={MAT.metal} />
            <mesh geometry={glassGeo} material={glass} position={[0, 0.18, 0]} />
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} geometry={barGeo} material={MAT.metal} position={[Math.cos(k * 1.571 + 0.785) * 0.135, 0.18, Math.sin(k * 1.571 + 0.785) * 0.135]} />
            ))}
            <mesh geometry={capGeo} material={MAT.metal} position={[0, 0.41, 0]} />
            <mesh geometry={handleGeo} material={MAT.metal} position={[0, 0.5, 0]} />
            <sprite material={halo} position={[0, 0.18, 0]} scale={1.3} />
            {light > 0 && <pointLight ref={lamp} color={color} intensity={light} distance={14} decay={1.6} position={[0, 0.2, 0]} />}
          </group>
        </group>
      </group>
    </group>
  );
}
