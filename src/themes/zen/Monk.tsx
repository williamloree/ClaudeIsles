// Sur chaque îlot : un moine assis en seiza sur son tatami, devant une table basse où se déroule
// un rouleau qui affiche son activité réelle. La lanterne de pierre prend la couleur du statut.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_LABEL } from '../../format';
import type { WorkerInfo } from '../../scene/info';
import { WorkerLabel, clickable, drawActivity } from '../../scene/labels';
import { ISLET_TOP } from '../../scene/slots';
import { MAT, MONO, SERIF, fibers, seal, useFontsReady } from './materials';
import { Rock, Toro, Tree, type TreeKind } from './Props';

const G = {
  tatami: new THREE.BoxGeometry(3.4, 0.1, 2.8),
  table: new THREE.BoxGeometry(2.1, 0.08, 0.9),
  leg: new THREE.BoxGeometry(0.08, 0.4, 0.08),
  paper: new THREE.PlaneGeometry(1.6, 0.94),
  roller: new THREE.CylinderGeometry(0.05, 0.05, 1.08, 10),
  stand: new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6),
  ink: new THREE.BoxGeometry(0.3, 0.06, 0.2),
  zabuton: new THREE.BoxGeometry(0.95, 0.14, 0.95),
  robe: new THREE.LatheGeometry(
    [[0, 0], [0.58, 0], [0.6, 0.12], [0.48, 0.32], [0.34, 0.66], [0.3, 0.86], [0.12, 0.96], [0, 0.98]].map(([x, y]) => new THREE.Vector2(x, y)),
    24,
  ),
  kesa: new THREE.BoxGeometry(0.72, 0.14, 0.66),
  head: new THREE.SphereGeometry(0.19, 20, 16),
  halo: new THREE.TorusGeometry(0.33, 0.022, 8, 48),
  arm: new THREE.CapsuleGeometry(0.08, 0.45, 4, 8),
  brush: new THREE.CylinderGeometry(0.015, 0.008, 0.36, 6),
  ring: new THREE.RingGeometry(3.6, 3.85, 64),
};
const LEGS: [number, number][] = [[-0.95, -0.45], [0.95, -0.45], [-0.95, -1.25], [0.95, -1.25]];
const TREES: TreeKind[] = ['maple', 'pine', 'sakura', 'pine'];

/** Le moine : posture selon le statut (il écrit, il contemple, ou il baisse la tête). */
function MonkBody({ info }: { info: WorkerInfo }) {
  const body = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(info.color).multiplyScalar(2.2), toneMapped: false }), [info.color]);
  useEffect(() => () => haloMat.dispose(), [haloMat]);
  const run = info.status === 'running';
  const sad = info.status !== 'running' && info.status !== 'completed';
  const i = info.seed;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 1.4 + i) * 0.015; // respiration
    if (armR.current) {
      armR.current.rotation.x = run ? -0.45 + Math.sin(t * 6 + i) * 0.1 : sad ? -1.1 : -0.85;
      armR.current.rotation.y = run ? Math.sin(t * 2.7 + i) * 0.18 : 0;
    }
    if (armL.current) armL.current.rotation.x = run ? -0.55 : sad ? -1.1 : -0.85;
    if (neck.current) neck.current.rotation.x = sad ? -0.45 : run ? -0.2 + Math.sin(t * 0.8 + i) * 0.04 : -0.05;
    if (halo.current) halo.current.scale.setScalar(run ? 1 + Math.sin(t * 3 + i) * 0.06 : 1);
  });
  return (
    <group ref={body} position={[0, 0.24, 0.55]}>
      <mesh geometry={G.robe} material={MAT.robe} castShadow />
      <mesh geometry={G.kesa} material={MAT.kesa} position-y={0.62} rotation-z={0.65} castShadow />
      <group ref={neck} position-y={0.94}>
        <mesh geometry={G.head} material={MAT.skin} position-y={0.2} castShadow />
        <mesh ref={halo} geometry={G.halo} material={haloMat} position={[0, 0.22, 0.2]} />
      </group>
      {[-0.27, 0.27].map((x) => (
        <group key={x} ref={x < 0 ? armL : armR} position={[x, 0.8, 0]}>
          <mesh geometry={G.arm} material={MAT.robe} position={[0, -0.05, -0.28]} rotation-x={Math.PI / 2.3} castShadow />
          {x > 0 && <mesh geometry={G.brush} material={MAT.wood} position={[0, -0.1, -0.58]} rotation-x={0.4} />}
        </group>
      ))}
    </group>
  );
}

