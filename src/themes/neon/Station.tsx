// Sur chaque plateforme : l'androïde holographique de l'agent devant sa console, dont l'écran affiche
// son activité réelle, et un pylône néon aux couleurs du statut (le liseré de la plateforme le suit).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorkerInfo } from '../../scene/info';
import { WorkerLabel, clickable, drawActivity } from '../../scene/labels';
import { ISLET_TOP, ISLAND_SLOTS } from '../../scene/slots';
import { useFontsReady } from './fonts';
import { CYAN, MAT, MONO, ORBITRON, PINK, beamMat, glowMaterial, holoMat, neon, rng, scanlines } from './materials';
import { HexPlatform } from './Platform';

const PLATFORM_R = 7;

const legGeo = new THREE.CapsuleGeometry(0.1, 0.7, 4, 10);
const torsoGeo = new THREE.CapsuleGeometry(0.26, 0.55, 6, 14);
const headGeo = new THREE.SphereGeometry(0.2, 18, 14);
const armGeo = new THREE.CapsuleGeometry(0.07, 0.5, 4, 8);
const visorGeo = new THREE.BoxGeometry(0.3, 0.06, 0.05);
const coneGeo = new THREE.CylinderGeometry(0.75, 0.5, 2.6, 24, 1, true).translate(0, 1.3, 0);
const projRingGeo = new THREE.TorusGeometry(0.5, 0.04, 6, 32);
const screenGeo = new THREE.PlaneGeometry(2.36, 1.48);
const tubeGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.6, 8);
const pylonRingGeo = new THREE.TorusGeometry(0.45, 0.06, 8, 32);
const crateGeo = new THREE.BoxGeometry(1, 1, 1);
const stripGeo = new THREE.BoxGeometry(1.02, 0.05, 1.02);
const selGeo = new THREE.RingGeometry(5.5, 5.8, 6, 1);

/** L'androïde : silhouette holographique qui tape (en cours), attend (terminé) ou grésille (échec). */
function Android({ info }: { info: WorkerInfo }) {
  const fail = info.status === 'failed' || info.status === 'killed';
  const run = info.status === 'running';
  const col = fail ? '#ff4a5a' : '#45f3ff';
  const mat = holoMat(col, fail ? 1 : 0);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arms = useRef<THREE.Group>(null);
  const ph = info.seed;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (body.current) body.current.position.y = 0.15 + Math.sin(t * 1.6 + ph) * 0.05;
    arms.current?.children.forEach((a, j) => (a.rotation.x = run ? Math.sin(t * 9 + j * 2.1) * 0.18 : fail ? -1.1 : -0.8));
    if (head.current) {
      head.current.rotation.x = fail ? -0.4 : run ? Math.sin(t * 2 + ph) * 0.08 : 0.08;
      head.current.rotation.y = run ? Math.sin(t * 0.8 + ph) * 0.3 : 0;
    }
  });
  return (
    <group>
      {/* projecteur au sol et cône de lumière */}
      <mesh position={[0, 0.075, 0]} material={MAT.dark}>
        <cylinderGeometry args={[0.55, 0.65, 0.15, 24]} />
      </mesh>
      <mesh geometry={projRingGeo} material={neon(col, 2.4)} rotation-x={Math.PI / 2} position-y={0.16} />
      <mesh geometry={coneGeo} material={beamMat(col, 0.22)} position-y={0.15} />
      <group ref={body} position-y={0.15}>
        {[-0.15, 0.15].map((x) => (
          <mesh key={x} geometry={legGeo} material={mat} position={[x, 0.5, 0]} />
        ))}
        <mesh geometry={torsoGeo} material={mat} position-y={1.35} />
        <group ref={head} position-y={2}>
          <mesh geometry={headGeo} material={mat} />
          <mesh geometry={visorGeo} material={neon(col, 3)} position={[0, 0.02, -0.18]} />
        </group>
        <group ref={arms}>
          {[-0.36, 0.36].map((x) => (
            <group key={x} position={[x, 1.62, 0]}>
              <mesh geometry={armGeo} material={mat} position={[0, -0.05, -0.28]} rotation-x={Math.PI / 2.3} />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Console et écran où s'écrit l'activité (lisible des deux côtés). */
function Console({ info }: { info: WorkerInfo }) {
  const fonts = useFontsReady();
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 320 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const screenMat = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(1.25, 1.25, 1.25) }), [texture]);
  useEffect(() => () => (texture.dispose(), screenMat.dispose()), [texture, screenMat]);
  const minute = Math.floor(Date.now() / 60e3);
  useEffect(() => {
    const ctx = canvas.getContext('2d')!;
    ctx.shadowBlur = 0;
    drawActivity(ctx, info, {
      bg: '#050814',
      border: info.color,
      title: info.color,
      text: '#bff6ff',
      dim: '#6f86b0',
      titleFont: `700 21px ${ORBITRON}`,
      font: `17px ${MONO}`,
    });
    // en-tête rose et balayage d'écran cathodique
    ctx.fillStyle = PINK;
    ctx.font = `500 13px ${ORBITRON}`;
    ctx.textAlign = 'left';
    ctx.fillText(info.badge.toUpperCase(), 26, 26);
    scanlines(ctx, 512, 320);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.title, info.recent.join('\n'), info.status, info.toolUses, minute, fonts]);

  return (
    <group>
      <mesh position={[0, 0.45, -0.55]} material={MAT.metal}>
        <boxGeometry args={[2.2, 0.9, 0.7]} />
      </mesh>
      <mesh position={[0, 0.91, -0.45]} rotation-x={-Math.PI / 2} material={neon(info.color, 1.2)}>
        <planeGeometry args={[1.6, 0.35]} />
      </mesh>
      <mesh position={[0, 1.4, -0.85]} material={MAT.metal}>
        <boxGeometry args={[0.15, 1.2, 0.15]} />
      </mesh>
      <group position={[0, 2.35, -0.88]} rotation-x={-0.12}>
        <mesh material={MAT.dark}>
          <boxGeometry args={[2.5, 1.6, 0.12]} />
        </mesh>
        <mesh geometry={screenGeo} material={screenMat} position-z={0.065} />
        <mesh geometry={screenGeo} material={screenMat} position-z={-0.065} rotation-y={Math.PI} />
      </group>
    </group>
  );
}

/** Pylône de statut : deux tubes et un anneau néon, qui pulsent (en cours) ou clignotent (échec). */
function StatusPylon({ info, rimMat }: { info: WorkerInfo; rimMat: THREE.MeshBasicMaterial }) {
  const base = useMemo(() => new THREE.Color(info.color), [info.color]);
  const tubeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(2.6) }), [base]);
  const halo = useMemo(() => glowMaterial(info.color, 0.9), [info.color]);
  useEffect(() => () => (tubeMat.dispose(), halo.dispose()), [tubeMat, halo]);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + info.seed;
    const s = info.status;
    const k = s === 'running' ? 0.75 + 0.25 * Math.sin(t * 3) : s === 'failed' || s === 'killed' ? (Math.sin(t * 2.5) > 0 ? 1 : 0.2) : 1;
    tubeMat.color.copy(base).multiplyScalar(2.6 * k);
    rimMat.color.copy(base).multiplyScalar(2.4 * k);
    halo.opacity = 0.9 * k;
    if (light.current) light.current.intensity = 22 * k;
  });
  return (
    <group>
      <mesh position-y={2.2} material={MAT.metal}>
        <boxGeometry args={[0.3, 4.4, 0.3]} />
      </mesh>
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} geometry={tubeGeo} material={tubeMat} position={[x, 2.4, 0]} />
      ))}
      <mesh geometry={pylonRingGeo} material={tubeMat} position-y={4.8} />
      <sprite material={halo} position-y={4.8} scale={3} />
      <pointLight ref={light} color={info.color} intensity={22} distance={24} decay={1.6} position-y={3.6} />
    </group>
  );
}

