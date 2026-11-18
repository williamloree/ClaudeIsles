// Les anciens agents et anciennes tâches : de petits dirigeables qui croisent au large de l'archipel,
// sur les voies communes. Leur lanterne et leur bandeau portent la couleur du statut.
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR } from '../../format';
import { laneFor, laneIndex, lanePoint, setLivePosition, type Boat } from '../../scene/boats';
import { BoatLabel, selectKey } from '../../scene/labels';
import { useStore } from '../../store';
import { MAT, bulbMaterial, glowMaterial } from './materials';

const SCALE = 1.15; // visible depuis la vue d'ensemble sans masquer les îles

const envelopeGeo = new THREE.SphereGeometry(1, 28, 16);
const finGeo = new THREE.BoxGeometry(0.05, 0.7, 0.9).translate(0, 0.75, 0); // part de l'axe vers l'extérieur
const gondolaGeo = new THREE.BoxGeometry(0.6, 0.4, 1.5);
const bandGeo = new THREE.TorusGeometry(1.01, 0.06, 6, 40);
const bladeGeo = new THREE.BoxGeometry(0.06, 0.9, 0.04);
const strutGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4);

function Airship({ boat, index, selected }: { boat: Boat; index: number; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const lane = useMemo(() => laneFor(index), [index]);
  const color = STATUS_COLOR[boat.status];
  // chaque dirigeable a son altitude de croisière, sous la hauteur des montgolfières
  const alt = 7 + (index % 5) * 1.6;
  const bandMat = useMemo(() => bulbMaterial(color, 1.1), [color]);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (!ref.current) return;
    lanePoint(lane, t, a);
    lanePoint(lane, t + 0.5, b);
    const heading = Math.atan2(a.x - b.x, a.z - b.z);
    const y = alt + Math.sin(t * 0.6 + index) * 0.4;
    ref.current.position.set(a.x, y, a.z);
    ref.current.rotation.set(Math.sin(t * 0.5 + index) * 0.03, heading, Math.sin(t * 0.7 + index) * 0.04);
    if (prop.current) prop.current.rotation.z += dt * 12;
    setLivePosition(boat.key, a.x, y + 1, a.z);
  });
  return (
    <group
      ref={ref}
      scale={SCALE}
      onClick={(e) => {
        e.stopPropagation();
        selectKey(boat.key);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
    >
      {/* enveloppe, proue vers -z */}
      <mesh geometry={envelopeGeo} material={MAT.canvas} scale={[1, 1, 3]} position={[0, 1.2, 0]} castShadow />
      <mesh geometry={bandGeo} material={bandMat} position={[0, 1.2, 0]} />
      {/* empennage */}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} geometry={finGeo} material={MAT.wood} position={[0, 1.2, 2.45]} rotation-z={(k * Math.PI) / 2} />
      ))}
      {/* nacelle suspendue */}
      {[-0.5, 0.5].map((z) => (
        <mesh key={z} geometry={strutGeo} material={MAT.rope} position={[0, 0.0, z]} />
      ))}
      <mesh geometry={gondolaGeo} material={MAT.wood} position={[0, -0.45, 0]} castShadow />
      {/* hélice */}
      <group ref={prop} position={[0, -0.45, 0.85]}>
        <mesh geometry={bladeGeo} material={MAT.metal} />
        <mesh geometry={bladeGeo} material={MAT.metal} rotation-z={Math.PI / 2} />
      </group>
      {/* lanterne de proue : la couleur du statut */}
      <mesh position={[0, -0.45, -0.85]} material={bulbMaterial(color)}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      <sprite material={glowMaterial(color)} position={[0, -0.45, -0.85]} scale={[1.1, 1.1, 1]} />
      {(hover || selected) && <BoatLabel boat={boat} selected={selected} position={[0, 3, 0]} />}
    </group>
  );
}

export function Airships({ boats }: { boats: Boat[] }) {
  const selection = useStore((s) => s.selection);
  const selKey = selection ? `${selection.kind}:${selection.id}` : null;
  return (
    <>
      {boats.map((b) => (
        <Airship key={b.key} boat={b} index={laneIndex(b.key)} selected={selKey === b.key} />
      ))}
    </>
  );
}
