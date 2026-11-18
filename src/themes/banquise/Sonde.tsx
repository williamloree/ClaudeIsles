// Ballon-sonde au-dessus du phare : une session Claude Code ouverte ailleurs (terminal, VS Code…).
// Le nom du projet est peint sur l'enveloppe ; la lampe de la nacelle s'avive quand la session travaille.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS, cut } from '../../format';
import { SessionLabel, clickable } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Session } from '../../types';
import { MAT, glowTex } from './materials';

const ballGeo = new THREE.SphereGeometry(1.1, 32, 20);
const neckGeo = new THREE.ConeGeometry(0.2, 0.4, 12);
const boxGeo = new THREE.BoxGeometry(0.4, 0.3, 0.4);
const lampGeo = new THREE.SphereGeometry(0.12, 10, 8);
const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.6, 0), new THREE.Vector3(0, -3.3, 0)]);
const stringMat = new THREE.LineBasicMaterial({ color: 0xcfdbe6 });

function drawBalloon(ctx: CanvasRenderingContext2D, name: string) {
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#e6dccb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 32) {
    ctx.fillStyle = 'rgba(120,140,160,0.12)';
    ctx.fillRect(x, 0, 2, 256);
  }
  ctx.textAlign = 'center';
  // deux fois : on lit le nom quel que soit le côté
  for (const x of [128, 384]) {
    ctx.fillStyle = '#1d3044';
    ctx.font = "700 38px 'Josefin Sans', Inter, sans-serif";
    ctx.fillText(cut(name, 11), x, 140);
    ctx.font = '600 16px Inter, sans-serif';
    ctx.fillStyle = '#5a6f82';
    ctx.fillText('SONDE', x, 92);
  }
}

export function Sonde({ session, pos, selected }: { session: Session; pos: Vec3; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const live = Date.now() - session.lastActivity < 30e3;
  const lampColor = session.active ? COLORS.lantern : '#ffc27a';
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 256 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  const ballMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.8, roughness: 0.5 }), [texture]);
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: lampColor, emissiveIntensity: 3 }), [lampColor]);
  const haloMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color: lampColor, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), [lampColor]);
  useEffect(() => () => [texture, ballMat].forEach((x) => x.dispose()), [texture, ballMat]);
  useEffect(() => () => [lampMat, haloMat].forEach((x) => x.dispose()), [lampMat, haloMat]);
  useEffect(() => {
    drawBalloon(canvas.getContext('2d')!, session.project);
    texture.needsUpdate = true;
  }, [canvas, texture, session.project]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + pos[0];
    if (ref.current) {
      ref.current.position.y = pos[1] + Math.sin(t * 0.8) * 0.4;
      ref.current.rotation.y = t * 0.1;
      ref.current.rotation.z = Math.sin(t * 0.6) * 0.05;
    }
    // la lampe clignote vite quand la session travaille, veille doucement sinon
    const k = live ? 0.75 + 0.25 * Math.sin(t * 9) : 0.55 + 0.1 * Math.sin(t * 1.5);
    lampMat.emissiveIntensity = 4 * k;
    haloMat.opacity = 0.7 * k;
  });

  return (
    <group ref={ref} position={pos}>
      <group scale={1.5} {...clickable(() => useStore.getState().select({ kind: 'session', id: session.id }))}>
        <mesh geometry={ballGeo} material={ballMat} scale={[1, 1.18, 1]} />
        <mesh geometry={neckGeo} material={ballMat} position={[0, -1.42, 0]} rotation-x={Math.PI} />
        <lineSegments geometry={stringGeo} material={stringMat} />
        <mesh geometry={boxGeo} material={MAT.metal} position={[0, -3.45, 0]} />
        <mesh geometry={lampGeo} material={lampMat} position={[0, -3.72, 0]} />
        <sprite material={haloMat} position={[0, -3.72, 0]} scale={live ? 1.8 : 1.3} />
      </group>
      <SessionLabel session={session} selected={selected} position={[0, 3.2, 0]} />
    </group>
  );
}
