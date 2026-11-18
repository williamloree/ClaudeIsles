// Îlot de basalte sortant du Styx, dallé de marbre, avec ses ruines.
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../scene/slots';
import type { Decor, IsletTemplate } from './islands';
import { MAT } from './materials';

const flowerMat = new THREE.PointsMaterial({ color: 0xe9e2c8, size: 0.22, sizeAttenuation: true });

export function Column({ h, r = 0.35 }: { h: number; r?: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} material={MAT.marble} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.9, r, h, 20]} />
      </mesh>
      {[0.12, h - 0.12].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={MAT.marble} castShadow receiveShadow>
          <boxGeometry args={[r * 2.6, 0.24, r * 2.6]} />
        </mesh>
      ))}
    </group>
  );
}

export function Cypress({ h }: { h: number }) {
  return (
    <group>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[0, h * (0.42 + k * 0.17), 0]} material={MAT.cypress} castShadow>
          <coneGeometry args={[h * (0.13 - k * 0.025), h * (0.75 - k * 0.12), 9]} />
        </mesh>
      ))}
    </group>
  );
}

function DecorItem({ d }: { d: Decor }) {
  switch (d.type) {
    case 'column':
      return (
        <group position={d.pos}>
          <Column h={d.h} />
        </group>
      );
    case 'fallen':
      return (
        <group position={[d.pos[0], d.pos[1] + 0.35, d.pos[2]]} rotation={[0, d.angle, Math.PI / 2]}>
          <Column h={3} />
        </group>
      );
    case 'cypress':
      return (
        <group position={d.pos}>
          <Cypress h={d.h} />
        </group>
      );
    case 'urn':
      return (
        <group position={d.pos} scale={d.s}>
          <mesh position={[0, 0.45, 0]} material={MAT.bronze} castShadow>
            <sphereGeometry args={[0.35, 16, 12]} />
          </mesh>
          <mesh position={[0, 0.85, 0]} material={MAT.bronze}>
            <cylinderGeometry args={[0.18, 0.12, 0.3, 14]} />
          </mesh>
        </group>
      );
  }
}

const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export function Islet({
  template,
  position,
  clearAngle,
  children,
  onClick,
}: {
  template: IsletTemplate;
  position: Vec3;
  /** Direction (repère de l'îlot) où arrive le pont : pas de ruine dans le passage. */
  clearAngle?: number;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const flowers = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(template.flowers, 3));
    return g;
  }, [template]);
  const decor = clearAngle === undefined ? template.decor : template.decor.filter((d) => angDist(d.angle, clearAngle) > 0.55);
  const R = template.radius;
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
        <mesh geometry={template.rock} material={MAT.basalt} castShadow receiveShadow />
        <mesh position={[0, 1.9, 0]} material={MAT.marble} receiveShadow castShadow>
          <cylinderGeometry args={[R * 0.78, R * 0.8, 0.35, 64]} />
        </mesh>
        <mesh position={[0, 1.68, 0]} material={MAT.marble} receiveShadow>
          <cylinderGeometry args={[R * 0.84, R * 0.86, 0.2, 64]} />
        </mesh>
      </group>
      <points geometry={flowers} material={flowerMat} />
      {decor.map((d, i) => (
        <DecorItem key={i} d={d} />
      ))}
      {children}
    </group>
  );
}
