// Sur chaque îlot : l'esprit de l'agent, assis à une table de pierre, écrit sur une tablette
// où s'inscrit son activité réelle. Le brasero prend la couleur du statut.
import { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { STATUS_COLOR, STATUS_LABEL, cut, duration } from '../format';
import type { Status } from '../types';
import { Brazier } from './Fire';
import { Ghost, type GhostPose } from './Ghost';
import { labelLayer } from './labels';
import { MAT } from './materials';

export interface OfficeInfo {
  title: string;
  subtitle: string;
  status: Status;
  startedAt: number;
  endedAt: number | null;
  toolUses: number;
  activity: string | null;
  recent: string[];
  badge: string;
  selected: boolean;
  seed: number;
}

const tabletMat = new THREE.MeshStandardMaterial({ color: 0x222018, roughness: 0.8 });

function poseOf(s: Status): GhostPose {
  if (s === 'running') return 'write';
  if (s === 'completed') return 'idle';
  return 'mourn';
}

function drawTablet(ctx: CanvasRenderingContext2D, info: OfficeInfo, color: string) {
  ctx.fillStyle = '#1b1712';
  ctx.fillRect(0, 0, 512, 300);
  ctx.strokeStyle = '#6d5532';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 284);
  ctx.fillStyle = color;
  ctx.font = "700 24px Cinzel, Georgia, serif";
  ctx.textAlign = 'center';
  ctx.fillText(cut(info.title, 30).toUpperCase(), 256, 52);
  ctx.textAlign = 'left';
  ctx.font = "17px 'JetBrains Mono', Consolas, monospace";
  const lines = (info.recent.length ? info.recent : [info.activity || '…']).slice(-5);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 ? '#f1e4c8' : '#a8977a';
    ctx.fillText('› ' + cut(l, 40), 30, 100 + i * 36);
  });
  ctx.fillStyle = '#8a7a5e';
  ctx.fillText(`${info.toolUses} outils · ${duration(info.startedAt, info.endedAt ?? undefined)}`, 30, 280);
}

export function Office({ info, onClick }: { info: OfficeInfo; onClick: () => void }) {
  const color = STATUS_COLOR[info.status];
  const running = info.status === 'running';
  const canvas = useMemo(() => Object.assign(document.createElement('canvas'), { width: 512, height: 300 }), []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  const minute = Math.floor(Date.now() / 60e3);
  useEffect(() => {
    drawTablet(canvas.getContext('2d')!, info, color);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.title, info.recent.join('\n'), info.status, info.toolUses, minute]);

  return (
    <group
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

      <Html position={[0, 4.4, 0]} center zIndexRange={[40, 0]} portal={labelLayer}>
        <div className={`isle-label ${info.selected ? 'selected' : ''} ${running || info.selected ? '' : 'mini'}`} style={{ ['--c' as string]: color }} onClick={onClick}>
          <div className="isle-badge">
            {info.badge} <span>{STATUS_LABEL[info.status]}</span>
          </div>
          <div className="isle-title">{cut(info.title, running || info.selected ? 46 : 28)}</div>
          {(running || info.selected) && (
            <>
              <div className="isle-sub">
                {info.subtitle} · {duration(info.startedAt, info.endedAt ?? undefined)} · {info.toolUses} outils
              </div>
              {info.activity && <div className="isle-act">{cut(info.activity, 54)}</div>}
            </>
          )}
        </div>
      </Html>
    </group>
  );
}
