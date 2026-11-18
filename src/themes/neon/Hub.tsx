// Le hub : tour holographique de Claude sur la grande plateforme hexagonale. Noyau qui flotte dans une
// colonne de lumière, anneaux néon, bandeau « CLAUDE » qui tourne, faisceau vers le ciel, pylônes d'enseignes.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HubLabel, clickable, openHub } from '../../scene/labels';
import { ISLET_TOP } from '../../scene/slots';
import { useStore } from '../../store';
import { useFontsReady } from './fonts';
import { CYAN, MAT, NEONS, ORBITRON, PINK, beamMat, drawTexture, glowMaterial, glowTex, hexCorner, holoMat, neon, rng, signTexture } from './materials';
import { HexPlatform, HexRim } from './Platform';

export const HUB_HEX = 17.2;
const TY = ISLET_TOP + 0.5; // dessus du parvis intérieur
const CY = TY + 8; // altitude du noyau
const RING_H = [3, 6, 9.5, 13, 16];

const columnGeo = new THREE.CylinderGeometry(2.2, 2.2, 16, 40, 1, true);
const wireGeo = new THREE.IcosahedronGeometry(1.6, 1);
const ballGeo = new THREE.IcosahedronGeometry(0.85, 3);
const ringGeos = [new THREE.TorusGeometry(2.9, 0.07, 8, 64), new THREE.TorusGeometry(3.4, 0.07, 8, 64)];
const bandGeo = new THREE.CylinderGeometry(3.6, 3.6, 1.6, 64, 1, true);
const skyBeamGeo = new THREE.CylinderGeometry(3, 0.6, 220, 32, 1, true).translate(0, 110, 0);
const wireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PINK).multiplyScalar(2.5), wireframe: true });
const signGeo = new THREE.PlaneGeometry(1, 4);

/** Données qui montent dans la colonne. */
function DataStream({ busy }: { busy: boolean }) {
  const { geo, mat } = useMemo(() => {
    const r = rng(12);
    const pos = new Float32Array(220 * 3);
    for (let i = 0; i < 220; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 2;
      pos.set([Math.cos(a) * d, TY + 1 + r() * 16, Math.sin(a) * d], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9ff8ff, size: 0.3, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return { geo, mat };
  }, []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame((_, dt) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const k = busy ? 2.5 : 1;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * k * (3 + (i % 4));
      if (y > TY + 17) y = TY + 1;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} />;
}

/** Pylône d'enseigne verticale, lisible des deux côtés. */
function SignPylon({ word, color, angle }: { word: string; color: string; angle: number }) {
  const fonts = useFontsReady();
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: signTexture(word, color, true), color: new THREE.Color(1.5, 1.5, 1.5) }), [word, color, fonts]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group position={[Math.cos(angle) * 15.2, ISLET_TOP, Math.sin(angle) * 15.2]} rotation-y={Math.PI / 2 - angle}>
      <mesh position={[0, 4.5, 0]} material={MAT.metal}>
        <boxGeometry args={[0.3, 9, 0.3]} />
      </mesh>
      <mesh geometry={signGeo} material={mat} position={[0, 5.5, 0.2]} scale={1.7} />
      <mesh geometry={signGeo} material={mat} position={[0, 5.5, -0.2]} rotation-y={Math.PI} scale={1.7} />
    </group>
  );
}

