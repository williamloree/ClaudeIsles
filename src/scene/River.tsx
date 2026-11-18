// Le Styx : eau sombre qui reflète les feux, ondes autour des îlots, bougies qui dérivent, brume,
// Charon qui fait sa ronde, et les barques des âmes des anciens agents, chacune suivie de son sillage.
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { COLORS, STATUS_COLOR, STATUS_LABEL, ago, cut } from '../format';
import { useStore } from '../store';
import type { Status } from '../types';
import { Fire } from './Fire';
import { Ghost } from './Ghost';
import { labelLayer } from './labels';
import { MAT, flameTex, rippleTex, rng, softTex, waterNormals } from './materials';

/** Position courante des barques (elles bougent) : la caméra s'en sert pour y voler. */
export const livePositions = new Map<string, THREE.Vector3>();

export interface Boat {
  key: string; // `agent:<id>` ou `task:<id>`, ou `ambient:<n>` (barque sans âme connue)
  title: string;
  status: Status;
  endedAt: number | null;
  subtitle: string;
}

// ---------- Trajectoires ----------
interface Lane {
  r: number;
  w: number;
  phase: number;
  wobble: number;
}
/** Voie stable d'une barque : dépend de son identifiant, pas de sa place dans la liste. */
function laneIndex(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 997;
}

function laneFor(i: number): Lane {
  const r = rng(1000 + i * 77);
  const dir = i % 3 === 1 ? -1 : 1;
  // au-delà de l'anneau extérieur d'îlots (56 + 9,5) ; vitesse lente de promenade
  return { r: 68 + (i % 4) * 4.5 + r() * 2, w: dir * (0.012 + r() * 0.01), phase: i * 2.399, wobble: 1.5 + r() * 2 };
}
function lanePoint(l: Lane, t: number, out = new THREE.Vector3()) {
  const a = l.phase + t * l.w;
  const r = l.r + Math.sin(t * 0.07 + l.phase) * l.wobble;
  return out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
}

// ---------- Eau ----------
function StyxWater() {
  const water = useMemo(() => {
    const w = new Water(new THREE.PlaneGeometry(3000, 3000), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(-0.4, 0.9, -0.3).normalize(),
      sunColor: 0x4fa892,
      waterColor: 0x02110e,
      distortionScale: 1.6,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    return w;
  }, []);
  useFrame((_, dt) => {
    (water.material as THREE.ShaderMaterial).uniforms.time.value += dt * 0.25;
  });
  return <primitive object={water} />;
}

/** Ondes qui s'éloignent du pied des îlots. */
function Ripples({ centers }: { centers: { pos: [number, number, number]; r: number }[] }) {
  const group = useRef<THREE.Group>(null);
  const rings = useMemo(
    () =>
      centers.flatMap((c, ci) =>
        [0, 1, 2].map((k) => ({ ...c, offset: k / 3 + ci * 0.17, mat: new THREE.MeshBasicMaterial({ map: rippleTex, color: '#7fc8b4', transparent: true, depthWrite: false, opacity: 0 }) })),
      ),
    [centers],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12;
    group.current?.children.forEach((m, i) => {
      const ring = rings[i];
      const age = (t + ring.offset) % 1;
      m.scale.setScalar(ring.r * (1.05 + age * 0.9));
      ring.mat.opacity = Math.sin(age * Math.PI) * 0.22;
    });
  });
  return (
    <group ref={group}>
      {rings.map((r, i) => (
        <mesh key={i} position={[r.pos[0], 0.06, r.pos[2]]} rotation-x={-Math.PI / 2} material={r.mat}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Bougies sur des feuilles de nénuphar, qui dérivent lentement. */
function Candles({ count = 46 }: { count?: number }) {
  const group = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const r = rng(4242);
    return Array.from({ length: count }, () => ({ rad: 27 + r() * 80, a: r() * Math.PI * 2, w: (r() - 0.5) * 0.02, bob: r() * 10 }));
  }, [count]);
  const flameMat = useMemo(() => new THREE.SpriteMaterial({ map: flameTex, color: '#ffb35c', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), []);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1d3b2a, roughness: 0.8 }), []);
  const waxMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xe9dfc6, emissive: 0x3a2a10, roughness: 0.6 }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((g, i) => {
      const it = items[i];
      const a = it.a + t * it.w;
      g.position.set(Math.cos(a) * it.rad, 0.06 + Math.sin(t * 0.8 + it.bob) * 0.03, Math.sin(a) * it.rad);
      g.rotation.y = t * 0.05 + it.bob;
      const fl = g.children[2];
      const k = 0.85 + Math.sin(t * 11 + it.bob) * 0.12;
      fl.scale.set(0.16 * k, 0.32 * k, 1);
    });
  });
  return (
    <group ref={group}>
      {items.map((_, i) => (
        <group key={i}>
          <mesh material={leafMat} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
            <circleGeometry args={[0.45, 12, 0.3, Math.PI * 2 - 0.4]} />
          </mesh>
          <mesh material={waxMat} position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.28, 8]} />
          </mesh>
          <sprite material={flameMat} position={[0, 0.42, 0]} />
        </group>
      ))}
    </group>
  );
}

