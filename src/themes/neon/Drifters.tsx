// Anciens agents : vedettes à néons qui glissent sur l'eau noire, ou drones qui patrouillent
// au-dessus, sur les voies communes. Leur néon garde la couleur du statut final.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR } from '../../format';
import { laneFor, laneIndex, lanePoint, setLivePosition, type Boat } from '../../scene/boats';
import { BoatLabel, selectKey } from '../../scene/labels';
import { useStore } from '../../store';
import { CYAN, MAT, beamMat, glowMaterial, glowTex, neon } from './materials';

const SCALE = 1.6; // assez grand pour être vu depuis la vue d'ensemble
const DRONE_Y = 12;

// ---------- Vedette ----------
const hullGeo = (() => {
  const sh = new THREE.Shape([new THREE.Vector2(-0.9, -2.2), new THREE.Vector2(0.9, -2.2), new THREE.Vector2(0.9, 1.2), new THREE.Vector2(0, 2.4), new THREE.Vector2(-0.9, 1.2)]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(0, 0.45, 0); // proue vers +z
  return g;
})();
const edgesGeo = new THREE.EdgesGeometry(hullGeo, 20);
const cabinGeo = new THREE.BoxGeometry(1.2, 0.8, 1.4);
const winGeo = new THREE.BoxGeometry(1.22, 0.18, 1.0);
const mastGeo = new THREE.CylinderGeometry(0.04, 0.04, 2, 5);
const planeGeo = new THREE.PlaneGeometry(1, 1);

const lineCache = new Map<string, THREE.LineBasicMaterial>();
const edgeMat = (color: string) => {
  let m = lineCache.get(color);
  if (!m) lineCache.set(color, (m = new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) })));
  return m;
};

function Speedboat({ color, glow }: { color: string; glow: THREE.SpriteMaterial }) {
  return (
    <group>
      <mesh geometry={hullGeo} material={MAT.dark} />
      <lineSegments geometry={edgesGeo} material={edgeMat(color)} />
      <mesh geometry={cabinGeo} material={MAT.metal} position={[0, 0.85, -0.6]} />
      <mesh geometry={winGeo} material={neon(CYAN, 1.6)} position={[0, 0.95, -0.6]} />
      <mesh geometry={mastGeo} material={MAT.metal} position={[0, 1.9, -1]} />
      <sprite material={glow} position={[0, 2.9, -1]} scale={1.6} />
    </group>
  );
}

// ---------- Drone ----------
const droneBodyGeo = new THREE.BoxGeometry(1.2, 0.35, 1.2);
const droneArmGeo = new THREE.BoxGeometry(1.5, 0.1, 0.15);
const rotorGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.02, 20);
const tipGeo = new THREE.SphereGeometry(0.08, 8, 6);
const underGeo = new THREE.TorusGeometry(0.5, 0.04, 6, 32);
const droneBeamGeo = new THREE.CylinderGeometry(2.2, 0.3, 10, 24, 1, true).translate(0, 5, 0);
const rotorMat = new THREE.MeshBasicMaterial({ color: 0x9aa8c0, transparent: true, opacity: 0.25, depthWrite: false });
const ARMS = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);

function Drone({ color }: { color: string }) {
  const rotors = useRef<THREE.Group>(null);
  useFrame((_, dt) => rotors.current?.children.forEach((r) => (r.rotation.y += dt * 30)));
  return (
    <group>
      <mesh geometry={droneBodyGeo} material={MAT.metal} />
      {ARMS.map((a, k) => (
        <group key={k}>
          <mesh geometry={droneArmGeo} material={MAT.dark} position={[Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75]} rotation-y={-a} />
          <mesh geometry={tipGeo} material={neon(k < 2 ? '#3cff8f' : '#ff2a2a', 2.5)} position={[Math.cos(a) * 1.45, -0.05, Math.sin(a) * 1.45]} />
        </group>
      ))}
      <group ref={rotors}>
        {ARMS.map((a, k) => (
          <mesh key={k} geometry={rotorGeo} material={rotorMat} position={[Math.cos(a) * 1.45, 0.18, Math.sin(a) * 1.45]} />
        ))}
      </group>
      <mesh geometry={underGeo} material={neon(color, 2.6)} rotation-x={Math.PI / 2} position-y={-0.2} />
      {/* pinceau de lumière vers l'eau */}
      <mesh geometry={droneBeamGeo} material={beamMat(color, 0.15)} rotation-x={Math.PI} position-y={-0.2} />
    </group>
  );
}

function Drifter({ boat, index, selected }: { boat: Boat; index: number; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const below = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const lane = useMemo(() => laneFor(index), [index]);
  const drone = index % 3 === 1;
  const color = STATUS_COLOR[boat.status];
  const glow = useMemo(() => glowMaterial(color, 1), [color]);
  // reflet du néon sur l'eau noire
  const pool = useMemo(() => new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), [color]);
  useEffect(() => () => (glow.dispose(), pool.dispose()), [glow, pool]);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!ref.current) return;
    lanePoint(lane, t, a);
    lanePoint(lane, t + 0.5, b);
    const y = drone ? DRONE_Y + Math.sin(t * 0.9 + index) * 1.2 : Math.sin(t * 1.3 + index) * 0.08;
    ref.current.position.set(a.x, y, a.z);
    ref.current.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z), drone ? Math.sin(t * 0.7 + index) * 0.05 : Math.sin(t * 1.1 + index) * 0.04);
    if (below.current) {
      below.current.position.set(a.x, 0.06, a.z);
      below.current.rotation.z = ref.current.rotation.y;
    }
    setLivePosition(boat.key, a.x, y + 1, a.z);
  });
  return (
    <>
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
        {drone ? <Drone color={color} /> : <Speedboat color={color} glow={glow} />}
        {selected && <mesh geometry={underGeo} material={neon(color, 2.4)} rotation-x={Math.PI / 2} scale={drone ? 4 : 6} position-y={drone ? -0.4 : 0.05} />}
        {(hover || selected) && <BoatLabel boat={boat} selected={selected} position={[0, drone ? 1.8 : 3.8, 0]} />}
      </group>
      <mesh ref={below} geometry={planeGeo} material={pool} rotation-x={-Math.PI / 2} scale={drone ? [7, 7, 1] : [5, 11, 1]} />
    </>
  );
}

export function Drifters({ boats }: { boats: Boat[] }) {
  const selection = useStore((s) => s.selection);
  const selKey = selection ? `${selection.kind}:${selection.id}` : null;
  return (
    <>
      {boats.map((b) => (
        <Drifter key={b.key} boat={b} index={laneIndex(b.key)} selected={selKey === b.key} />
      ))}
    </>
  );
}
