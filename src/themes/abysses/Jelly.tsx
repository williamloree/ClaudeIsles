// Méduse : ombrelle striée qui pulse, bras oraux en spirale et tentacules qui ondulent.
// Claude en est une très grande ; chaque session en est une petite.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { glowMat } from './materials';

const SEGS = 24;

function buildJelly(r: number, color: string, rim: string, nT: number, lenK: number) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const bellMat = glowMat(color, { rim, stripes: 16, alpha: 0.3 });
  const innerMat = glowMat(rim, { rim: 0xffffff, alpha: 0.35 });
  const armMat = glowMat(color, { rim, alpha: 0.25, sway: 0.25 });
  const tMat = new THREE.LineBasicMaterial({ color: rim, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  body.add(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), bellMat));
  const inner = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), innerMat);
  inner.position.y = -r * 0.12;
  body.add(inner);
  for (let k = 0; k < 4; k++) {
    const a0 = (k / 4) * Math.PI * 2;
    const pts = Array.from({ length: 12 }, (_, j) => new THREE.Vector3(Math.cos(a0 + j * 0.45) * r * 0.22, -r * 0.1 - j * r * 0.16, Math.sin(a0 + j * 0.45) * r * 0.22));
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r * 0.07, 6), armMat));
  }
  const tentacles = Array.from({ length: nT }, () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEGS * 3), 3));
    const l = new THREE.Line(geo, tMat);
    l.frustumCulled = false;
    g.add(l);
    return l;
  });
  const mats = [bellMat, innerMat, armMat];
  return { g, body, tentacles, mats, all: [...mats, tMat], rimY: r * Math.cos(Math.PI * 0.55), rimR: r * Math.sin(Math.PI * 0.55), len: r * lenK };
}

export function Jelly({
  r,
  color,
  rim,
  tentacles = 16,
  lenK = 2.2,
  pace = 1.5,
  strength = 1,
}: {
  r: number;
  color: string;
  rim: string;
  tentacles?: number;
  lenK?: number;
  /** vitesse des battements de l'ombrelle */
  pace?: number;
  /** éclat (une session inactive pâlit) */
  strength?: number;
}) {
  const j = useMemo(() => buildJelly(r, color, rim, tentacles, lenK), [r, color, rim, tentacles, lenK]);
  useEffect(
    () => () => {
      j.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      j.all.forEach((m) => m.dispose());
    },
    [j],
  );
  useEffect(() => {
    j.mats.forEach((m) => (m.uniforms.strength.value = strength));
    (j.all[3] as THREE.LineBasicMaterial).opacity = 0.55 * strength;
  }, [j, strength]);
  const phase = useMemo(() => Math.random() * 6.28, []);
  const clock = useRef(0);

  useFrame((_, dt) => {
    // horloge propre : changer de cadence ne fait pas sauter la pulsation
    clock.current += dt * pace;
    const t = clock.current;
    const p = Math.sin(t + phase);
    j.body.scale.set(1 + 0.08 * p, 1 - 0.1 * p, 1 + 0.08 * p);
    const n = j.tentacles.length;
    j.tentacles.forEach((l, i) => {
      const a = (i / n) * Math.PI * 2;
      const arr = l.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < SEGS; k++) {
        const s = k / (SEGS - 1);
        const w = j.rimR * (1 + 0.08 * p) * (1 - s * 0.35);
        arr.setXYZ(
          k,
          Math.cos(a) * w + Math.sin(t * 0.87 + s * 5 + i) * s * r * 0.3,
          j.rimY * (1 - 0.1 * p) - s * j.len,
          Math.sin(a) * w + Math.cos(t * 0.73 + s * 4 + i * 1.7) * s * r * 0.3,
        );
      }
      arr.needsUpdate = true;
    });
  });

  return <primitive object={j.g} />;
}
