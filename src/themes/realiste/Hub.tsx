// Le hub : grande île centrale, place de pierre et observatoire de verre ; Claude est le noyau
// incandescent au centre de la coupole, entouré de deux anneaux d'or.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HubLabel, clickable, openHub } from '../../scene/labels';
import { ISLET_TOP } from '../../scene/slots';
import { useStore } from '../../store';
import { Island } from './Island';
import { islandTemplate } from './islands';
import { MAT, bulbMaterial, glowMaterial } from './materials';

const BASE = ISLET_TOP + 0.3; // dessus de la place
const CORE_Y = BASE + 2.8;

const domeMat = new THREE.MeshStandardMaterial({ color: 0xdfeefa, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.6 });
const ribGeo = new THREE.TorusGeometry(5.22, 0.05, 6, 48, Math.PI);
const lampMat = bulbMaterial('#ffd59a', 1.6);

/** Réverbère au bord de la place. */
function Lamp() {
  return (
    <group>
      <mesh position={[0, 1.2, 0]} material={MAT.metal} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 2.4, 8]} />
      </mesh>
      <mesh position={[0, 2.5, 0]} material={lampMat}>
        <sphereGeometry args={[0.16, 12, 10]} />
      </mesh>
      <mesh position={[0, 2.68, 0]} material={MAT.metal}>
        <coneGeometry args={[0.24, 0.18, 10]} />
      </mesh>
      <sprite material={glowMaterial('#ffc78a', 0.5)} position={[0, 2.5, 0]} scale={[1.2, 1.2, 1]} />
    </group>
  );
}

export function Hub() {
  const busy = useStore((s) => s.hub.busy);
  const core = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const orbits = useRef<THREE.Group>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (core.current) {
      core.current.rotation.y += dt * (busy ? 1.6 : 0.3);
      core.current.scale.setScalar(1 + Math.sin(t * (busy ? 6 : 2)) * (busy ? 0.07 : 0.03));
    }
    if (coreMat.current) coreMat.current.emissiveIntensity = busy ? 4.5 + Math.sin(t * 9) * 1.2 : 3.2;
    if (light.current) light.current.intensity = busy ? 85 + Math.sin(t * 9) * 15 : 55 + Math.sin(t * 3) * 8;
    orbits.current?.children.forEach((o, i) => (o.rotation.y += dt * (i ? -0.4 : 0.3) * (busy ? 4 : 1)));
  });

  return (
    <Island template={islandTemplate(-1)} position={[0, 0, 0]} onClick={openHub}>
      {/* place de pierre */}
      <mesh position={[0, ISLET_TOP + 0.05, 0]} material={MAT.stone} castShadow receiveShadow>
        <cylinderGeometry args={[8, 8.3, 0.5, 64]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return (
          <group key={i} position={[Math.cos(a) * 7.5, BASE, Math.sin(a) * 7.5]}>
            <Lamp />
          </group>
        );
      })}

      <group {...clickable(openHub)}>
        {/* observatoire : socle d'acier, coupole de verre, nervures */}
        <mesh rotation-x={Math.PI / 2} position={[0, BASE + 0.1, 0]} material={MAT.metal}>
          <torusGeometry args={[5.2, 0.12, 12, 96]} />
        </mesh>
        <mesh position={[0, BASE, 0]} material={domeMat}>
          <sphereGeometry args={[5.2, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} geometry={ribGeo} material={MAT.metal} position={[0, BASE, 0]} rotation-y={(i / 8) * Math.PI} />
        ))}
        <mesh position={[0, BASE + 5.3, 0]} material={MAT.metal}>
          <cylinderGeometry args={[0.35, 0.5, 0.3, 16]} />
        </mesh>
        {/* piédestal et noyau */}
        <mesh position={[0, BASE + 0.45, 0]} material={MAT.metal} castShadow>
          <cylinderGeometry args={[0.7, 1, 0.9, 24]} />
        </mesh>
        <mesh ref={core} position={[0, CORE_Y, 0]}>
          <icosahedronGeometry args={[1.6, 6]} />
          <meshStandardMaterial ref={coreMat} color="#331100" emissive="#ff7a3d" emissiveIntensity={3.2} roughness={0.3} />
        </mesh>
        <sprite material={glowMaterial('#ff8a4d', busy ? 0.55 : 0.35)} position={[0, CORE_Y, 0]} scale={[7, 7, 1]} />
        <group ref={orbits} position={[0, CORE_Y, 0]}>
          {/* anneaux inclinés qui tournent autour de la verticale */}
          {[2.3, 2.8].map((r, i) => (
            <group key={r}>
              <mesh material={MAT.gold} rotation-x={Math.PI / 2 + (i ? 0.4 : -0.4)}>
                <torusGeometry args={[r, 0.03, 8, 128]} />
              </mesh>
            </group>
          ))}
        </group>
        <pointLight ref={light} color="#ff8a4d" intensity={55} distance={40} decay={1.6} position={[0, CORE_Y, 0]} />
      </group>

      {/* au-dessus des étiquettes des écrans de la place */}
      <HubLabel position={[0, BASE + 12, 0]} />
    </Island>
  );
}
