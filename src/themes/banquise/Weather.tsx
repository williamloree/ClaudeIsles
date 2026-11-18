// Neige qui tombe en biais et rafales de vent. Les deux restent hors du reflet de l'eau
// (calque 1, que la caméra miroir ne voit pas).
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mistTex, rng } from './materials';

const SNOW_R = 110;
const SNOW_TOP = 60;
const WIND = new THREE.Vector3(1, 0, 0.35).normalize();

export function Weather() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.layers.enable(1);
  }, [camera]);

  const snow = useMemo(() => {
    const r = rng(55);
    const n = 3200;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283;
      const d = Math.sqrt(r()) * SNOW_R;
      pos.set([Math.cos(a) * d, r() * SNOW_TOP, Math.sin(a) * d], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xeef6ff, size: 0.3, map: mistTex, transparent: true, opacity: 0.95, depthWrite: false }));
    pts.layers.set(1);
    pts.frustumCulled = false;
    return pts;
  }, []);

  const gusts = useMemo(() => {
    const r = rng(56);
    const n = 260;
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = -120 + r() * 240;
      const y = 0.5 + r() * 13.5;
      const z = -120 + r() * 240;
      const l = 1.5 + r() * 2.5;
      pos.set([x, y, z, x + WIND.x * l, y, z + WIND.z * l], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    ls.layers.set(1);
    ls.frustumCulled = false;
    return ls;
  }, []);

  useEffect(
    () => () => {
      for (const o of [snow, gusts]) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    },
    [snow, gusts],
  );

  const rand = useMemo(() => rng(57), []);
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = clock.elapsedTime;
    const fp = snow.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      let x = fp.getX(i) + dt * (WIND.x * 3 + Math.sin(t + i) * 0.6);
      let y = fp.getY(i) - dt * (1.4 + (i % 7) * 0.25);
      let z = fp.getZ(i) + dt * (WIND.z * 3 + Math.cos(t * 0.7 + i) * 0.5);
      if (y < 0) {
        y = SNOW_TOP;
        const a = rand() * 6.283;
        const d = Math.sqrt(rand()) * SNOW_R;
        x = Math.cos(a) * d;
        z = Math.sin(a) * d;
      }
      if (x * x + z * z > SNOW_R * SNOW_R) {
        x = -x * 0.98;
        z = -z * 0.98;
      }
      fp.setXYZ(i, x, y, z);
    }
    fp.needsUpdate = true;
    const gp = gusts.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i += 2) {
      const v = 22 + (i % 9) * 2;
      let x = gp.getX(i) + WIND.x * v * dt;
      let z = gp.getZ(i) + WIND.z * v * dt;
      const dx = gp.getX(i + 1) - gp.getX(i);
      const dz = gp.getZ(i + 1) - gp.getZ(i);
      if (x > 120) x -= 240;
      if (z > 120) z -= 240;
      gp.setX(i, x);
      gp.setZ(i, z);
      gp.setX(i + 1, x + dx);
      gp.setZ(i + 1, z + dz);
    }
    gp.needsUpdate = true;
  });

  return (
    <>
      <primitive object={snow} />
      <primitive object={gusts} />
    </>
  );
}
