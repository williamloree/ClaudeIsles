// Un habitat par agent : bulle de verre sur un socle de récif. Dedans, un scaphandrier travaille
// à sa console, où s'affiche son activité réelle ; dehors, une anémone prend la couleur du statut.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorkerInfo } from '../../scene/info';
import { WorkerLabel, clickable, drawActivity } from '../../scene/labels';
import { ISLAND_SLOTS, ISLET_TOP } from '../../scene/slots';
import type { Status } from '../../types';
import { Batch, CORALS, MAT, addCoral, fbm, glowMat, glowTex, ground, kelpForest, mat4, rng } from './materials';

const T = ISLET_TOP;
export const BUBBLE = 5.2;
const ANEMONE_R = 6.4;

/** Angle (repère du monde) d'où arrive le tube : le hub. */
const hubAngle = (slot: number) => Math.atan2(-ISLAND_SLOTS[slot][2], -ISLAND_SLOTS[slot][0]);
const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// Socle de récif et décor de chaque emplacement, calculés à la première occupation puis gardés.
const bases = new Map<number, THREE.Group>();
function baseFor(slot: number) {
  let g = bases.get(slot);
  if (g) return g;
  const r = rng(300 + slot * 17);
  const b = new Batch();
  const reef = new THREE.CylinderGeometry(6.2, 8, 4.2, 56, 5);
  const p = reef.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const a = Math.atan2(p.getZ(j), p.getX(j));
    const y = p.getY(j);
    const k = 1 + fbm(Math.cos(a) * 2 + slot * 3.1, y * 0.3, Math.sin(a) * 2, 5) * 0.35 * (y < 1.6 ? 1 : 0.2);
    p.setX(j, p.getX(j) * k);
    p.setZ(j, p.getZ(j) * k);
  }
  reef.computeVertexNormals();
  b.add(MAT.reef, reef, mat4(0, T - 2.25, 0));
  b.add(MAT.darkMetal, new THREE.CylinderGeometry(5.6, 5.8, 0.3, 48), mat4(0, T - 0.15, 0));
  for (let k = 0; k < 3; k++) b.add(MAT.brass, new THREE.TorusGeometry(BUBBLE, 0.09, 6, 48, Math.PI), mat4(0, T, 0, 0, (k / 3) * Math.PI, 0));
  b.add(MAT.brass, new THREE.TorusGeometry(BUBBLE + 0.05, 0.22, 8, 64), mat4(0, T, 0, Math.PI / 2));
  b.add(MAT.brass, new THREE.CylinderGeometry(0.25, 0.35, 0.6, 10), mat4(0, T + BUBBLE + 0.2, 0));
  // coraux et kelp autour, sauf côté tube et côté anémone
  const [sx, , sz] = ISLAND_SLOTS[slot];
  const toHub = hubAngle(slot);
  const anemone = toHub + Math.PI + 1.2;
  const kelp: [number, number, number, number, number][] = [];
  for (let k = 0; k < 12; k++) {
    const a = r() * Math.PI * 2;
    const d = 7 + r() * 3.5;
    if (angDist(a, toHub) < 0.5 || angDist(a, anemone) < 0.3) {
      r();
      continue;
    }
    const lx = Math.cos(a) * d;
    const lz = Math.sin(a) * d;
    const y = ground(sx + lx, sz + lz) - 0.1;
    if (k % 4 === 0) kelp.push([lx, y, lz, 5 + r() * 4, r() * 6.28]);
    else addCoral(b, k, lx, y, lz, r, 0.8);
  }
  g = b.build();
  if (kelp.length) g.add(kelpForest(kelp));
  bases.set(slot, g);
  return g;
}

const bubbleGeo = new THREE.SphereGeometry(BUBBLE, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);

// ---------- Scaphandrier et console ----------
const G = {
  desk: new THREE.BoxGeometry(2.3, 1, 0.9),
  screen: new THREE.BoxGeometry(2.2, 1.35, 0.1),
  text: new THREE.PlaneGeometry(2.06, 1.24),
  stool: new THREE.CylinderGeometry(0.35, 0.4, 0.55, 12),
  body: new THREE.CapsuleGeometry(0.38, 0.55, 8, 16),
  collar: new THREE.TorusGeometry(0.32, 0.08, 8, 20),
  helmet: new THREE.SphereGeometry(0.4, 24, 16),
  visor: new THREE.CircleGeometry(0.2, 20),
  port: new THREE.CircleGeometry(0.1, 14),
  tank: new THREE.CapsuleGeometry(0.11, 0.55, 4, 10),
  arm: new THREE.CapsuleGeometry(0.1, 0.45, 4, 8),
  ring: new THREE.RingGeometry(6.1, 6.45, 64),
};

