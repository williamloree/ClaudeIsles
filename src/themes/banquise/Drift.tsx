// Anciens agents : kayaks et glaçons portant une lanterne et un fanion à leur nom, qui dérivent
// lentement dans le chenal au-delà des floes. Survol = étiquette, clic = détail.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR, cut } from '../../format';
import { laneFor, laneIndex, lanePoint, setLivePosition, type Boat } from '../../scene/boats';
import { BoatLabel, selectKey } from '../../scene/labels';
import { useStore } from '../../store';
import { Lantern } from './Fire';
import { moundGeo } from './Floe';
import { MAT, glowTex } from './materials';

const SCALE = 2.2; // assez grand pour être vu depuis la vue d'ensemble

const hullGeo = new THREE.SphereGeometry(1, 20, 10);
const cockpitGeo = new THREE.TorusGeometry(0.26, 0.05, 6, 16);
const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.4, 5);
const bladeGeo = new THREE.BoxGeometry(0.42, 0.02, 0.16);
const floeGeo = new THREE.DodecahedronGeometry(1.1, 0);
const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4);
const penGeo = new THREE.PlaneGeometry(1.4, 0.35);
const poolGeo = new THREE.PlaneGeometry(5, 5);
const HULLS = [0x8a3a22, 0x2c5a6e, 0x6e5a2a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));

function drawPennant(ctx: CanvasRenderingContext2D, name: string) {
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = '#e9dfc6';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(256, 10);
  ctx.lineTo(240, 32);
  ctx.lineTo(256, 54);
  ctx.lineTo(0, 64);
  ctx.fill();
  ctx.fillStyle = '#26323e';
  ctx.font = '600 19px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(cut(name, 22), 10, 33);
}

function Drifter({ boat, index, selected }: { boat: Boat; index: number; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pen = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const lane = useMemo(() => laneFor(index), [index]);
  const kayak = index % 2 === 0;
  const color = STATUS_COLOR[boat.status];
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 256, height: 64 }), []);
  const penMat = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7, side: THREE.DoubleSide, transparent: true, alphaMap: t, alphaTest: 0.1 });
  }, [canvas]);
  const poolMat = useMemo(() => new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }), [color]);
  useEffect(
    () => () => {
      penMat.emissiveMap?.dispose();
      penMat.dispose();
    },
    [penMat],
  );
  useEffect(() => () => poolMat.dispose(), [poolMat]);
  useEffect(() => {
    drawPennant(canvas.getContext('2d')!, boat.title);
    penMat.emissiveMap!.needsUpdate = true;
  }, [canvas, penMat, boat.title]);

  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!ref.current) return;
    lanePoint(lane, t, a);
    lanePoint(lane, t + 0.5, b);
    const heading = Math.atan2(a.x - b.x, a.z - b.z); // la proue (-z) suit la voie
    ref.current.position.set(a.x, Math.sin(t * 1.1 + index) * 0.05, a.z);
    ref.current.rotation.set(Math.sin(t * 0.7 + index) * 0.02, heading, Math.sin(t * 0.9 + index) * 0.04);
    if (pen.current) pen.current.rotation.y = Math.sin(t * 3 + index) * 0.25; // le fanion claque au vent
    setLivePosition(boat.key, a.x, 1.5, a.z);
  });

  const poleZ = kayak ? -1.5 : -0.5;
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
      {kayak ? (
        <>
          <mesh geometry={hullGeo} material={HULLS[index % 3]} scale={[0.42, 0.22, 2.4]} position={[0, 0.08, 0]} castShadow />
          <mesh geometry={cockpitGeo} material={MAT.dark} rotation-x={Math.PI / 2} position={[0, 0.28, 0]} />
          <group position={[0, 0.32, -0.5]} rotation-y={0.3}>
            <mesh geometry={shaftGeo} material={MAT.wood} rotation-z={Math.PI / 2} />
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={bladeGeo} material={MAT.wood} position={[s * 1.25, 0, 0]} />
            ))}
          </group>
        </>
      ) : (
        <>
          <mesh geometry={floeGeo} material={MAT.facet} scale={[1.2, 0.5, 1]} position={[0, 0.1, 0]} castShadow />
          <mesh geometry={moundGeo} material={MAT.snow} scale={[0.7, 0.3, 0.7]} position={[0, 0.5, 0]} />
        </>
      )}
      <group position={[0, kayak ? 0.2 : 0.62, kayak ? 1.6 : 0]}>
        <Lantern color={color} post={false} scale={1.3} glow={boat.status === 'stale' ? 0.7 : 1} />
      </group>
      <mesh geometry={poleGeo} material={MAT.wood} position={[0.15, 0.85, poleZ]} />
      <mesh ref={pen} geometry={penGeo} material={penMat} position={[0.86, 1.4, poleZ]} />
      {/* reflet chaud de la lanterne sur l'eau */}
      <mesh geometry={poolGeo} material={poolMat} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]} renderOrder={1} />
      {(hover || selected) && <BoatLabel boat={boat} selected={selected} position={[0, 2.2, 0]} />}
    </group>
  );
}

export function Drift({ boats }: { boats: Boat[] }) {
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
