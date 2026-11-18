// Un shell en arrière-plan = un moniteur sur pied au bord de la place, tourné vers le large.
// La commande et la fin de sa sortie s'y affichent en direct ; le clic ouvre la sortie complète.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { STATUS_COLOR, STATUS_LABEL, cut, duration } from '../../format';
import { ShellLabel, clickable, tailLines } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Shell } from '../../types';
import { groundAt } from './islands';
import { MAT, bulbMaterial } from './materials';

const MONO = "'JetBrains Mono', Consolas, monospace";

function drawTerminal(ctx: CanvasRenderingContext2D, sh: Shell, blink: boolean) {
  const running = sh.status === 'running';
  const W = 768;
  const H = 440;
  ctx.fillStyle = '#0b0f14';
  ctx.fillRect(0, 0, W, H);
  // barre de titre
  ctx.fillStyle = '#1c232c';
  ctx.fillRect(0, 0, W, 44);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(26 + i * 24, 22, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = `600 20px ${MONO}`;
  ctx.fillStyle = '#c9d1d9';
  ctx.fillText(cut(sh.command, 48), 110, 29);
  // statut à droite de la barre
  ctx.textAlign = 'right';
  ctx.font = '600 16px Inter, sans-serif';
  ctx.fillStyle = STATUS_COLOR[sh.status];
  ctx.fillText(`${STATUS_LABEL[sh.status]} · ${duration(sh.startedAt, sh.endedAt ?? undefined)}`, W - 18, 28);
  ctx.textAlign = 'left';
  ctx.font = `19px ${MONO}`;
  const lines = tailLines(sh, 62, 11);
  lines.forEach((l, i) => {
    ctx.fillStyle = /^\s*(\[|➜|✓)/.test(l) ? '#7ee787' : running ? '#c9d1d9' : '#8b949e';
    ctx.fillText(l, 22, 86 + i * 31);
  });
  // curseur clignotant tant que la commande tourne
  if (running && blink) {
    ctx.fillStyle = '#7ee787';
    ctx.fillRect(22, 86 + lines.length * 31 - 18, 11, 22);
  }
}

export function ShellScreen({ shell, pos, selected }: { shell: Shell; pos: Vec3; selected: boolean }) {
  const running = shell.status === 'running';
  const color = STATUS_COLOR[shell.status];
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 768, height: 440 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const second = Math.floor(Date.now() / 1000);
  useEffect(() => {
    drawTerminal(canvas.getContext('2d')!, shell, second % 2 === 0);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.tail, shell.status, running ? second : 0]);

  // l'écran tourne le dos à l'observatoire et fait face au large
  const yaw = Math.atan2(pos[0], pos[2]);
  const y = groundAt(-1, pos[0], pos[2]);

  return (
    <group position={[pos[0], y, pos[2]]} rotation-y={yaw} {...clickable(() => useStore.getState().select({ kind: 'shell', id: shell.id }))}>
      <mesh position={[0, 0.06, 0]} material={MAT.metal} receiveShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.12, 16]} />
      </mesh>
      <mesh position={[0, 1.1, 0]} material={MAT.metal} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 2.2, 10]} />
      </mesh>
      <mesh position={[0, 3.1, -0.02]} material={MAT.dark} castShadow>
        <boxGeometry args={[3.6, 2.15, 0.12]} />
      </mesh>
      <mesh position={[0, 3.1, 0.045]}>
        <planeGeometry args={[3.45, 1.98]} />
        <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={texture} emissiveIntensity={running ? 1.4 : 0.8} />
      </mesh>
      {/* voyant d'alimentation */}
      <mesh position={[1.62, 2.1, 0.05]} material={bulbMaterial(running ? '#7ee787' : color, running ? 2.5 : 1.2)}>
        <sphereGeometry args={[0.04, 8, 6]} />
      </mesh>
      {selected && (
        <mesh position={[0, 3.1, -0.1]}>
          <planeGeometry args={[4, 2.55]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <ShellLabel shell={shell} selected={selected} position={[0, 5.4, 0]} />
    </group>
  );
}
