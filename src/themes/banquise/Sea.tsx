// Mer arctique noire qui reflète l'aurore, plaques de glace dérivantes, icebergs lointains et brume froide.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { BRIDGE_ENDS, ISLAND_SLOTS } from '../../scene/slots';
import { MAT, fbm, mistTex, noise, rng, waterNormals } from './materials';

function ArcticWater() {
  const water = useMemo(() => {
    const w = new Water(new THREE.PlaneGeometry(3000, 3000), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(-0.25, 0.55, -0.8).normalize(),
      sunColor: 0x2f8f74,
      waterColor: 0x01070d,
      distortionScale: 1.1,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    return w;
  }, []);
  useEffect(
    () => () => {
      water.geometry.dispose();
      (water.material as THREE.Material).dispose();
    },
    [water],
  );
  useFrame((_, dt) => {
    (water.material as THREE.ShaderMaterial).uniforms.time.value += dt * 0.22;
  });
  return <primitive object={water} />;
}

// ---------- Plaques de glace ----------
const PLATE_GEOS = Array.from({ length: 6 }, (_, k) => {
  const r = rng(600 + k);
  const sh = new THREE.Shape();
  const m = 9 + k;
  for (let j = 0; j < m; j++) {
    const a = (j / m) * 6.283;
    const rad = 0.78 + r() * 0.22 + noise.noise(Math.cos(a) * 1.5, Math.sin(a) * 1.5, k + 0.5) * 0.35;
    if (j) sh.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else sh.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  return geo;
});

const segDist = (px: number, pz: number, a: number[], b: number[]) => {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const L2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[2]) * dz) / L2));
  return Math.hypot(px - a[0] - dx * t, pz - a[2] - dz * t);
};

// Placement fixe : les plaques évitent tous les emplacements de floes et de passerelles (occupés ou non)
// et laissent libre le chenal des anciens agents (rayon 62 à 90).
const PLATES = (() => {
  const r = rng(2024);
  const out: { geo: number; m: THREE.Matrix4 }[] = [];
  const o = new THREE.Object3D();
  for (let tries = 0; out.length < 150 && tries < 4000; tries++) {
    const near = r() < 0.55;
    const d = near ? 21 + r() * 40 : 92 + r() * 210;
    const a = r() * Math.PI * 2;
    const s = near ? 1 + r() * 2.2 : 2 + r() * 5;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (near && ISLAND_SLOTS.some((p, i) => Math.hypot(x - p[0], z - p[2]) < 9.5 + s || segDist(x, z, BRIDGE_ENDS[i][0], BRIDGE_ENDS[i][1]) < 3 + s)) continue;
    if (near && d > 60) continue;
    o.position.set(x, -0.14, z);
    o.rotation.set(0, r() * 6.283, 0);
    o.scale.set(s * (0.8 + r() * 0.5), 0.7 + r() * 0.5, s);
    o.updateMatrix();
    out.push({ geo: out.length % 6, m: o.matrix.clone() });
  }
  return PLATE_GEOS.map((_, k) => out.filter((p) => p.geo === k).map((p) => p.m));
})();

function Plates() {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    PLATES.forEach((ms, k) => {
      const mesh = refs.current[k];
      if (!mesh) return;
      ms.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, []);
  return (
    <>
      {PLATE_GEOS.map((g, k) => (
        <instancedMesh key={k} ref={(m) => void (refs.current[k] = m)} args={[g, MAT.plate, PLATES[k].length]} receiveShadow />
      ))}
    </>
  );
}

// ---------- Icebergs lointains, silhouettes sous l'aurore ----------
const FAR_BERGS = Array.from({ length: 26 }, (_, i) => {
  const r = rng(800 + i);
  const a = (i / 26) * 6.283 + r() * 0.2;
  const d = 190 + r() * 140;
  const hgt = 14 + r() * 41;
  const rad = 10 + r() * 16;
  const geo = new THREE.CylinderGeometry(rad * (0.15 + r() * 0.35), rad, hgt, 9, 4);
  const p = geo.attributes.position;
  for (let j = 0; j < p.count; j++) {
    const k = 1 + fbm(p.getX(j) * 0.08 + i, p.getY(j) * 0.08, p.getZ(j) * 0.08, 3) * 0.7;
    p.setX(j, p.getX(j) * k);
    p.setZ(j, p.getZ(j) * k);
    if (p.getY(j) > 0) p.setY(j, p.getY(j) + noise.noise(p.getX(j) * 0.2, i, p.getZ(j) * 0.2) * hgt * 0.25);
  }
  geo.computeVertexNormals();
  return { geo, pos: [Math.cos(a) * d, hgt / 2 - 3, Math.sin(a) * d] as [number, number, number], rot: r() * 6.283 };
});

function Mist() {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 80 }, () => {
      const a = r() * Math.PI * 2;
      const d = 12 + r() * 120;
      return { pos: [Math.cos(a) * d, 0.8 + r() * 1.8, Math.sin(a) * d] as [number, number, number], s: [18 + r() * 20, 4 + r() * 4, 1] as [number, number, number] };
    });
  }, []);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: mistTex, color: '#8fb3cc', transparent: true, opacity: 0.12, depthWrite: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y -= dt * 0.008;
  });
  return (
    <group ref={ref}>
      {items.map((m, i) => (
        <sprite key={i} material={mat} position={m.pos} scale={m.s} />
      ))}
    </group>
  );
}

export function Sea() {
  return (
    <>
      <ArcticWater />
      <Plates />
      {FAR_BERGS.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={MAT.far} position={b.pos} rotation-y={b.rot} />
      ))}
      <Mist />
    </>
  );
}
