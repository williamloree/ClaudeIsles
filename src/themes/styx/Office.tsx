// Sur chaque îlot : l'esprit de l'agent, assis à une table de pierre, écrit sur une tablette
// où s'inscrit son activité réelle. Le brasero prend la couleur du statut.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { WorkerInfo } from '../../scene/info';
import { WorkerLabel, clickable, drawActivity } from '../../scene/labels';
import type { Status } from '../../types';
import { Brazier } from './Fire';
import { Ghost, type GhostPose } from './Ghost';
import { MAT } from './materials';

const tabletMat = new THREE.MeshStandardMaterial({ color: 0x222018, roughness: 0.8 });

function poseOf(s: Status): GhostPose {
  if (s === 'running') return 'write';
  if (s === 'completed') return 'idle';
  return 'mourn';
}

export function Office({ info }: { info: WorkerInfo }) {
  const color = info.color;
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 300 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const minute = Math.floor(Date.now() / 60e3);
  useEffect(() => {
    drawActivity(canvas.getContext('2d')!, info, {
      bg: '#1b1712',
      border: '#6d5532',
      title: color,
      text: '#f1e4c8',
      dim: '#a8977a',
      titleFont: '700 24px Cinzel, Georgia, serif',
      font: "17px 'JetBrains Mono', Consolas, monospace",
    });
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.title, info.recent.join('\n'), info.status, info.toolUses, minute]);

  return (
    <group {...clickable(info.onClick)}>
      {/* table de pierre et tablette gravée */}
      <mesh position={[0, 0.45, -0.7]} material={MAT.marble} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.9, 1.1]} />
      </mesh>
      <group position={[0, 1.35, -1.05]} rotation={[-0.15, 0, 0]}>
        <mesh material={tabletMat} castShadow>
          <boxGeometry args={[1.6, 1, 0.12]} />
        </mesh>
        {/* gravée des deux côtés : lisible pour l'esprit comme pour qui arrive par le fleuve */}
        {[0, Math.PI].map((ry) => (
          <mesh key={ry} position={[0, 0, ry ? -0.065 : 0.065]} rotation-y={ry}>
            <planeGeometry args={[1.5, 0.88]} />
            <meshStandardMaterial color="#000" emissive="#fff" emissiveMap={texture} emissiveIntensity={1.15} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.25, 0.6]} material={MAT.marble} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.5, 0.6]} />
      </mesh>

      <group position={[0, 1.5, 0.5]}>
        <Ghost color={color} pose={poseOf(info.status)} seed={info.seed} scale={1.2} />
      </group>

      <group position={[2.4, 0, 0.6]}>
        <Brazier color={color} scale={0.9} />
      </group>

      {info.selected && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[3.1, 3.3, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      )}

      <WorkerLabel info={info} position={[0, 4.4, 0]} />
    </group>
  );
}
