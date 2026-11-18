// Anciens agents : petits sous-marins et cloches de plongée qui dérivent autour de la cité, phares
// allumés, en laissant un chapelet de bulles. Les hublots et la vigie prennent la couleur du statut.
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR } from '../../format';
import { laneFor, laneIndex, lanePoint, setLivePosition, type Boat, type Lane } from '../../scene/boats';
import { BoatLabel, selectKey } from '../../scene/labels';
import { MAT, bubbleTex, glowTex, oceanMat, rayMat } from './materials';

const SCALE = 1.5; // assez grand pour être vu depuis la vue d'ensemble
const HULLS = [0x8a5a2b, 0x56636b, 0x6b4a5a, 0x3f5a52].map((c) => oceanMat({ color: c, metalness: 0.5, roughness: 0.55 }, { caustics: 0.6 }));
const beamMat = rayMat(0xffe9b8, 0.5, 1);
const portMats = new Map<string, THREE.MeshStandardMaterial>();
const portMat = (color: string) => {
  let m = portMats.get(color);
  if (!m) portMats.set(color, (m = new THREE.MeshStandardMaterial({ color: 0, emissive: color, emissiveIntensity: 1.6 })));
  return m;
};
const beaconMats = new Map<string, THREE.SpriteMaterial>();
const beaconMat = (color: string) => {
  let m = beaconMats.get(color);
  if (!m) beaconMats.set(color, (m = new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  return m;
};
const chainGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 60, 0)]);
const chainMat = new THREE.LineBasicMaterial({ color: 0x2c3a3c, transparent: true, opacity: 0.6 });
const trailMat = new THREE.SpriteMaterial({ map: bubbleTex, color: 0xdff8ff, transparent: true, opacity: 0.7, depthWrite: false });

const G = {
  body: new THREE.CapsuleGeometry(0.9, 2.6, 8, 20),
  tower: new THREE.BoxGeometry(0.7, 0.8, 1.1),
  finH: new THREE.BoxGeometry(2.4, 0.08, 0.5),
  finV: new THREE.BoxGeometry(0.08, 1.3, 0.5),
  blade: new THREE.BoxGeometry(0.14, 0.75, 0.04),
  port: new THREE.CircleGeometry(0.16, 16),
  nose: new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  beam: new THREE.ConeGeometry(2, 9, 24, 1, true),
  bell: new THREE.LatheGeometry(
    [
      [0, 1.6],
      [0.5, 1.6],
      [0.9, 1.4],
      [1.2, 0.9],
      [1.35, 0.2],
      [1.5, -0.6],
      [1.6, -0.8],
      [1.45, -0.8],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    32,
  ),
  bellPort: new THREE.CircleGeometry(0.22, 16),
};

function Submarine({ hull, color, prop }: { hull: THREE.Material; color: string; prop: React.RefObject<THREE.Group | null> }) {
  const port = portMat(color);
  return (
    <group>
      <mesh geometry={G.body} material={hull} rotation-x={Math.PI / 2} castShadow />
      <mesh geometry={G.tower} material={hull} position={[0, 0.95, 0.2]} castShadow />
      <mesh geometry={G.finH} material={hull} position={[0, 0, -1.9]} />
      <mesh geometry={G.finV} material={hull} position={[0, 0, -1.9]} />
      <group ref={prop} position={[0, 0, -2.35]}>
        {[0, 1, 2].map((k) => (
          <group key={k} rotation-z={(k / 3) * Math.PI * 2}>
            <mesh geometry={G.blade} material={MAT.brass} position={[0, 0.32, 0]} />
          </group>
        ))}
      </group>
      {[-1, 1].flatMap((s) =>
        [0, 1, 2].map((k) => <mesh key={`${s}${k}`} geometry={G.port} material={port} position={[s * 0.91, 0.1, -0.6 + k * 0.7]} rotation-y={(s * Math.PI) / 2} />),
      )}
      <mesh geometry={G.nose} material={MAT.port} position={[0, 0, 2.05]} rotation-x={Math.PI / 2} />
      {/* phare : un cône de lumière devant le nez */}
      <mesh geometry={G.beam} material={beamMat} position={[0, 0, 6.7]} rotation-x={-Math.PI / 2} />
      <sprite material={beaconMat(color)} position={[0, 1.6, 0.2]} scale={0.9} />
    </group>
  );
}

function DivingBell({ color }: { color: string }) {
  const port = portMat(color);
  // la chaîne ne capte pas le survol (sinon toute la colonne d'eau au-dessus serait cliquable)
  const chain = useMemo(() => Object.assign(new THREE.Line(chainGeo, chainMat), { raycast: () => {} }), []);
  return (
    <group>
      <mesh geometry={G.bell} material={MAT.brass} castShadow />
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2;
        return <mesh key={k} geometry={G.bellPort} material={port} position={[Math.cos(a) * 1.39, 0.3, Math.sin(a) * 1.39]} rotation-y={Math.PI / 2 - a} />;
      })}
      {/* chaîne qui remonte vers un navire invisible, là-haut */}
      <primitive object={chain} />
      <sprite material={beaconMat(color)} position={[0, -0.7, 0]} scale={1.6} />
    </group>
  );
}

/** Chapelet de bulles laissé derrière soi. */
function Trail({ lane, y }: { lane: Lane; y: number }) {
  const group = useRef<THREE.Group>(null);
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((s, k) => {
      const age = (t * 0.6 + k / 8) % 1;
      lanePoint(lane, t - 0.4 - age * 5, p);
      s.position.set(p.x + Math.sin(t * 2 + k) * 0.3, y + age * 2.5, p.z);
      s.scale.setScalar(0.25 + age * 0.35);
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 8 }, (_, k) => (
        <sprite key={k} material={trailMat} />
      ))}
    </group>
  );
}

function Vessel({ boat, index, selected }: { boat: Boat; index: number; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const lane = useMemo(() => laneFor(index), [index]);
  const bell = index % 3 === 2;
  const alt = 14 + (index % 3) * 3.5;
  const color = STATUS_COLOR[boat.status];
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    lanePoint(lane, t, a);
    lanePoint(lane, t + 0.5, b);
    const y = alt + Math.sin(t * 0.5 + index) * 0.6;
    g.position.set(a.x, y, a.z);
    if (bell) g.rotation.y += dt * 0.05;
    else g.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z), Math.sin(t * 0.4 + index) * 0.05);
    if (prop.current) prop.current.rotation.z += dt * 4;
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
        {bell ? <DivingBell color={color} /> : <Submarine hull={HULLS[index % HULLS.length]} color={color} prop={prop} />}
        {(hover || selected) && <BoatLabel boat={boat} selected={selected} position={[0, 2.6, 0]} />}
      </group>
      <Trail lane={lane} y={alt} />
    </>
  );
}

export function Vessels({ boats, selectedKey }: { boats: Boat[]; selectedKey: string | null }) {
  return (
    <>
      {boats.map((b) => (
        <Vessel key={b.key} boat={b} index={laneIndex(b.key)} selected={selectedKey === b.key} />
      ))}
    </>
  );
}
