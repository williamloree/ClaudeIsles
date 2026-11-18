// Le hub : grand îlot au gravier ratissé ; Claude est la grande lanterne de pierre du centre,
// veillée par une pagode, deux arbres et deux petites lanternes.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HubLabel, clickable, openHub } from '../../scene/labels';
import { HUB_RADIUS, ISLET_TOP } from '../../scene/slots';
import { useStore } from '../../store';
import { Islet } from './Islet';
import { MAT, glowTex, roofGeo } from './materials';
import { Rock, Toro, Tree, type TreeKind } from './Props';

const T = ISLET_TOP;
const HUB_COLOR = '#ffa24d';

// Les emplacements des rouleaux (STELE_SLOTS) sont à 12,4 m, à 11,25° + k·45° : le décor se glisse entre eux.
const deg = (d: number) => (d * Math.PI) / 180;
const at = (a: number, r: number, y = T) => [Math.cos(deg(a)) * r, y, Math.sin(deg(a)) * r] as [number, number, number];
export const HUB_TREES: { pos: [number, number, number]; h: number; kind: TreeKind; seed: number }[] = [
  { pos: at(213.75, 9.2), h: 7, kind: 'maple', seed: 41 },
  { pos: at(326.25 - 22.5, 9.2), h: 7.5, kind: 'sakura', seed: 42 },
];
const SMALL_TORO = [at(168.75, 10.2), at(348.75, 10.2)];
const ROCKS = [at(150, 8.4), at(196, 7.6), at(25, 8.2), at(228, 6.6), at(318, 6.9)];

// ---------- Pagode ----------
const PAGODA_TIERS = [0, 1, 2].map((k) => {
  const w = 4.2 - k * 0.7;
  const hh = k === 0 ? 2.6 : 2.0;
  return { w, hh, body: new THREE.BoxGeometry(w, hh, w), win: new THREE.PlaneGeometry(w * 0.42, hh * 0.45), beam: new THREE.BoxGeometry(w + 0.5, 0.3, w + 0.5), roof: roofGeo(w * 0.71 + 1.9, 1.3, 4, Math.PI / 4, 0.4) };
});
const pagodaBase = new THREE.BoxGeometry(6.4, 0.8, 6.4);
const spireGeo = new THREE.CylinderGeometry(0.07, 0.1, 3.8, 8);
const ringGeos = Array.from({ length: 7 }, (_, j) => new THREE.TorusGeometry(0.24 - j * 0.012, 0.045, 6, 16));
const jewelGeo = new THREE.SphereGeometry(0.16, 12, 8);

function Pagoda() {
  let y = 0.8;
  const tiers = PAGODA_TIERS.map((tier, k) => {
    const y0 = y;
    y += tier.hh + 1.2;
    return (
      <group key={k} position-y={y0}>
        <mesh geometry={tier.body} material={MAT.vermilion} position-y={tier.hh / 2} castShadow receiveShadow />
        {[0, 1, 2, 3].map((f) => {
          const a = (f * Math.PI) / 2;
          return <mesh key={f} geometry={tier.win} material={MAT.shoji} position={[Math.sin(a) * (tier.w / 2 + 0.01), tier.hh * 0.5, Math.cos(a) * (tier.w / 2 + 0.01)]} rotation-y={a} />;
        })}
        <mesh geometry={tier.beam} material={MAT.wood} position-y={tier.hh + 0.15} castShadow />
        <mesh geometry={tier.roof} material={MAT.roof} position-y={tier.hh + 0.85} castShadow receiveShadow />
      </group>
    );
  });
  return (
    <group>
      <mesh geometry={pagodaBase} material={MAT.stone} position-y={0.4} castShadow receiveShadow />
      {tiers}
      <mesh geometry={spireGeo} material={MAT.brass} position-y={y + 1.6} />
      {ringGeos.map((g, j) => (
        <mesh key={j} geometry={g} material={MAT.brass} rotation-x={Math.PI / 2} position-y={y + 0.5 + j * 0.36} />
      ))}
      <mesh geometry={jewelGeo} material={MAT.brass} position-y={y + 3.6} />
    </group>
  );
}

export function Hub() {
  const busy = useStore((s) => s.hub.busy);
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.Sprite>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Claude réfléchit : la lanterne s'avive et pulse
    if (light.current) light.current.intensity = busy ? 120 + Math.sin(t * 6) * 30 : 85 + Math.sin(t * 2.3) * 5 + Math.random() * 4;
    if (glow.current) {
      (glow.current.material as THREE.SpriteMaterial).opacity = busy ? 0.65 + Math.sin(t * 6) * 0.12 : 0.5 + Math.sin(t * 2.3) * 0.06;
      glow.current.scale.setScalar(busy ? 11 + Math.sin(t * 6) * 1.2 : 9);
    }
  });

  return (
    <Islet radius={HUB_RADIUS} seed={0.7} position={[0, 0, 0]} onClick={openHub}>
      <mesh rotation-x={-Math.PI / 2} position-y={T + 0.01} material={MAT.gravel} receiveShadow>
        <circleGeometry args={[7, 64]} />
      </mesh>

      <group {...clickable(openHub)}>
        <group position-y={T}>
          <Toro scale={3.2} color={HUB_COLOR} flame={busy ? 1.5 : 1} />
        </group>
        <pointLight ref={light} color={HUB_COLOR} intensity={90} distance={75} decay={1.5} position-y={T + 5.6} />
        <sprite ref={glow} position-y={T + 5.8} scale={9}>
          <spriteMaterial map={glowTex} color="#ff9a4d" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <group position={[0, T, -7.2]} scale={0.75}>
          <Pagoda />
        </group>
      </group>

      {HUB_TREES.map((t) => (
        <group key={t.seed} position={t.pos}>
          <Tree h={t.h} kind={t.kind} seed={t.seed} />
        </group>
      ))}
      {SMALL_TORO.map((p, i) => (
        <group key={i} position={p}>
          <Toro scale={1.1} color={HUB_COLOR} light={8} />
        </group>
      ))}
      {ROCKS.map((p, i) => (
        <Rock key={i} size={0.6 + (i % 3) * 0.25} seed={i + 2} position={p} />
      ))}

      <HubLabel position={[0, T + 15.5, 0]} />
    </Islet>
  );
}