function Diver({ status, color, seed }: { status: Status; color: string; seed: number }) {
  const diver = useRef<THREE.Group>(null);
  const helmet = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const visorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0, emissive: color, emissiveIntensity: 1.6 }), [color]);
  useEffect(() => () => visorMat.dispose(), [visorMat]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const run = status === 'running';
    const fail = status === 'failed' || status === 'killed';
    if (diver.current) diver.current.position.y = 0.5 + Math.sin(t * 1.2 + seed) * (run ? 0.04 : 0.1);
    // il tape à la console tant qu'il travaille ; bras ballants et tête basse après un échec
    arms.current.forEach((a, j) => a && (a.rotation.x = run ? Math.sin(t * 7 + j * 2) * 0.18 : fail ? -0.9 : 0.5));
    if (helmet.current) helmet.current.rotation.x = fail ? 0.35 : Math.sin(t * 0.8 + seed) * 0.05;
  });
  return (
    <group ref={diver} position={[0, 0.5, 0.4]}>
      <mesh geometry={G.body} material={MAT.suit} position={[0, 0.55, 0]} castShadow />
      <mesh geometry={G.collar} material={MAT.brass} position={[0, 1.08, 0]} rotation-x={Math.PI / 2} />
      <group ref={helmet} position={[0, 1.42, 0]}>
        <mesh geometry={G.helmet} material={MAT.brass} castShadow />
        <mesh geometry={G.visor} material={visorMat} position={[0, 0, -0.39]} rotation-y={Math.PI} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={G.port} material={visorMat} position={[s * 0.39, 0.02, 0]} rotation-y={(s * Math.PI) / 2} />
        ))}
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={G.tank} material={MAT.brass} position={[s * 0.14, 0.7, 0.4]} />
      ))}
      {[-0.4, 0.4].map((x, j) => (
        <group key={x} ref={(el) => void (arms.current[j] = el)} position={[x, 0.85, 0]}>
          <mesh geometry={G.arm} material={MAT.suit} position={[0, -0.05, -0.28]} rotation-x={Math.PI / 2.3} />
        </group>
      ))}
    </group>
  );
}