function Mist() {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 90 }, () => {
      const a = r() * Math.PI * 2;
      const d = 10 + r() * 130;
      return { pos: [Math.cos(a) * d, 0.8 + r() * 1.5, Math.sin(a) * d] as [number, number, number], s: [18 + r() * 20, 5 + r() * 4, 1] as [number, number, number] };
    });
  }, []);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: softTex, color: '#6fa59a', transparent: true, opacity: 0.16, depthWrite: false }), []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y -= dt * 0.006;
  });
  return (
    <group ref={ref}>
      {items.map((m, i) => (
        <sprite key={i} material={mat} position={m.pos} scale={m.s} />
      ))}
    </group>
  );
}

// ---------- Barques ----------
const hullGeo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const prowGeo = new THREE.TorusGeometry(0.45, 0.08, 6, 16, Math.PI * 1.2);
const rimGeo = new THREE.TorusGeometry(1, 0.035, 6, 48);
const glowGeo = new THREE.PlaneGeometry(1, 1);
const BOAT_SCALE = 1.6; // assez grand pour être vu depuis la vue d'ensemble

function Hull({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh geometry={hullGeo} material={MAT.wood} scale={[1.1, 0.7, 3.2]} castShadow />
      {/* plat-bord de bronze : la silhouette reste lisible sur l'eau noire */}
      <mesh geometry={rimGeo} material={MAT.bronze} rotation-x={Math.PI / 2} scale={[1.1, 3.2, 1]} position={[0, 0.02, 0]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} material={MAT.cloak} scale={[1, 3, 1]}>
        <circleGeometry args={[0.95, 20]} />
      </mesh>
      {/* proue recourbée */}
      <mesh geometry={prowGeo} material={MAT.wood} position={[0, 0.45, -3.05]} rotation={[0, Math.PI / 2, 0.3]} />
      <mesh geometry={prowGeo} material={MAT.wood} position={[0, 0.3, 3.05]} rotation={[0, -Math.PI / 2, 0.3]} scale={0.6} />
    </group>
  );
}

/** Sillage : anneaux posés sur l'eau aux positions passées de la barque. */
function Wake({ lane, color }: { lane: Lane; color: string }) {
  const group = useRef<THREE.Group>(null);
  const tint = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#7fc8b4'), 0.6), [color]);
  const mats = useMemo(() => [0, 1, 2, 3, 4, 5].map(() => new THREE.MeshBasicMaterial({ map: rippleTex, color: tint, transparent: true, depthWrite: false, opacity: 0 })), [tint]);
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((m, k) => {
      const age = ((t * 0.5 + k / 6) % 1);
      lanePoint(lane, t - age * 9, p);
      m.position.set(p.x, 0.07, p.z);
      m.scale.setScalar((1 + age * 2.6) * BOAT_SCALE);
      mats[k].opacity = (1 - age) * 0.16;
    });
  });
  return (
    <group ref={group}>
      {mats.map((m, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} material={m}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      ))}
    </group>
  );
}

// Les barques des âmes lévitent au-dessus du Styx : la coque ne touche jamais l'eau.
const HOVER = 2.2;
const HULL_DEPTH = 0.7 * BOAT_SCALE;
const DRIPS = 7;

