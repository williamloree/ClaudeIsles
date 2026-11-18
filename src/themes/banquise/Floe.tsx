// Floe d'un agent : iceberg tabulaire avec son petit camp (tente, éclats de glace, congères),
// l'explorateur penché sur sa carte et la lanterne-tempête de statut.
import * as THREE from 'three';
import type { WorkerInfo } from '../../scene/info';
import { WorkerLabel, clickable } from '../../scene/labels';
import { ISLET_TOP } from '../../scene/slots';
import { FLOES, type Decor } from './bergs';
import { Explorer } from './Explorer';
import { Lantern } from './Fire';
import { MAT } from './materials';

export const moundGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const tentGeo = new THREE.ConeGeometry(1.2, 1.7, 4, 1);
const shardGeo = new THREE.OctahedronGeometry(1, 0);
const ringGeo = new THREE.RingGeometry(3.1, 3.3, 64);

const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function DecorItem({ d }: { d: Decor }) {
  switch (d.type) {
    case 'tent':
      return <mesh geometry={tentGeo} material={MAT.canvas} position={[d.pos[0], d.pos[1] + 0.85, d.pos[2]]} rotation-y={d.rot} castShadow receiveShadow />;
    case 'shard':
      return (
        <mesh
          geometry={shardGeo}
          material={MAT.clear}
          position={[d.pos[0], d.pos[1] + 0.6 * d.s, d.pos[2]]}
          rotation={[Math.sin(d.rot) * 0.25, d.rot, Math.cos(d.rot) * 0.25]}
          scale={[d.s * 0.5, d.s * 1.6, d.s * 0.5]}
          castShadow
        />
      );
    case 'mound':
      return <mesh geometry={moundGeo} material={MAT.snow} position={[d.pos[0], d.pos[1] - 0.05, d.pos[2]]} scale={[d.s, d.s * d.rot, d.s]} receiveShadow castShadow />;
  }
}

export function Floe({ info }: { info: WorkerInfo }) {
  const [x, , z] = info.pos;
  const angle = Math.atan2(z, x);
  const toHub = angle + Math.PI;
  const lanternAngle = angle + 1.2;
  const tpl = FLOES[info.slot];
  // rien dans l'arrivée de la passerelle ni sous la lanterne ni devant l'explorateur
  const decor = tpl.decor.filter((d) => angDist(d.angle, toHub) > 0.7 && angDist(d.angle, lanternAngle) > 0.5 && angDist(d.angle, angle) > 0.45);
  return (
    <group position={[x, 0, z]}>
      <group {...clickable(info.onClick)}>
        <mesh geometry={tpl.geo} material={MAT.berg} castShadow receiveShadow />
      </group>
      {decor.map((d, i) => (
        <DecorItem key={i} d={d} />
      ))}
      {/* l'explorateur tourne le dos au large et regarde le phare */}
      <group position={[0, ISLET_TOP, 0]} rotation-y={-angle + Math.PI / 2}>
        <Explorer info={info} />
      </group>
      <group position={[Math.cos(lanternAngle) * 2.6, ISLET_TOP, Math.sin(lanternAngle) * 2.6]} rotation-y={-angle}>
        <Lantern color={info.color} glow={info.status === 'running' ? 1.2 : 0.9} />
      </group>
      {info.selected && (
        <mesh geometry={ringGeo} rotation-x={-Math.PI / 2} position={[0, ISLET_TOP + 0.04, 0]}>
          <meshBasicMaterial color={info.color} transparent opacity={0.75} toneMapped={false} />
        </mesh>
      )}
      <WorkerLabel info={info} position={[0, ISLET_TOP + 4.6, 0]} />
    </group>
  );
}
