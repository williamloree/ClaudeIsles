// Un shell en arrière-plan = un kakemono (rouleau suspendu) sur le parvis du hub. La commande et la
// fin de sa sortie y sont écrites à l'encre, en direct ; le clic ouvre la sortie complète.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR, STATUS_LABEL, cut, duration } from '../../format';
import { ShellLabel, clickable, tailLines } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Shell } from '../../types';
import { MAT, MONO, SERIF, fibers, seal, useFontsReady } from './materials';
import { Flame } from './Props';

const G = {
  post: new THREE.BoxGeometry(0.16, 5.3, 0.16),
  beam: new THREE.BoxGeometry(3.6, 0.16, 0.2),
  cap: new THREE.BoxGeometry(4.0, 0.1, 0.8),
  rod: new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8),
  paper: new THREE.PlaneGeometry(2.4, 4.12),
  jiku: new THREE.CylinderGeometry(0.07, 0.07, 2.6, 10),
  knob: new THREE.CylinderGeometry(0.1, 0.1, 0.14, 12),
  frame: new THREE.PlaneGeometry(2.8, 4.6),
};

function drawKakemono(ctx: CanvasRenderingContext2D, sh: Shell, seed: number) {
  const running = sh.status === 'running';
  const W = 512;
  const H = 880;
  // brocart bleu nuit semé de points d'or, puis le papier
  ctx.fillStyle = '#1d2440';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(214,176,98,0.2)';
  for (let y = 10; y < H; y += 22)
    for (let x = ((y / 22) % 2) * 11 + 6; x < W; x += 22) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, 6.283);
      ctx.fill();
    }
  ctx.fillStyle = '#c9a45a';
  ctx.fillRect(34, 92, 444, 4);
  ctx.fillRect(34, 804, 444, 4);
  ctx.fillStyle = '#ece0c2';
  ctx.fillRect(40, 100, 432, 700);
  fibers(ctx, 40, 100, 432, 700, 2200, seed);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9e2a1c';
  ctx.font = `700 64px ${SERIF}`;
  ctx.fillText('殻', 256, 182);
  ctx.font = `500 16px ${SERIF}`;
  ctx.fillStyle = '#6b5a44';
  ctx.fillText(`S H E L L  ·  ${STATUS_LABEL[sh.status].toUpperCase()}  ·  ${duration(sh.startedAt, sh.endedAt ?? undefined)}`, 256, 212);
  ctx.font = `600 20px ${MONO}`;
  ctx.fillStyle = '#a3271b';
  ctx.fillText('$ ' + cut(sh.command, 32), 256, 262);
  ctx.fillStyle = 'rgba(60,50,40,0.5)';
  ctx.fillRect(80, 284, 352, 2);
  ctx.textAlign = 'left';
  ctx.font = `18px ${MONO}`;
  const lines = tailLines(sh, 34, 11);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 ? '#0e0c0a' : running ? '#4a4034' : '#7a6e5e';
    ctx.fillText(l, 62, 330 + i * 36);
  });
  // curseur qui attend la suite, tant que la commande tourne
  if (running) {
    ctx.fillStyle = '#1b1612';
    ctx.fillRect(62, 330 + lines.length * 36 - 15, 11, 18);
  }
  seal(ctx, 392, 724, 52);
}

export function Kakemono({ shell, pos, selected }: { shell: Shell; pos: Vec3; selected: boolean }) {
  const running = shell.status === 'running';
  const color = STATUS_COLOR[shell.status];
  const pivot = useRef<THREE.Group>(null);
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 880 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.5, roughness: 0.9, side: THREE.DoubleSide }),
    [texture],
  );
  useEffect(
    () => () => {
      texture.dispose();
      mat.dispose();
    },
    [texture, mat],
  );
  const fonts = useFontsReady();
  const second = Math.floor(Date.now() / 1000);
  const seed = useMemo(() => [...shell.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 1000, [shell.id]);
  useEffect(() => {
    drawKakemono(canvas.getContext('2d')!, shell, seed);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.tail, shell.status, running ? second : 0, fonts]);
  // le rouleau, plus lumineux quand la commande tourne
  mat.emissiveIntensity = running ? 0.62 : 0.4;

  useFrame(({ clock }) => {
    if (pivot.current) pivot.current.rotation.x = Math.sin(clock.elapsedTime * 0.8 + seed) * 0.03; // la brise
  });

  // le rouleau tourne le dos au hub et fait face à l'étang
  const yaw = Math.atan2(pos[0], pos[2]);

  return (
    <group position={pos} rotation-y={yaw} {...clickable(() => useStore.getState().select({ kind: 'shell', id: shell.id }))}>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} geometry={G.post} material={MAT.wood} position={[x, 2.65, 0]} castShadow />
      ))}
      <mesh geometry={G.beam} material={MAT.wood} position-y={5.05} castShadow />
      <mesh geometry={G.cap} material={MAT.lacquer} position-y={5.32} castShadow />
      <group ref={pivot} position={[0, 4.92, 0.08]}>
        <mesh geometry={G.rod} material={MAT.wood} rotation-z={Math.PI / 2} />
        <mesh geometry={G.paper} material={mat} position-y={-2.1} />
        <mesh geometry={G.jiku} material={MAT.lacquer} rotation-z={Math.PI / 2} position-y={-4.2} />
        {[-1.36, 1.36].map((x) => (
          <mesh key={x} geometry={G.knob} material={MAT.brass} rotation-z={Math.PI / 2} position={[x, -4.2, 0]} />
        ))}
      </group>
      {/* une petite flamme au sommet du montant tant que la commande tourne */}
      {running && (
        <group position={[1.5, 5.4, 0]}>
          <Flame color="#ffb46b" scale={0.4} />
        </group>
      )}
      {selected && (
        <mesh geometry={G.frame} position={[0, 2.82, 0.14]}>
          <meshBasicMaterial color={color} transparent opacity={0.16} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      <ShellLabel shell={shell} selected={selected} position={[0, 6.6, 0]} />
    </group>
  );
}
