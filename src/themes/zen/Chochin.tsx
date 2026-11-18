// Lanterne de papier (chōchin) flottant au-dessus du hub : une session Claude Code ouverte ailleurs
// (terminal, VS Code…). Elle s'illumine quand la session travaille.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cut } from '../../format';
import { SessionLabel, clickable } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Session } from '../../types';
import { MAT, SERIF, glowTex, useFontsReady } from './materials';

const bodyGeo = new THREE.LatheGeometry(
  Array.from({ length: 13 }, (_, k) => new THREE.Vector2(0.42 + Math.sin((k / 12) * Math.PI) * 0.28, (k / 12) * 1.3 - 0.65)),
  28,
);
const capGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 20);
const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.2, 4);
const SCALE = 1.9; // lisible depuis la vue d'ensemble

function drawChochin(ctx: CanvasRenderingContext2D, s: Session) {
  ctx.fillStyle = '#f4dfb2';
  ctx.fillRect(0, 0, 512, 256);
  // les côtes de bambou du lampion
  for (let y = 0; y < 256; y += 14) {
    ctx.fillStyle = 'rgba(120,80,40,0.35)';
    ctx.fillRect(0, y, 512, 2);
  }
  ctx.textAlign = 'center';
  for (const x of [128, 384]) {
    ctx.fillStyle = '#b3261e';
    ctx.font = `700 70px ${SERIF}`;
    ctx.fillText('灯', x, 128);
    ctx.fillStyle = '#2a1a12';
    ctx.font = `700 26px ${SERIF}`;
    ctx.fillText(cut(s.project, 14), x, 186);
  }
}

export function Chochin({ session, pos, selected }: { session: Session; pos: Vec3; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const live = Date.now() - session.lastActivity < 30e3;
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 256 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: texture, side: THREE.DoubleSide }), [texture]);
  const glowMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color: 0xffa24d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  useEffect(
    () => () => {
      texture.dispose();
      mat.dispose();
      glowMat.dispose();
    },
    [texture, mat, glowMat],
  );
  const fonts = useFontsReady();
  useEffect(() => {
    drawChochin(canvas.getContext('2d')!, session);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.project, fonts]);
  // une session endormie garde une lueur de veilleuse
  const glow = session.active || live ? 1.25 : 0.55;
  mat.emissiveIntensity = glow;
  glowMat.opacity = session.active || live ? 0.55 : 0.2;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + pos[0];
    ref.current.position.y = pos[1] + Math.sin(t * 0.9) * 0.5;
    ref.current.rotation.z = Math.sin(t * 0.7) * 0.05;
    ref.current.rotation.y = t * 0.15;
  });
  return (
    <group ref={ref} position={pos}>
      <group scale={SCALE} {...clickable(() => useStore.getState().select({ kind: 'session', id: session.id }))}>
        <mesh geometry={bodyGeo} material={mat} />
        {[-0.68, 0.68].map((y) => (
          <mesh key={y} geometry={capGeo} material={MAT.lacquer} position-y={y} />
        ))}
        <mesh geometry={cordGeo} material={MAT.lacquer} position-y={1.3} />
        <sprite material={glowMat} scale={4.5} />
        {selected && (
          <mesh rotation-x={-Math.PI / 2} position-y={-0.9}>
            <ringGeometry args={[0.9, 1.0, 48]} />
            <meshBasicMaterial color="#ffd27a" transparent opacity={0.8} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      <SessionLabel session={session} selected={selected} position={[0, 3.6, 0]} />
    </group>
  );
}
