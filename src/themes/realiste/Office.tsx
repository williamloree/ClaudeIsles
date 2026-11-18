// Sur chaque île : un bureau en plein air, un écran où s'affiche l'activité réelle de l'agent,
// et l'agent lui-même, assis, qui tape quand il travaille. Une balise (fanion + lanterne) donne le statut de loin.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorkerInfo } from '../../scene/info';
import { WorkerLabel, clickable, drawActivity } from '../../scene/labels';
import { MAT, SHIRTS, bulbMaterial, glowMaterial } from './materials';

const OFFICE_SCALE = 1.3; // un peu plus grand que nature : lisible depuis la vue d'ensemble

const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.74, 8);
const torsoGeo = new THREE.CapsuleGeometry(0.2, 0.42, 6, 14);
const headGeo = new THREE.SphereGeometry(0.15, 24, 16);
const hairGeo = new THREE.SphereGeometry(0.155, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const thighGeo = new THREE.CapsuleGeometry(0.075, 0.38, 4, 8);
const shinGeo = new THREE.CapsuleGeometry(0.065, 0.42, 4, 8);
const armGeo = new THREE.CapsuleGeometry(0.06, 0.45, 4, 8);
const flagGeo = new THREE.PlaneGeometry(1, 0.6, 8, 1);
flagGeo.translate(0.5, 0, 0);

/** Balise de statut : mât, fanion qui flotte au vent, lanterne au sommet. */
function Beacon({ color, running }: { color: string; running: boolean }) {
  const flag = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);
  const flagMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.25 }), [color]);
  useEffect(() => () => flagMat.dispose(), [flagMat]);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (flag.current) flag.current.rotation.y = Math.sin(t * 1.7) * 0.35 + Math.sin(t * 4.3) * 0.08;
    if (glow.current) glow.current.scale.setScalar(running ? 1.6 + Math.sin(t * 4) * 0.35 : 1.3);
  });
  return (
    <group>
      <mesh position={[0, 1.7, 0]} material={MAT.wood} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 3.4, 8]} />
      </mesh>
      <mesh ref={flag} position={[0.04, 2.95, 0]} geometry={flagGeo} material={flagMat} castShadow />
      <mesh position={[0, 3.5, 0]} material={MAT.metal}>
        <cylinderGeometry args={[0.13, 0.1, 0.06, 10]} />
      </mesh>
      <mesh position={[0, 3.62, 0]} material={bulbMaterial(color)}>
        <sphereGeometry args={[0.11, 12, 10]} />
      </mesh>
      <sprite ref={glow} material={glowMaterial(color)} position={[0, 3.62, 0]} />
    </group>
  );
}

export function Office({ info }: { info: WorkerInfo }) {
  const color = info.color;
  const running = info.status === 'running';
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 300 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const minute = Math.floor(Date.now() / 60e3);
  useEffect(() => {
    drawActivity(canvas.getContext('2d')!, info, {
      bg: '#0d1117',
      border: '#30363d',
      title: color,
      text: '#e6edf3',
      dim: '#8b949e',
      titleFont: '700 24px Inter, sans-serif',
      font: "17px 'JetBrains Mono', Consolas, monospace",
    });
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.title, info.recent.join('\n'), info.status, info.toolUses, minute]);

  const body = useRef<THREE.Group>(null);
  const arms = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + info.seed;
    arms.current?.children.forEach((p, i) => (p.rotation.x = running ? -0.25 + Math.sin(t * 14 + i * 1.6) * 0.06 : 0.4));
    // penché sur l'écran s'il travaille, tête basse s'il a échoué, adossé s'il a fini
    if (body.current) body.current.rotation.x = running ? 0.1 : info.status === 'failed' ? 0.25 : -0.12;
  });
  const shirt = SHIRTS[info.seed % SHIRTS.length];

  return (
    <group {...clickable(info.onClick)}>
      <group scale={OFFICE_SCALE}>
        {/* bureau */}
        <mesh position={[0, 0.76, -0.55]} material={MAT.wood} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.07, 1.1]} />
        </mesh>
        {[
          [-1.1, -0.1],
          [1.1, -0.1],
          [-1.1, -1],
          [1.1, -1],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={legGeo} material={MAT.metal} position={[x, 0.38, z]} castShadow />
        ))}
        {/* écran : l'activité de l'agent */}
        <mesh position={[0, 1.38, -0.88]} material={MAT.dark} castShadow>
          <boxGeometry args={[1.25, 0.75, 0.05]} />
        </mesh>
        <mesh position={[0, 1.38, -0.853]}>
          <planeGeometry args={[1.17, 0.67]} />
          <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={texture} emissiveIntensity={running ? 1.5 : 1.1} />
        </mesh>
        <mesh position={[0, 0.94, -0.9]} material={MAT.metal}>
          <cylinderGeometry args={[0.03, 0.05, 0.3, 8]} />
        </mesh>
        <mesh position={[0, 0.81, -0.32]} material={MAT.dark}>
          <boxGeometry args={[0.75, 0.025, 0.24]} />
        </mesh>
        <mesh position={[0.8, 0.85, -0.4]} material={MAT.mug}>
          <cylinderGeometry args={[0.05, 0.045, 0.11, 16]} />
        </mesh>
        {/* fauteuil */}
        <mesh position={[0, 0.5, 0.45]} material={MAT.dark} castShadow>
          <boxGeometry args={[0.6, 0.08, 0.6]} />
        </mesh>
        <mesh position={[0, 0.92, 0.78]} material={MAT.dark} castShadow>
          <boxGeometry args={[0.6, 0.75, 0.07]} />
        </mesh>
        <mesh position={[0, 0.26, 0.45]} material={MAT.metal}>
          <cylinderGeometry args={[0.04, 0.04, 0.42, 8]} />
        </mesh>
        {/* l'agent, assis */}
        <group ref={body} position={[0, 0.55, 0.45]}>
          <mesh geometry={torsoGeo} material={shirt} position={[0, 0.42, 0.02]} castShadow />
          <mesh geometry={headGeo} material={MAT.skin} position={[0, 0.92, -0.02]} castShadow />
          <mesh geometry={hairGeo} material={MAT.hair} position={[0, 0.94, 0]} rotation-x={0.35} />
          {[-0.1, 0.1].map((x) => (
            <group key={x}>
              <mesh geometry={thighGeo} material={MAT.pants} position={[x, 0.02, -0.2]} rotation-x={Math.PI / 2} castShadow />
              <mesh geometry={shinGeo} material={MAT.pants} position={[x, -0.25, -0.42]} castShadow />
            </group>
          ))}
          <group ref={arms}>
            {[-0.27, 0.27].map((x) => (
              <group key={x} position={[x, 0.6, 0]}>
                <mesh geometry={armGeo} material={shirt} position={[0, -0.1, -0.2]} rotation-x={Math.PI / 2.4} castShadow />
              </group>
            ))}
          </group>
        </group>
      </group>

      <group position={[2.6, 0, 0.9]}>
        <Beacon color={color} running={running} />
      </group>

      {info.selected && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
          <ringGeometry args={[3.1, 3.35, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} />
        </mesh>
      )}

      <WorkerLabel info={info} position={[0, 4.8, 0]} />
    </group>
  );
}
