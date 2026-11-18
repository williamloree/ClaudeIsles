// L'explorateur d'un agent, emmitouflé dans sa parka, penché sur un pupitre où la carte
// d'expédition affiche son activité réelle. Il souffle de la buée ; il gesticule quand il travaille,
// baisse la tête quand l'expédition a échoué.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorkerInfo } from '../../scene/info';
import { clickable, drawActivity } from '../../scene/labels';
import { MAT, PARKAS, mistTex } from './materials';

const legGeo = new THREE.CylinderGeometry(0.05, 0.06, 1.15, 6);
const boardGeo = new THREE.BoxGeometry(1.95, 1.2, 0.07);
const mapGeo = new THREE.PlaneGeometry(1.82, 1.07);
const thighGeo = new THREE.CapsuleGeometry(0.12, 0.42, 4, 8);
const bootGeo = new THREE.BoxGeometry(0.2, 0.16, 0.32);
const hemGeo = new THREE.CylinderGeometry(0.36, 0.45, 0.4, 16);
const trimGeo = new THREE.TorusGeometry(0.44, 0.06, 6, 20);
const torsoGeo = new THREE.CapsuleGeometry(0.34, 0.5, 8, 16);
const hoodGeo = new THREE.SphereGeometry(0.3, 18, 14);
const ruffGeo = new THREE.TorusGeometry(0.21, 0.085, 8, 18);
const faceGeo = new THREE.SphereGeometry(0.16, 12, 10);
const packGeo = new THREE.BoxGeometry(0.5, 0.6, 0.28);
const rollGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.62, 10);
const armGeo = new THREE.CapsuleGeometry(0.1, 0.42, 4, 8);
const mittGeo = new THREE.SphereGeometry(0.1, 10, 8);

/** Carte d'expédition : papier quadrillé, côte imaginaire, itinéraire et rose des vents, puis l'activité. */
function drawMap(ctx: CanvasRenderingContext2D, info: WorkerInfo) {
  const W = 512;
  const H = 300;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ece3c9');
  g.addColorStop(1, '#cdbb92');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(90,70,40,0.16)';
  ctx.lineWidth = 1;
  for (let x = 16; x < W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 66);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 82; y < H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(40,80,120,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = 0; k <= 26; k++) {
    const x = 380 + Math.sin(k * 0.7 + info.seed) * 22 + k * 3;
    const y = 70 + k * 8.6;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(150,40,30,0.45)';
  ctx.beginPath();
  ctx.moveTo(330, 270);
  ctx.quadraticCurveTo(360, 190, 430, 120);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(470, 236);
  ctx.fillStyle = 'rgba(90,70,48,0.6)';
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(5, 0);
    ctx.lineTo(-5, 0);
    ctx.fill();
  }
  ctx.restore();
  // bandeau du titre à la couleur du statut
  ctx.fillStyle = info.color;
  ctx.fillRect(0, 0, W, 68);
  drawActivity(ctx, info, {
    bg: 'rgba(0,0,0,0)', // le fond de carte est déjà peint
    border: '#5a4630',
    title: '#0b1520',
    text: '#1d150e',
    dim: '#6b5a44',
    titleFont: "700 25px 'Josefin Sans', Inter, sans-serif",
    font: "600 18px 'JetBrains Mono', Consolas, monospace",
  });
}

