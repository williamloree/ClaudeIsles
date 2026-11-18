// Un shell en arrière-plan = un terminal vertical sur le parvis de la tour : écran vert tant que la
// commande tourne, ambre une fois finie, rouge en échec. La fin de la sortie s'y affiche en direct.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_LABEL, cut, duration } from '../../format';
import { ShellLabel, clickable, tailLines } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Shell, Status } from '../../types';
import { useFontsReady } from './fonts';
import { MAT, MONO, neon, scanlines } from './materials';

const SCREEN: Partial<Record<Status, { fg: string; bg: string }>> = {
  running: { fg: '#39ff88', bg: '#010a04' },
  failed: { fg: '#ff4a5a', bg: '#0d0103' },
  killed: { fg: '#ff4a5a', bg: '#0d0103' },
};
const AMBER = { fg: '#ffb000', bg: '#0d0700' };

const screenGeo = new THREE.PlaneGeometry(2.85, 4.25);
const sweepGeo = new THREE.PlaneGeometry(2.85, 0.25);

function drawTerminal(ctx: CanvasRenderingContext2D, sh: Shell, fg: string, bg: string) {
  const running = sh.status === 'running';
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 768);
  ctx.shadowColor = fg;
  ctx.shadowBlur = 8;
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.font = `600 22px ${MONO}`;
  ctx.fillText('■ TERMINAL', 34, 56);
  ctx.textAlign = 'right';
  ctx.fillText(STATUS_LABEL[sh.status].toUpperCase(), 478, 56);
  ctx.textAlign = 'left';
  ctx.fillRect(34, 72, 444, 2);
  ctx.font = `600 21px ${MONO}`;
  ctx.fillText(cut('$ ' + sh.command, 34), 34, 112);
  ctx.globalAlpha = 0.7;
  ctx.font = `17px ${MONO}`;
  ctx.fillText(`${sh.shell} · ${duration(sh.startedAt, sh.endedAt ?? undefined)}`, 34, 142);
  ctx.font = `19px ${MONO}`;
  const lines = tailLines(sh, 36, 16);
  lines.forEach((l, i) => {
    ctx.globalAlpha = i === lines.length - 1 ? 1 : 0.72;
    ctx.fillText(l, 34, 190 + i * 34);
  });
  ctx.globalAlpha = 1;
  // curseur qui attend la suite
  if (running) ctx.fillRect(34 + Math.min(36, lines.at(-1)!.length) * 11.5 + 4, 190 + (lines.length - 1) * 34 - 18, 12, 22);
  ctx.shadowBlur = 0;
  scanlines(ctx, 512, 768);
  const v = ctx.createRadialGradient(256, 384, 200, 256, 384, 480);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 512, 768);
}

export function ShellTerminal({ shell, pos, selected }: { shell: Shell; pos: Vec3; selected: boolean }) {
  const running = shell.status === 'running';
  const { fg, bg } = SCREEN[shell.status] ?? AMBER;
  const fonts = useFontsReady();
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 768 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const screenMat = useMemo(() => new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(1.3, 1.3, 1.3) }), [texture]);
  const sweepMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(fg).multiplyScalar(0.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), [fg]);
  useEffect(() => () => (texture.dispose(), screenMat.dispose()), [texture, screenMat]);
  useEffect(() => () => sweepMat.dispose(), [sweepMat]);
  const second = Math.floor(Date.now() / 1000);
  useEffect(() => {
    drawTerminal(canvas.getContext('2d')!, shell, fg, bg);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.tail, shell.status, running ? second : 0, fonts]);

  // la barre de balayage ne descend que tant que la commande tourne
  const sweep = useRef<THREE.Mesh>(null);
  const ph = pos[0] * 0.13;
  useFrame(({ clock }) => {
    if (!sweep.current) return;
    sweep.current.visible = running;
    sweep.current.position.y = 3.5 + 2 - ((clock.elapsedTime * 0.35 + ph) % 1) * 4;
  });

  // face vers l'extérieur (on le voit en arrivant des plateformes)
  const yaw = Math.atan2(pos[0], pos[2]);
  const select = () => useStore.getState().select({ kind: 'shell', id: shell.id });

  return (
    <group position={pos} rotation-y={yaw} {...clickable(select)}>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x, 0.65, 0]} material={MAT.metal}>
          <boxGeometry args={[0.18, 1.3, 0.18]} />
        </mesh>
      ))}
      <mesh position-y={3.5} material={MAT.dark}>
        <boxGeometry args={[3.1, 4.5, 0.3]} />
      </mesh>
      <mesh geometry={screenGeo} material={screenMat} position={[0, 3.5, 0.16]} />
      {/* écran double face : lisible aussi depuis la tour */}
      <mesh geometry={screenGeo} material={screenMat} position={[0, 3.5, -0.16]} rotation-y={Math.PI} />
      <mesh ref={sweep} geometry={sweepGeo} material={sweepMat} position-z={0.17} />
      <mesh position={[0, 5.78, 0.12]} material={neon(fg, running ? 2.2 : 1.2)}>
        <boxGeometry args={[3.1, 0.06, 0.06]} />
      </mesh>
      {selected && (
        // cadre néon autour de l'écran (anneau carré étiré)
        <mesh position={[0, 3.5, 0.2]} scale={[0.78, 1.15, 1]} material={neon(fg, 2)}>
          <ringGeometry args={[2.75, 2.95, 4, 1, Math.PI / 4]} />
        </mesh>
      )}
      <ShellLabel shell={shell} selected={selected} position={[0, 7, 0]} />
    </group>
  );
}
