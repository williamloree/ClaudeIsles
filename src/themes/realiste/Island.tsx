// Une île flottante : dessus herbeux, dessous rocheux, herbe, sapins, rochers.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../scene/slots';
import type { IslandTemplate } from './islands';
import { FOLIAGE, MAT } from './materials';

// brin d'herbe : un simple triangle, instancié par milliers
const bladeGeo = new THREE.BufferGeometry();
bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0, 0.55, 0], 3));
bladeGeo.computeVertexNormals();

const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 10);

export function Fir({ h, shade = 0 }: { h: number; shade?: number }) {
  return (
    <group>
      <mesh geometry={trunkGeo} material={MAT.trunk} position={[0, h * 0.2, 0]} scale={[1, h * 0.4, 1]} castShadow />
      {[0, 1, 2, 3].map((k) => (
        <mesh
          key={k}
          geometry={coneGeo}
          material={FOLIAGE[(shade + k) % FOLIAGE.length]}
          position={[0, h * (0.38 + k * 0.17), 0]}
          scale={[h * (0.32 - k * 0.06), h * 0.42, h * (0.32 - k * 0.06)]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

function Grass({ blades }: { blades: IslandTemplate['blades'] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    m.instanceMatrix.array.set(blades.matrices);
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor = new THREE.InstancedBufferAttribute(blades.colors.slice(), 3);
    m.computeBoundingSphere();
  }, [blades]);
  return <instancedMesh ref={ref} args={[bladeGeo, MAT.blade, blades.count]} receiveShadow />;
}

export function Island({ template, position, onClick, children }: { template: IslandTemplate; position: Vec3; onClick?: () => void; children?: ReactNode }) {
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
        <mesh geometry={template.top} material={MAT.grass} receiveShadow />
        <mesh geometry={template.under} material={MAT.rock} castShadow receiveShadow />
      </group>
      <Grass blades={template.blades} />
      {template.trees.map((t, i) => (
        <group key={i} position={t.pos} rotation-y={t.rot}>
          <Fir h={t.h} shade={t.shade} />
        </group>
      ))}
      {template.rocks.map((r, i) => (
        <mesh key={i} geometry={r.geo} material={MAT.rock} position={r.pos} rotation-y={r.rot} castShadow receiveShadow />
      ))}
      {children}
    </group>
  );
}
