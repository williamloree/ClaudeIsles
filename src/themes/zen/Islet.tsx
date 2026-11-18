// Îlot de roche moussue sortant de l'étang, couronné d'un tapis de mousse.
import { useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { ISLET_TOP, type Vec3 } from '../../scene/slots';
import { MAT, fbm, leafGeo, rng } from './materials';

const BASE_H = 9;

function rockGeometry(radius: number, seed: number) {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.35, BASE_H, 72, 8, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const y = p.getY(i);
    const k = 1 + fbm(Math.cos(a) * 2 + seed, y * 0.25, Math.sin(a) * 2, 5) * 0.35 * (y < 4.4 ? 1 : 0.25);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export function Islet({ radius, seed, position, onClick, children }: { radius: number; seed: number; position: Vec3; onClick?: () => void; children?: ReactNode }) {
  const { rock, cap, tufts } = useMemo(() => {
    const r = rng(Math.round(seed * 1000) + 3);
    const tufts = Array.from({ length: 6 }, () => {
      const a = r() * Math.PI * 2;
      return { pos: [Math.cos(a) * radius * 0.86, ISLET_TOP - 0.05, Math.sin(a) * radius * 0.86] as Vec3, s: [0.6 + r() * 0.7, 0.25 + r() * 0.2, 0.6 + r() * 0.7] as Vec3 };
    });
    return { rock: rockGeometry(radius, seed), cap: new THREE.CylinderGeometry(radius * 0.94, radius * 0.99, 0.4, 64), tufts };
  }, [radius, seed]);
  useEffect(
    () => () => {
      rock.dispose();
      cap.dispose();
    },
    [rock, cap],
  );
  return (
    <group position={position}>
      <group
        onClick={(e) => {
          if (!onClick) return;
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => onClick && (e.stopPropagation(), (document.body.style.cursor = 'pointer'))}
        onPointerOut={() => onClick && (document.body.style.cursor = '')}
      >
        {/* le sommet de la roche affleure juste sous la mousse (ISLET_TOP) */}
        <mesh geometry={rock} material={MAT.stone} position-y={ISLET_TOP - 0.17 - BASE_H / 2} castShadow receiveShadow />
        <mesh geometry={cap} material={MAT.moss} position-y={ISLET_TOP - 0.2} castShadow receiveShadow />
        {tufts.map((t, i) => (
          <mesh key={i} geometry={leafGeo} material={MAT.moss} position={t.pos} scale={t.s} castShadow receiveShadow />
        ))}
      </group>
      {children}
    </group>
  );
}
