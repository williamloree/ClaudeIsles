// Un shell en arrière-plan = une tablette de nacre sur une colonne de corail, au bord du parvis.
// La commande et la fin de sa sortie y luisent en direct ; le clic ouvre la sortie complète.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR, STATUS_LABEL, cut, duration } from '../../format';
import { ShellLabel, clickable, tailLines } from '../../scene/labels';
import type { Vec3 } from '../../scene/slots';
import { useStore } from '../../store';
import type { Shell } from '../../types';
import { Batch, CORALS, branchCoral, fbm, glowTex, mat4, rng } from './materials';

// Nacre : reflets irisés peints une fois (plus léger qu'un matériau à iridescence).
const nacreTex = (() => {
  const r = rng(12);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, '#e9f2f6');
  g.addColorStop(0.35, '#f3e6f4');
  g.addColorStop(0.65, '#ddf4ef');
  g.addColorStop(1, '#efe8da');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `hsla(${160 + r() * 160},70%,75%,0.18)`;
    ctx.lineWidth = 2 + r() * 10;
    ctx.beginPath();
    ctx.arc(r() * 400 - 70, r() * 400 - 70, 40 + r() * 200, 0, 7);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const nacreMat = new THREE.MeshStandardMaterial({ map: nacreTex, metalness: 0.35, roughness: 0.25, emissive: 0x16303a, emissiveIntensity: 0.4 });
const slabGeo = new THREE.BoxGeometry(2.8, 3.8, 0.22);
const faceGeo = new THREE.PlaneGeometry(2.6, 3.6);
const haloGeo = new THREE.PlaneGeometry(3.1, 4.2);

// Colonnes de corail torsadées (une par emplacement), garnies de petits coraux branchus.
const columns = Array.from({ length: 8 }, (_, i) => {
  const r = rng(700 + i);
  const b = new Batch();
  const cg = new THREE.CylinderGeometry(0.45, 0.8, 2.4, 14, 12);
  const p = cg.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const y = p.getY(j);
    const k = 1 + fbm(p.getX(j) * 1.5 + i, y * 0.8, p.getZ(j) * 1.5, 3) * 0.6;
    const tw = y * 0.8;
    const cx = p.getX(j) * k;
    const cz = p.getZ(j) * k;
    p.setX(j, cx * Math.cos(tw) - cz * Math.sin(tw));
    p.setZ(j, cx * Math.sin(tw) + cz * Math.cos(tw));
  }
  cg.computeVertexNormals();
  b.add(CORALS[(i + 1) % 5], cg, mat4(0, 1.2, 0));
  for (let k = 0; k < 2; k++) branchCoral(b, CORALS[(i + k + 2) % 5], 0.5, 0.08, 2, mat4((k ? 1 : -1) * 0.9, 0, 0.3, 0, r() * 6.28, 0), r);
  return b.build();
});

function drawNacre(ctx: CanvasRenderingContext2D, sh: Shell) {
  const running = sh.status === 'running';
  const g = ctx.createLinearGradient(0, 0, 512, 768);
  g.addColorStop(0, '#0d2433');
  g.addColorStop(0.5, '#123241');
  g.addColorStop(1, '#1d2440');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 768);
  const r = rng(sh.id.length * 31 + 5);
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `hsla(${160 + r() * 160},80%,75%,0.07)`;
    ctx.lineWidth = 6 + r() * 20;
    ctx.beginPath();
    ctx.arc(r() * 900 - 200, r() * 1100 - 200, 150 + r() * 350, 0, 7);
    ctx.stroke();
  }
  ctx.strokeStyle = running ? '#9fd8d8' : '#5f8a8f';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 472, 728);
  ctx.strokeRect(30, 30, 452, 708);
  ctx.textAlign = 'center';
  ctx.fillStyle = running ? '#bff6ff' : '#7fa9b0';
  ctx.font = '30px Georgia, serif';
  ctx.fillText('~ CONQUE ~', 256, 82);
  ctx.font = "600 21px 'JetBrains Mono', Consolas, monospace";
  ctx.fillStyle = running ? '#e6fbff' : '#a9c6cb';
  ctx.fillText('$ ' + cut(sh.command, 32), 256, 132);
  ctx.font = '16px Inter, sans-serif';
  ctx.fillStyle = STATUS_COLOR[sh.status];
  ctx.fillText(`${STATUS_LABEL[sh.status]} · ${duration(sh.startedAt, sh.endedAt ?? undefined)}`, 256, 164);
  ctx.textAlign = 'left';
  ctx.font = "19px 'JetBrains Mono', Consolas, monospace";
  const lines = tailLines(sh, 34, 15);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 && running ? '#e8fffb' : running ? '#7fd8d0' : '#6f9ea0';
    ctx.fillText(l, 44, 214 + i * 34);
  });
}

export function NacreTablet({ shell, pos, slot, selected }: { shell: Shell; pos: Vec3; slot: number; selected: boolean }) {
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
    drawNacre(canvas.getContext('2d')!, shell);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.tail, shell.status, running ? second : 0]);

  const glowMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color: '#7ff6ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), []);
  useEffect(() => () => glowMat.dispose(), [glowMat]);
  const glow = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    if (glow.current) glow.current.scale.setScalar(1.2 + Math.sin(clock.elapsedTime * 3 + slot) * 0.3);
  });

  // la tablette tourne le dos au dôme et fait face au large
  const yaw = Math.atan2(pos[0], pos[2]);

  return (
    <group position={pos} rotation-y={yaw} {...clickable(() => useStore.getState().select({ kind: 'shell', id: shell.id }))}>
      <primitive object={columns[slot % columns.length]} />
      <mesh geometry={slabGeo} material={nacreMat} position={[0, 4.2, 0]} castShadow receiveShadow />
      <mesh geometry={faceGeo} position={[0, 4.2, 0.12]}>
        <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={texture} emissiveIntensity={running ? 1.2 : 0.65} />
      </mesh>
      {/* une perle lumineuse au sommet tant que la commande tourne */}
      {running && <sprite ref={glow} material={glowMat} position={[0, 6.45, 0.05]} />}
      {selected && (
        <mesh geometry={haloGeo} position={[0, 4.2, 0.2]}>
          <meshBasicMaterial color={color} transparent opacity={0.18} toneMapped={false} />
        </mesh>
      )}
      <ShellLabel shell={shell} selected={selected} position={[0, 7.1, 0]} />
    </group>
  );
}
