// Un shell en arrière-plan = un monolithe de glace gravé sur le parvis du phare, flanqué d'un petit
// inukshuk. La commande et la fin de sa sortie luisent dans la glace, en direct.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR, STATUS_LABEL, cut, duration } from '../../format';
import { ShellLabel, clickable, tailLines } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Shell } from '../../types';
import { MAT, glowTex, rng } from './materials';

const slabGeo = new THREE.BoxGeometry(2.8, 4.3, 0.7);
const tipGeo = new THREE.BoxGeometry(1.98, 1.98, 0.7);
const faceGeo = new THREE.PlaneGeometry(2.55, 4.0);
const selGeo = new THREE.PlaneGeometry(3.1, 4.6);
const stoneGeo = new THREE.BoxGeometry(1, 1, 0.26);

// grain de givre, tiré une fois pour toutes
const FROST = (() => {
  const r = rng(99);
  return Array.from({ length: 1400 }, () => [r() * 512, r() * 800, r() * 0.05]);
})();

function drawRunes(ctx: CanvasRenderingContext2D, sh: Shell) {
  const running = sh.status === 'running';
  const g = ctx.createLinearGradient(0, 0, 0, 800);
  g.addColorStop(0, '#0b2233');
  g.addColorStop(1, '#04101a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 800);
  for (const [x, y, a] of FROST) {
    ctx.fillStyle = `rgba(190,230,255,${a})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = 'rgba(140,220,255,0.45)';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, 476, 764);
  ctx.shadowColor = '#5fe0ff';
  ctx.shadowBlur = running ? 14 : 6;
  ctx.textAlign = 'center';
  ctx.fillStyle = running ? '#bff4ff' : '#7fa9bd';
  ctx.font = "700 30px 'Josefin Sans', Inter, sans-serif";
  ctx.fillText('— INUKSHUK —', 256, 80);
  ctx.font = "600 22px 'JetBrains Mono', Consolas, monospace";
  ctx.fillStyle = running ? '#e4fbff' : '#a9c6d4';
  ctx.fillText('$ ' + cut(sh.command, 30), 256, 134);
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`${STATUS_LABEL[sh.status]} · ${duration(sh.startedAt, sh.endedAt ?? undefined)}`, 256, 166);
  ctx.textAlign = 'left';
  ctx.font = "19px 'JetBrains Mono', Consolas, monospace";
  const lines = tailLines(sh, 34, 15);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 && running ? '#e8fdff' : running ? '#6fd3ef' : '#5f8a9c';
    ctx.fillText(l, 44, 216 + i * 36);
  });
  // curseur qui attend la suite
  if (running) {
    ctx.fillStyle = '#e8fdff';
    ctx.fillRect(44, 224 + lines.length * 36 - 22, 12, 22);
  }
  ctx.shadowBlur = 0;
}

export function Monolith({ shell, pos, selected }: { shell: Shell; pos: Vec3; selected: boolean }) {
  const running = shell.status === 'running';
  const color = STATUS_COLOR[shell.status];
  const halo = useRef<THREE.Sprite>(null);
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 800 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const haloMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color: '#6fe4ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  useEffect(
    () => () => {
      texture.dispose();
      haloMat.dispose();
    },
    [texture, haloMat],
  );
  const second = Math.floor(Date.now() / 1000);
  useEffect(() => {
    drawRunes(canvas.getContext('2d')!, shell);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.tail, shell.status, running ? second : 0]);
  useFrame(({ clock }) => {
    haloMat.opacity = running ? 0.45 + Math.sin(clock.elapsedTime * 2.2 + pos[0]) * 0.2 : 0;
  });

  // le monolithe tourne le dos au phare et fait face au large
  const yaw = Math.atan2(pos[0], pos[2]);
  const stones = useMemo(() => {
    const r = rng(Math.round(pos[0] * 100 + pos[2]));
    return [
      [0.22, 0.6, 0.3, -0.18],
      [0.22, 0.6, 0.3, 0.18],
      [0.8, 0.18, 0.69, 0],
      [0.3, 0.42, 0.99, 0],
      [0.9, 0.14, 1.27, 0],
      [0.24, 0.24, 1.46, 0],
    ].map(([w, h, y, x]) => ({ w, h, y, x, ry: (r() - 0.5) * 0.2 }));
  }, [pos]);

  return (
    <group position={pos} rotation-y={yaw} {...clickable(() => useStore.getState().select({ kind: 'shell', id: shell.id }))}>
      <mesh geometry={slabGeo} material={MAT.clear} position={[0, 2.15, 0]} castShadow />
      <mesh geometry={tipGeo} material={MAT.clear} position={[0, 4.3, 0]} rotation-z={Math.PI / 4} scale={[1, 0.45, 1]} castShadow />
      <mesh geometry={faceGeo} position={[0, 2.15, 0.36]}>
        <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={texture} emissiveIntensity={running ? 1.25 : 0.8} />
      </mesh>
      <sprite ref={halo} material={haloMat} position={[0, 4.6, 0]} scale={2.2} />
      {/* petit inukshuk de pierre à côté */}
      <group position={[1.95, 0, 0.3]}>
        {stones.map((s, i) => (
          <mesh key={i} geometry={stoneGeo} material={MAT.stone} position={[s.x, s.y, 0]} rotation-y={s.ry} scale={[s.w, s.h, 1]} castShadow />
        ))}
      </group>
      {selected && (
        <mesh geometry={selGeo} position={[0, 2.15, 0.42]}>
          <meshBasicMaterial color={color} transparent opacity={0.18} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      <ShellLabel shell={shell} selected={selected} position={[0, 5.8, 0]} />
    </group>
  );
}