/** Rouleau sur son support : l'activité de l'agent écrite à l'encre, avec le sceau du jardin. */
function Scroll({ info }: { info: WorkerInfo }) {
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 300 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.5, roughness: 0.9 }), [texture]);
  useEffect(
    () => () => {
      texture.dispose();
      mat.dispose();
    },
    [texture, mat],
  );
  const fonts = useFontsReady();
  const minute = Math.floor(Date.now() / 60e3);
  useEffect(() => {
    const ctx = canvas.getContext('2d')!;
    drawActivity(ctx, info, {
      bg: '#ece0c2',
      border: '#7a2a1e',
      title: '#1b1612',
      text: '#14100c',
      dim: '#6b5a44',
      titleFont: `700 25px ${SERIF}`,
      font: `18px ${MONO}`,
    });
    fibers(ctx, 14, 14, 484, 272, 900, info.seed + 1);
    // statut en bas à droite, puis le sceau du jardin
    ctx.font = `600 14px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4a3c2c';
    ctx.fillText(STATUS_LABEL[info.status].toUpperCase(), 426, 279);
    const w = ctx.measureText(STATUS_LABEL[info.status].toUpperCase()).width;
    ctx.fillStyle = info.color;
    ctx.strokeStyle = '#1b1612';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(426 - w - 14, 274, 7, 0, 6.283);
    ctx.fill();
    ctx.stroke();
    seal(ctx, 440, 236, 44);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.title, info.recent.join('\n'), info.status, info.toolUses, info.color, minute, fonts]);

  return (
    <group position={[0, 1.4, -1.0]} rotation-x={-0.12}>
      {/* écrit des deux côtés : lisible pour le moine comme pour qui arrive par l'étang */}
      {[0, Math.PI].map((ry) => (
        <mesh key={ry} geometry={G.paper} material={mat} rotation-y={ry} position-z={ry ? -0.006 : 0.006} />
      ))}
      {[-0.83, 0.83].map((x) => (
        <group key={x} position-x={x}>
          <mesh geometry={G.roller} material={MAT.wood} castShadow />
          <mesh geometry={G.stand} material={MAT.wood} position={[0, -0.66, 0.03]} />
        </group>
      ))}
    </group>
  );
}

/** L'îlot d'un agent : tatami, table basse, rouleau, moine, lanterne de statut, arbre et rochers. */
export function MonkIsle({ info, angle }: { info: WorkerInfo; angle: number }) {
  // repère tourné : le moine regarde vers l'extérieur, le pont arrive dans son dos (côté hub)
  const loc = (a: number, d: number) => [Math.cos(angle + a) * d, ISLET_TOP, Math.sin(angle + a) * d] as [number, number, number];
  const running = info.status === 'running';
  return (
    <>
      <group position-y={ISLET_TOP} rotation-y={-angle - Math.PI / 2} {...clickable(info.onClick)}>
        <mesh geometry={G.tatami} material={MAT.tatami} position={[0, 0.05, -0.1]} receiveShadow />
        <mesh geometry={G.table} material={MAT.lacquer} position={[0, 0.45, -0.85]} castShadow />
        {LEGS.map(([x, z]) => (
          <mesh key={`${x},${z}`} geometry={G.leg} material={MAT.lacquer} position={[x, 0.22, z]} />
        ))}
        <mesh geometry={G.ink} material={MAT.lacquer} position={[0.7, 0.52, -0.6]} />
        <mesh geometry={G.zabuton} material={MAT.zabuton} position={[0, 0.17, 0.55]} castShadow receiveShadow />
        <Scroll info={info} />
        <MonkBody info={info} />
        {info.selected && (
          <mesh geometry={G.ring} rotation-x={-Math.PI / 2} position-y={0.14}>
            <meshBasicMaterial color={info.color} transparent opacity={0.75} toneMapped={false} />
          </mesh>
        )}
      </group>
      <group position={loc(1.2, 3.7)} {...clickable(info.onClick)}>
        <Toro scale={1} color={info.color} light={running ? 12 : 7} flame={running ? 1.25 : 1} />
      </group>
      <group position={loc(-1.2, 4.4)}>
        <Tree h={5 + (info.seed % 10) * 0.15} kind={TREES[info.slot % 4]} seed={info.seed} />
      </group>
      {([[-0.15, 5.3, 1.1], [2.45, 4.9, 0.8], [-2.45, 5, 0.9], [0.4, 5.6, 0.5]] as const).map(([a, d, s], k) => (
        <Rock key={k} size={s} seed={info.seed + k} position={loc(a, d)} />
      ))}
      <WorkerLabel info={info} position={[0, ISLET_TOP + 5, 0]} />
    </>
  );
}