export function Station({ info }: { info: WorkerInfo }) {
  const slot = ISLAND_SLOTS[info.slot];
  const angle = Math.atan2(slot[2], slot[0]);
  const rimMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(info.color).multiplyScalar(2.4) }), [info.color]);
  useEffect(() => () => rimMat.dispose(), [rimMat]);
  const crates = useMemo(() => {
    const r = rng(info.seed + 1);
    return [0, 1, 2].map((k) => {
      const a = Math.PI / 2 - 1.25 + k * 0.38;
      const s = 0.6 + r() * 0.5;
      return { pos: [Math.cos(a) * 4.6, ISLET_TOP + s / 2, Math.sin(a) * 4.6] as [number, number, number], s, ry: r() * 3, strip: r() < 0.5 ? PINK : CYAN };
    });
  }, [info.seed]);
  const pylonA = Math.PI / 2 + 1.1;

  return (
    // repère local : +z vers l'extérieur (d'où arrive la caméra), la passerelle arrive par -z
    <group position={slot} rotation-y={Math.PI / 2 - angle} {...clickable(info.onClick)}>
      {/* une arête (et non un sommet) face au hub : la passerelle s'y pose à plat */}
      <group rotation-y={Math.PI / 6}>
        <HexPlatform radius={PLATFORM_R} rim={info.color} rimMat={rimMat} />
      </group>
      <group position-y={ISLET_TOP} scale={1.3}>
        <Console info={info} />
        <group position={[0.75, 0, 0.55]} rotation-y={0.5}>
          <Android info={info} />
        </group>
      </group>
      <group position={[Math.cos(pylonA) * 4.6, ISLET_TOP, Math.sin(pylonA) * 4.6]}>
        <StatusPylon info={info} rimMat={rimMat} />
      </group>
      {crates.map((c, i) => (
        <group key={i} position={c.pos} rotation-y={c.ry} scale={c.s}>
          <mesh geometry={crateGeo} material={MAT.metal} />
          <mesh geometry={stripGeo} material={neon(c.strip, 1.6)} position-y={0.2} />
        </group>
      ))}
      {info.selected && <mesh geometry={selGeo} material={neon(info.color, 1.6)} rotation-x={-Math.PI / 2} position-y={ISLET_TOP + 0.05} />}
      <WorkerLabel info={info} position={[0, ISLET_TOP + 6.2, 0]} />
    </group>
  );
}