function SpiritBoat({ boat, index, selected }: { boat: Boat; index: number; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const below = useRef<THREE.Group>(null);
  const drips = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const lane = useMemo(() => laneFor(index), [index]);
  const color = STATUS_COLOR[boat.status];
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: softTex, color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }), [color]);
  const keelMat = useMemo(() => new THREE.SpriteMaterial({ map: softTex, color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), [color]);
  const cushionMat = useMemo(() => new THREE.SpriteMaterial({ map: softTex, color: new THREE.Color(color).lerp(new THREE.Color('#9fd8c8'), 0.5), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }), [color]);
  const dripMat = useMemo(() => new THREE.SpriteMaterial({ map: flameTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), [color]);
  // gouttes de lumière qui tombent de la quille vers l'eau, réparties le long de la coque
  const dripSpots = useMemo(() => {
    const r = rng(500 + index);
    return Array.from({ length: DRIPS }, (_, k) => ({ x: (r() - 0.5) * 1.2, z: (k / (DRIPS - 1) - 0.5) * 6.5, phase: r() }));
  }, [index]);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!ref.current) return;
    lanePoint(lane, t, a);
    lanePoint(lane, t + 0.5, b);
    const heading = Math.atan2(a.x - b.x, a.z - b.z);
    const bob = Math.sin(t * 1.1 + index) * 0.18;
    const y = HOVER + bob;
    ref.current.position.set(a.x, y, a.z);
    ref.current.rotation.set(Math.sin(t * 0.7 + index) * 0.03, heading, Math.sin(t * 0.9 + index) * 0.05);
    ref.current.scale.setScalar(BOAT_SCALE);
    if (below.current) {
      below.current.position.set(a.x, 0, a.z);
      below.current.rotation.y = heading;
    }
    // le halo sur l'eau s'intensifie quand la barque descend
    glowMat.opacity = 0.5 - bob * 0.6;
    const fall = y - HULL_DEPTH * 0.8;
    drips.current?.children.forEach((d, k) => {
      const s = dripSpots[k];
      const age = (t * 0.45 + s.phase) % 1;
      d.position.set(s.x, fall - (fall - 0.1) * age * age, s.z);
      const k2 = Math.sin(age * Math.PI);
      d.scale.set(0.12 * k2, 0.3 * k2, 1);
    });
    let live = livePositions.get(boat.key);
    if (!live) livePositions.set(boat.key, (live = new THREE.Vector3()));
    live.set(a.x, HOVER + 1, a.z);
  });
  const select = () => {
    if (boat.key.startsWith('ambient:')) return;
    const [kind, ...rest] = boat.key.split(':');
    useStore.getState().select({ kind: kind as 'agent' | 'task', id: rest.join(':') });
  };
  return (
    <>
      <group
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          select();
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
        <Hull />
        {/* lueur spectrale sous la quille : c'est elle qui porte la barque */}
        <sprite material={keelMat} position={[0, -0.75, 0]} scale={[3.2, 1.4, 1]} />
        {/* lanterne de proue */}
        <mesh position={[0, 1.1, -2.6]} material={MAT.bronze}>
          <cylinderGeometry args={[0.03, 0.04, 1.6, 5]} />
        </mesh>
        <group position={[0, 1.85, -2.6]}>
          <Fire color={color} scale={0.5} />
        </group>
        {/* l'âme, assise, qui regarde vers la proue */}
        <group position={[0, 1.05, 0.4]}>
          <Ghost color={color} pose="sit" scale={0.75} seed={index} />
        </group>
        {(hover || selected) && (
          <Html position={[0, 3.6, 0]} center zIndexRange={[40, 0]} portal={labelLayer}>
            <div className={`isle-label boat ${selected ? 'selected' : ''}`} style={{ ['--c' as string]: color }} onClick={select}>
              <div className="isle-badge">
                ÂME EN BARQUE <span>{STATUS_LABEL[boat.status]}</span>
              </div>
              <div className="isle-title">{cut(boat.title, 40)}</div>
              <div className="isle-sub">
                {boat.subtitle}
                {boat.endedAt ? ` · ${ago(boat.endedAt)}` : ''}
              </div>
            </div>
          </Html>
        )}
      </group>
      {/* sous la barque, au ras de l'eau : halo, coussin de brume et gouttes de lumière */}
      <group ref={below}>
        <mesh geometry={glowGeo} material={glowMat} rotation-x={-Math.PI / 2} position={[0, 0.09, 0]} scale={[9, 14, 1]} />
        {[-2.2, 0, 2.2].map((z) => (
          <sprite key={z} material={cushionMat} position={[0, 0.7, z]} scale={[5, 1.3, 1]} />
        ))}
        <group ref={drips}>
          {dripSpots.map((_, k) => (
            <sprite key={k} material={dripMat} />
          ))}
        </group>
      </group>
      <Wake lane={lane} color={color} />
    </>
  );
}