export function Explorer({ info }: { info: WorkerInfo }) {
  const body = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const breath = useRef<THREE.Sprite>(null);
  const parka = PARKAS[info.seed % PARKAS.length];

  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 300 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const breathMat = useMemo(() => new THREE.SpriteMaterial({ map: mistTex, color: 0xe4f2ff, transparent: true, opacity: 0, depthWrite: false }), []);
  useEffect(
    () => () => {
      texture.dispose();
      breathMat.dispose();
    },
    [texture, breathMat],
  );
  const minute = Math.floor(Date.now() / 60e3);
  useEffect(() => {
    drawMap(canvas.getContext('2d')!, info);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.title, info.recent.join('\n'), info.status, info.color, info.toolUses, minute]);

  const run = info.status === 'running';
  const fail = info.status === 'failed' || info.status === 'killed';
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + info.seed;
    if (body.current) body.current.position.y = Math.abs(Math.sin(t * 1.2)) * 0.03;
    if (armL.current && armR.current) {
      // il trace l'itinéraire du doigt quand il travaille
      armL.current.rotation.x = run ? Math.sin(t * 6) * 0.18 : fail ? 0.9 : 0.4;
      armR.current.rotation.x = run ? Math.sin(t * 6 + 2) * 0.18 : fail ? 0.9 : 0.4;
      armR.current.rotation.y = run ? Math.sin(t * 2.3) * 0.15 : 0;
    }
    if (neck.current) neck.current.rotation.x = fail ? 0.45 : run ? 0.15 + Math.sin(t * 0.8) * 0.05 : -0.1;
    if (breath.current) {
      const ph = (t * 0.45) % 1;
      breathMat.opacity = ph < 0.6 ? Math.sin((ph / 0.6) * Math.PI) * 0.5 : 0;
      breath.current.position.set(0, 1.68 + ph * 0.3, 0.2 - ph * 0.7);
      breath.current.scale.setScalar(0.25 + ph * 0.8);
    }
  });

  return (
    <group {...clickable(info.onClick)}>
      {/* pupitre incliné portant la carte */}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} geometry={legGeo} material={MAT.wood} position={[x, 0.57, -0.8]} castShadow />
      ))}
      <group position={[0, 1.2, -0.75]} rotation-x={-0.95}>
        <mesh geometry={boardGeo} material={MAT.wood} castShadow />
        <mesh geometry={mapGeo} position={[0, 0, 0.04]}>
          <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={texture} emissiveIntensity={0.95} />
        </mesh>
      </group>

      <group ref={body} position={[0, 0, 0.45]}>
        {[-0.15, 0.15].map((x) => (
          <group key={x}>
            <mesh geometry={thighGeo} material={MAT.dark} position={[x, 0.36, 0]} castShadow />
            <mesh geometry={bootGeo} material={MAT.fur} position={[x, 0.08, -0.04]} castShadow />
          </group>
        ))}
        <mesh geometry={hemGeo} material={parka} position={[0, 0.72, 0]} castShadow />
        <mesh geometry={trimGeo} material={MAT.fur} position={[0, 0.53, 0]} rotation-x={Math.PI / 2} castShadow />
        <mesh geometry={torsoGeo} material={parka} position={[0, 1.08, 0]} castShadow />
        <group ref={neck} position={[0, 1.55, 0]}>
          <mesh geometry={hoodGeo} material={parka} position={[0, 0.14, 0]} castShadow />
          <mesh geometry={ruffGeo} material={MAT.fur} position={[0, 0.13, -0.2]} />
          <mesh geometry={faceGeo} material={MAT.face} position={[0, 0.13, -0.15]} />
        </group>
        <mesh geometry={packGeo} material={MAT.pack} position={[0, 1.12, 0.36]} castShadow />
        <mesh geometry={rollGeo} material={MAT.canvas} position={[0, 1.5, 0.36]} rotation-z={Math.PI / 2} castShadow />
        {[
          [armL, -0.38],
          [armR, 0.38],
        ].map(([ref, x]) => (
          <group key={x as number} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 1.32, 0]}>
            <mesh geometry={armGeo} material={parka} position={[0, -0.08, -0.26]} rotation-x={Math.PI / 2.4} castShadow />
            <mesh geometry={mittGeo} material={MAT.fur} position={[0, -0.16, -0.52]} />
          </group>
        ))}
      </group>
      {/* buée de la respiration */}
      <sprite ref={breath} material={breathMat} />
    </group>
  );
}
