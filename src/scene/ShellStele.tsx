// Un shell en arrière-plan = une stèle gravée sur le parvis du temple. La commande et la fin
// de sa sortie y luisent comme des braises, en direct ; le clic ouvre la sortie complète.
import { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { STATUS_COLOR, STATUS_LABEL, cut, duration } from '../format';
import type { Shell } from '../types';
import { Fire } from './Fire';
import type { Vec3 } from './islands';
import { labelLayer } from './labels';
import { MAT } from './materials';

const COLS = 34;

function drawStele(ctx: CanvasRenderingContext2D, sh: Shell) {
  const running = sh.status === 'running';
  ctx.fillStyle = '#26221d';
  ctx.fillRect(0, 0, 512, 768);
  ctx.strokeStyle = '#8a6a3c';
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 18, 476, 732);
  ctx.textAlign = 'center';
  ctx.fillStyle = running ? '#ffb35c' : '#9a8a70';
  ctx.font = '700 30px Cinzel, Georgia, serif';
  ctx.fillText('ΚΕΛΥΦΟΣ', 256, 70);
  ctx.font = "600 22px 'JetBrains Mono', Consolas, monospace";
  ctx.fillStyle = running ? '#ffd59a' : '#b9a98c';
  ctx.fillText(cut(sh.command, 32), 256, 116);
  ctx.font = '15px Inter, sans-serif';
  ctx.fillText(`${STATUS_LABEL[sh.status]} · ${duration(sh.startedAt, sh.endedAt ?? undefined)}`, 256, 146);
  ctx.textAlign = 'left';
  ctx.font = "19px 'JetBrains Mono', Consolas, monospace";
  const lines = sh.tail
    .replace(/\s+$/, '')
    .split('\n')
    .slice(-30)
    .flatMap((l) => (l ? l.match(new RegExp(`.{1,${COLS}}`, 'g'))! : ['']))
    .slice(-16);
  if (!lines.length) lines.push('…');
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 && running ? '#ffe2b0' : running ? '#e09a52' : '#8f8068';
    ctx.fillText(l, 40, 196 + i * 34);
  });
}

export function ShellStele({ shell, pos, selected, onClick }: { shell: Shell; pos: Vec3; selected: boolean; onClick: () => void }) {
  const running = shell.status === 'running';
  const color = STATUS_COLOR[shell.status];
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 768 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const second = Math.floor(Date.now() / 1000);
  useEffect(() => {
    drawStele(canvas.getContext('2d')!, shell);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.tail, shell.status, running ? second : 0]);

  // la stèle tourne le dos au temple et fait face au fleuve
  const yaw = Math.atan2(pos[0], pos[2]);
  const lastLine = shell.tail.replace(/\s+$/, '').split('\n').at(-1) || '…';

  return (
    <group
      position={pos}
      rotation-y={yaw}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <mesh position={[0, 2, 0]} material={MAT.stone} castShadow receiveShadow>
        <boxGeometry args={[2.7, 4, 0.45]} />
      </mesh>
      <mesh position={[0, 4, 0]} rotation={[Math.PI / 2, Math.PI / 2, 0]} material={MAT.stone} castShadow>
        <cylinderGeometry args={[1.35, 1.35, 0.45, 24, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, 0.12, 0]} material={MAT.marble} receiveShadow>
        <boxGeometry args={[3.1, 0.24, 0.9]} />
      </mesh>
      <mesh position={[0, 2.05, 0.23]}>
        <planeGeometry args={[2.45, 3.65]} />
        <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={texture} emissiveIntensity={running ? 1.3 : 0.7} />
      </mesh>
      {/* une petite flamme au sommet tant que la commande tourne */}
      {running && (
        <group position={[0, 4.5, 0]}>
          <Fire color="#ffb35c" scale={0.45} />
        </group>
      )}
      {selected && (
        <mesh position={[0, 2.05, 0.3]}>
          <planeGeometry args={[2.9, 4.2]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} toneMapped={false} />
        </mesh>
      )}
      {(running || selected) && (
        <Html position={[0, 5.6, 0]} center zIndexRange={[40, 0]} portal={labelLayer}>
          <div className={`pipe-label ${selected ? 'selected' : ''}`} style={{ ['--c' as string]: color }} onClick={onClick}>
            <div className="pipe-cmd">
              <span className="pill">{STATUS_LABEL[shell.status]}</span> {cut(shell.description || shell.command, 32)}
            </div>
            {running && <div className="pipe-out">{cut(lastLine, 42)}</div>}
          </div>
        </Html>
      )}
    </group>
  );
}