function Charon() {
  const ref = useRef<THREE.Group>(null);
  const pole = useRef<THREE.Group>(null);
  // la voie la plus large, au-delà des barques des âmes (et des îlots extérieurs)
  const lane = useMemo<Lane>(() => ({ r: 90, w: 0.022, phase: 0, wobble: 2 }), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.lantern).multiplyScalar(2), toneMapped: false }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!ref.current) return;
    lanePoint(lane, t, a);
    lanePoint(lane, t + 0.5, b);
    // il flotte, lui : la coque n'est enfoncée que d'un tiers
    ref.current.position.set(a.x, 1.0 + Math.sin(t * 1.2) * 0.08, a.z);
    ref.current.rotation.set(0, Math.atan2(a.x - b.x, a.z - b.z), Math.sin(t * 0.9) * 0.04);
    ref.current.scale.setScalar(BOAT_SCALE);
    // il pousse sur sa perche : mouvement lent d'avant en arrière
    if (pole.current) pole.current.rotation.x = 0.35 + Math.sin(t * 0.8) * 0.3;
  });
  return (
    <group ref={ref}>
      <Hull scale={1.35} />
      <group position={[0, 0.3, 2.4]}>
        <mesh position={[0, 1.6, 0]} material={MAT.cloak} castShadow>
          <coneGeometry args={[0.7, 3.2, 16]} />
        </mesh>
        <mesh position={[0, 3.3, 0]} material={MAT.cloak} scale={[1, 1.15, 1.05]}>
          <sphereGeometry args={[0.4, 16, 12]} />
        </mesh>
        <mesh position={[0, 3.55, 0.25]} rotation-x={0.9} material={MAT.cloak}>
          <coneGeometry args={[0.24, 0.5, 12]} />
        </mesh>
        {[-0.11, 0.11].map((x) => (
          <mesh key={x} position={[x, 3.32, -0.36]} material={eyeMat}>
            <sphereGeometry args={[0.045, 8, 6]} />
          </mesh>
        ))}
        <group ref={pole} position={[0.55, 2.2, -0.2]}>
          <mesh position={[0, -1, 0]} material={MAT.wood}>
            <cylinderGeometry args={[0.045, 0.045, 7, 6]} />
          </mesh>
        </group>
      </group>
      <mesh position={[0, 1.6, -4]} material={MAT.bronze}>
        <cylinderGeometry args={[0.04, 0.05, 2.4, 5]} />
      </mesh>
      <group position={[0, 2.85, -4]}>
        <Fire color={COLORS.lantern} scale={0.5} light={14} />
      </group>
    </group>
  );
}

export function River({ boats, islets }: { boats: Boat[]; islets: { pos: [number, number, number]; r: number }[] }) {
  const selection = useStore((s) => s.selection);
  const selKey = selection ? `${selection.kind}:${selection.id}` : null;
  // Les ondes ne sont recréées que si les îlots changent vraiment.
  const isletsKey = islets.map((c) => c.pos.join(',')).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableIslets = useMemo(() => islets, [isletsKey]);
  return (
    <>
      <StyxWater />
      <Ripples centers={stableIslets} />
      <Candles />
      <Mist />
      <Charon />
      {boats.map((b) => (
        <SpiritBoat key={b.key} boat={b} index={laneIndex(b.key)} selected={selKey === b.key} />
      ))}
    </>
  );
}