function Console({ info }: { info: WorkerInfo }) {
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 310 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const minute = Math.floor(Date.now() / 60e3);
  useEffect(() => {
    const ctx = canvas.getContext('2d')!;
    drawActivity(ctx, info, {
      bg: '#03202a',
      border: info.color,
      title: info.color,
      text: '#c8fbff',
      dim: '#5fb3bf',
      titleFont: '600 25px Georgia, serif',
      font: "18px 'JetBrains Mono', Consolas, monospace",
    });
    // lignes de balayage d'un vieil écran cathodique
    ctx.fillStyle = 'rgba(120,240,255,0.05)';
    for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 1);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.title, info.recent.join('\n'), info.status, info.color, info.toolUses, minute]);

  return (
    <group position={[0, 1.95, -1.25]} rotation-x={-0.18}>
      <mesh geometry={G.screen} material={MAT.darkMetal} castShadow />
      {/* écran des deux côtés : lisible pour le scaphandrier comme pour qui arrive du large */}
      {[0, Math.PI].map((ry) => (
        <mesh key={ry} geometry={G.text} position={[0, 0, ry ? -0.055 : 0.055]} rotation-y={ry}>
          <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={texture} emissiveIntensity={1.25} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Anémone de statut ----------
const tentacles = (() => {
  const r = rng(55);
  return Array.from({ length: 22 }, () => {
    const a = r() * Math.PI * 2;
    const d = r() * 0.38;
    const len = 1.5 * (0.7 + r() * 0.4);
    const geo = new THREE.CylinderGeometry(0.02, 0.07, len, 5, 8);
    geo.translate(0, len / 2, 0);
    return { geo, len, pos: [Math.cos(a) * d, 0.55, Math.sin(a) * d] as [number, number, number], rot: [Math.sin(a) * d * 1.4, 0, -Math.cos(a) * d * 1.4] as [number, number, number] };
  });
})();
const anemoneBase = new THREE.CylinderGeometry(0.45, 0.7, 0.6, 12);
const tipGeo = new THREE.SphereGeometry(0.05, 6, 4);

function Anemone({ color, status }: { color: string; status: Status }) {
  const light = useRef<THREE.PointLight>(null);
  const mats = useMemo(
    () => ({
      flesh: glowMat(color, { rim: 0xffffff, alpha: 0.55, sway: 0.5, dirY: 1 }),
      tip: new THREE.MeshStandardMaterial({ color: 0, emissive: color, emissiveIntensity: 2.5 }),
    }),
    [color],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const base = 14;
  useFrame(({ clock }) => {
    const l = light.current;
    if (!l) return;
    const t = clock.elapsedTime;
    // en cours : elle respire ; en échec : elle grésille
    if (status === 'failed') l.intensity = base * (Math.random() < 0.08 ? 0.15 : 0.9 + Math.random() * 0.3);
    else if (status === 'running') l.intensity = base * (0.75 + Math.sin(t * 2.5) * 0.25);
    else l.intensity = base * 0.8;
  });
  return (
    <group>
      <mesh geometry={anemoneBase} material={CORALS[1]} position={[0, 0.3, 0]} castShadow />
      {tentacles.map((tn, i) => (
        <mesh key={i} geometry={tn.geo} material={mats.flesh} position={tn.pos} rotation={tn.rot}>
          <mesh geometry={tipGeo} material={mats.tip} position={[0, tn.len, 0]} />
        </mesh>
      ))}
      <pointLight ref={light} color={color} intensity={base} distance={16} decay={1.6} position={[0, 1.6, 0]} />
    </group>
  );
}

// ---------- Habitat ----------
export function Habitat({ info }: { info: WorkerInfo }) {
  const base = useMemo(() => baseFor(info.slot), [info.slot]);
  const angle = Math.atan2(info.pos[2], info.pos[0]);
  const side = angle + 1.2; // l'anémone, sur le rebord du récif
  const beacon = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color: info.color, blending: THREE.AdditiveBlending, depthWrite: false }), [info.color]);
  useEffect(() => () => beacon.dispose(), [beacon]);
  const beaconRef = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    const s = beaconRef.current;
    if (!s) return;
    const t = clock.elapsedTime;
    s.scale.setScalar(info.status === 'running' ? 1.6 + Math.sin(t * 3) * 0.4 : 1.3);
  });

  return (
    <group position={info.pos} {...clickable(info.onClick)}>
      <primitive object={base} />
      <mesh geometry={bubbleGeo} material={MAT.glass} position={[0, T, 0]} />
      {/* balise au sommet de la bulle : le statut, visible de loin */}
      <sprite ref={beaconRef} material={beacon} position={[0, T + BUBBLE + 0.7, 0]} />

      {/* poste de travail tourné vers le large : on voit l'écran et le scaphandrier en arrivant */}
      <group position={[0, T, 0]} rotation-y={-angle - Math.PI / 2} scale={1.3}>
        <mesh geometry={G.desk} material={MAT.darkMetal} position={[0, 0.5, -0.9]} castShadow receiveShadow />
        <Console info={info} />
        <mesh geometry={G.stool} material={MAT.brass} position={[0, 0.28, 0.45]} castShadow />
        <Diver status={info.status} color={info.color} seed={info.seed} />
      </group>

      <group position={[Math.cos(side) * ANEMONE_R, T - 0.35, Math.sin(side) * ANEMONE_R]}>
        <Anemone color={info.color} status={info.status} />
      </group>

      {info.selected && (
        <mesh geometry={G.ring} rotation-x={-Math.PI / 2} position={[0, T + 0.04, 0]}>
          <meshBasicMaterial color={info.color} transparent opacity={0.75} toneMapped={false} />
        </mesh>
      )}

      <WorkerLabel info={info} position={[0, T + BUBBLE + 2.4, 0]} />
    </group>
  );
}