export function Hub() {
  const busy = useStore((s) => s.hub.busy);
  const fonts = useFontsReady();
  const core = useRef<THREE.Group>(null);
  const wire = useRef<THREE.Mesh>(null);
  const ball = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const rings = useRef<THREE.Group>(null);
  const band = useRef<THREE.Mesh>(null);

  const bandMat = useMemo(() => {
    const map = drawTexture(1024, 128, (ctx) => {
      ctx.font = `700 72px ${ORBITRON}`;
      ctx.textBaseline = 'middle';
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 20;
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = CYAN;
        ctx.fillText('CLAUDE', 20 + k * 341, 66);
        ctx.fillStyle = PINK;
        ctx.fillText('◆', 300 + k * 341, 66);
      }
    });
    return new THREE.MeshBasicMaterial({ map, color: new THREE.Color(1.8, 1.8, 1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }, [fonts]);
  useEffect(() => () => (bandMat.map?.dispose(), bandMat.dispose()), [bandMat]);
  const ballMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.4, 1.6).multiplyScalar(2.2) }), []);
  const haloMat = useMemo(() => glowMaterial(CYAN, 0.8), []);
  useEffect(() => () => (ballMat.dispose(), haloMat.dispose()), [ballMat, haloMat]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const k = busy ? 3 : 1;
    if (wire.current) {
      wire.current.rotation.y += dt * 0.6 * k;
      wire.current.rotation.x += dt * 0.25 * k;
    }
    if (ball.current) ball.current.rotation.y -= dt * k;
    if (core.current) core.current.position.y = CY + Math.sin(t * (busy ? 4 : 1.3)) * (busy ? 0.45 : 0.3);
    // Claude réfléchit : le noyau bat plus vite et plus fort
    if (light.current) light.current.intensity = busy ? 210 + Math.sin(t * 9) * 50 : 150 + Math.sin(t * 3) * 25;
    haloMat.opacity = busy ? 0.85 + Math.sin(t * 9) * 0.15 : 0.75;
    rings.current?.children.forEach((m, i) => {
      m.rotation.z += dt * (i % 2 ? -0.6 : 0.4) * k;
      m.position.y = TY + RING_H[i] + Math.sin(t * 1.5 + i) * 0.25;
      m.rotation.x = Math.PI / 2 + Math.sin(t * 0.7 + i) * 0.08;
    });
    if (band.current) band.current.rotation.y -= dt * 0.4 * k;
  });

  const lamps = [0, 3].map((k) => hexCorner(11, k * 2 + 1));

  return (
    <group>
      <group {...clickable(openHub)}>
        <HexPlatform radius={HUB_HEX} rim={PINK} />
        <mesh position-y={ISLET_TOP + 0.25} material={MAT.deck}>
          <cylinderGeometry args={[8.5, 8.8, 0.5, 6]} />
        </mesh>
        <HexRim r={8.8} y={TY} material={neon(CYAN, 2.4)} th={0.1} />
        <mesh position-y={TY + 0.6} material={MAT.metal}>
          <cylinderGeometry args={[3, 3.6, 1.2, 6]} />
        </mesh>
        <HexRim r={3.05} y={TY + 1.2} material={neon(CYAN, 2.6)} th={0.08} />
        <mesh geometry={columnGeo} position-y={TY + 9.2} material={holoMat(CYAN, 0, busy ? 1.6 : 1)} />
        <group ref={core} position-y={CY}>
          <mesh ref={wire} geometry={wireGeo} material={wireMat} />
          <mesh ref={ball} geometry={ballGeo} material={ballMat} />
          <sprite material={haloMat} scale={12} />
          <pointLight ref={light} color={CYAN} intensity={150} distance={90} decay={1.4} />
        </group>
        <group ref={rings}>
          {RING_H.map((h, i) => (
            <mesh key={i} geometry={ringGeos[i % 2]} material={neon(i % 2 ? PINK : CYAN, 2.4)} position-y={TY + h} rotation-x={Math.PI / 2} />
          ))}
        </group>
        <mesh ref={band} geometry={bandGeo} material={bandMat} position-y={TY + 18.5} />
        <mesh geometry={skyBeamGeo} material={beamMat(CYAN, busy ? 0.6 : 0.4)} position-y={TY + 17} />
      </group>
      <DataStream busy={busy} />
      {/* lampes roses au pied de la tour */}
      {lamps.map(([x, z], i) => (
        <pointLight key={i} color={PINK} intensity={40} distance={30} decay={1.6} position={[x, ISLET_TOP + 3, z]} />
      ))}
      {/* enseignes à l'arrière, entre les départs de passerelles */}
      {['AGENTS', 'SHELL', 'TOKENS'].map((w, i) => (
        <SignPylon key={w} word={w} color={NEONS[i]} angle={Math.PI + (3 * Math.PI) / 16 + (i * Math.PI) / 4} />
      ))}
      {/* sous les satellites : leurs étiquettes ne se chevauchent pas */}
      <HubLabel position={[0, TY + 14, 0]} />
    </group>
  );
}
