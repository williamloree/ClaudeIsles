// Le décor de la cité engloutie : ciel liquide, fond de sable, puits de lumière, ruines, silhouettes
// lointaines, aiguilles de roche, forêts de kelp, coraux et cheminées qui bullent. Construit une fois.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ISLAND_SLOTS } from '../../scene/slots';
import { Batch, MAT, U, addCoral, disposeTree, fbm, ground, kelpForest, mat4, rayMat, rng } from './materials';

export const FOG = '#062a36';

const TAU = Math.PI * 2;

/** Loin des îlots, du hub et des tubes : rien ne doit gêner la lecture des habitats. */
export function clearOf(x: number, z: number, margin = 11) {
  const r = Math.hypot(x, z);
  if (r < 19) return false;
  const a = Math.atan2(z, x);
  for (const s of ISLAND_SLOTS) {
    if (Math.hypot(s[0] - x, s[2] - z) < margin) return false;
    const sr = Math.hypot(s[0], s[2]);
    const da = Math.abs(Math.atan2(Math.sin(a - Math.atan2(s[2], s[0])), Math.cos(a - Math.atan2(s[2], s[0]))));
    if (r < sr && da * r < 3) return false;
  }
  return true;
}

function brokenColumn(b: Batch, h: number, r: number, m: THREE.Matrix4, rnd: () => number) {
  const shaft = new THREE.CylinderGeometry(r * 0.92, r, h, 16, 1);
  shaft.translate(0, h / 2, 0);
  b.add(MAT.stone, shaft, m);
  b.add(MAT.stone, new THREE.BoxGeometry(r * 2.6, 0.5, r * 2.6).translate(0, 0.25, 0), m);
  if (rnd() < 0.3) b.add(MAT.stone, new THREE.BoxGeometry(r * 2.8, 0.45, r * 2.8).translate(0, h, 0), m);
}

/** Cheminées hydrothermales : bulles qui montent du fond (positions communes au décor et aux bulles). */
export const CHIMNEYS: [number, number, number][] = (() => {
  const r = rng(909);
  const out: [number, number, number][] = [];
  while (out.length < 7) {
    const a = r() * TAU;
    const d = 22 + r() * 70;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (clearOf(x, z, 10)) out.push([x, ground(x, z), z]);
  }
  return out;
})();

function buildSeabed() {
  const rnd = rng(2024);
  const rand = (a: number, b: number) => a + rnd() * (b - a);
  const root = new THREE.Group();

  // Ciel liquide : la surface lointaine scintille au zénith.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { time: U.time, fogC: { value: new THREE.Color(FOG) } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float time; uniform vec3 fogC; varying vec3 vD; void main(){ float h = vD.y; vec3 top = vec3(0.22, 0.62, 0.68);
        vec3 c = mix(fogC * 0.25, fogC, smoothstep(-0.5, 0.0, h)); c = mix(c, top, pow(smoothstep(0.0, 1.0, h), 2.2));
        float sh = sin(vD.x * 40.0 + time * 0.7) * sin(vD.z * 37.0 - time * 0.6); c += top * 0.35 * smoothstep(0.55, 1.0, h) * max(sh, 0.0); gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  sky.renderOrder = -1;
  root.add(sky);

  // Fond de sable ondulé.
  const floorGeo = new THREE.PlaneGeometry(1200, 1200, 200, 200);
  floorGeo.rotateX(-Math.PI / 2);
  const p = floorGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)));
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, MAT.sand);
  floor.receiveShadow = true;
  root.add(floor);

  // Puits de lumière venus de la surface.
  for (let i = 0; i < 12; i++) {
    const a = rnd() * TAU;
    const r = rand(0, 95);
    const top = rand(5, 12);
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(top, top * rand(1.8, 2.6), 130, 32, 1, true), rayMat(0x9fe9ff, rand(0.12, 0.22), 0, rnd() * 10));
    ray.position.set(Math.cos(a) * r, 60, Math.sin(a) * r);
    ray.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15));
    root.add(ray);
  }

  // Couronne de ruines : colonnes brisées, arches, blocs effondrés.
  const near = new Batch();
  const at = (x: number, z: number, dy = 0, rx = 0, ry = 0, rz = 0) => mat4(x, ground(x, z) + dy, z, rx, ry, rz);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * TAU;
    const r = rand(64, 150);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clearOf(x, z, 12)) continue;
    brokenColumn(near, rand(2, 11), rand(0.6, 1.1), at(x, z, -0.3, rand(-0.12, 0.12), 0, rand(-0.12, 0.12)), rnd);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4;
    const r = rand(100, 130);
    const w = rand(5, 8);
    const h = rand(7, 10);
    const m = at(Math.cos(a) * r, Math.sin(a) * r, -0.3, 0, rand(0, 6.28));
    for (const s of [-1, 1]) brokenColumn(near, h, 0.9, m.clone().multiply(mat4(s * w, 0, 0)), rnd);
    near.add(MAT.stone, new THREE.TorusGeometry(w, 0.8, 8, 28, Math.PI).translate(0, h, 0), m);
  }
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU;
    const r = rand(60, 170);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clearOf(x, z, 10)) continue;
    near.add(MAT.stone, new THREE.BoxGeometry(rand(1.5, 4), rand(0.8, 2), rand(1.5, 3)), at(x, z, 0.2, rand(-0.4, 0.4), rand(0, 6.28), rand(-0.4, 0.4)));
  }
  // Coraux épars : au loin, et quelques-uns entre les anneaux d'habitats.
  for (let i = 0; i < 90; i++) {
    const a = rnd() * TAU;
    const r = i < 40 ? rand(22, 64) : rand(64, 130);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!clearOf(x, z, 9.5)) continue;
    addCoral(near, i, x, ground(x, z) - 0.1, z, rnd);
  }
  // Cheminées.
  for (const [x, y, z] of CHIMNEYS) near.add(MAT.reef, new THREE.CylinderGeometry(0.3, 1, 2.4, 8), mat4(x, y + 0.9, z));
  root.add(near.build());

  // Silhouettes lointaines de la cité : temples en gradins, aiguilles de roche.
  const far = new Batch();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rand(0, 0.5);
    const r = rand(190, 290);
    const w = rand(18, 34);
    const m = at(Math.cos(a) * r, Math.sin(a) * r, -2, 0, rand(0, 6.28));
    for (let k = 0; k < 4; k++) far.add(MAT.stone, new THREE.BoxGeometry(w - k * w * 0.2, rand(5, 9), w - k * w * 0.2).translate(0, k * 7 + 3, 0), m);
    brokenColumn(far, rand(8, 14), 1.4, m.clone().multiply(mat4(0, 28, 0)), rnd);
  }
  for (let i = 0; i < 30; i++) {
    const a = rnd() * TAU;
    const r = rand(140, 330);
    const h = rand(30, 90);
    const geo = new THREE.ConeGeometry(rand(6, 14), h, 10, 8);
    const q = geo.attributes.position;
    for (let j = 0; j < q.count; j++) {
      const k = 1 + fbm(q.getX(j) * 0.1, q.getY(j) * 0.05, i) * 0.7;
      q.setX(j, q.getX(j) * k);
      q.setZ(j, q.getZ(j) * k);
    }
    geo.computeVertexNormals();
    far.add(MAT.reef, geo, at(Math.cos(a) * r, Math.sin(a) * r, h / 2 - 3));
  }
  root.add(far.build({ cast: false }));

  // Forêts de kelp (touffes de trois lames).
  const kelp: [number, number, number, number, number][] = [];
  for (let i = 0; i < 110; i++) {
    const a = rnd() * TAU;
    const inner = i < 20;
    const r = inner ? rand(22, 62) : rand(66, 160);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    if (!clearOf(cx, cz, inner ? 10 : 12)) continue;
    for (let k = 0; k < 3; k++) {
      const x = cx + rand(-2, 2);
      const z = cz + rand(-2, 2);
      kelp.push([x, ground(x, z) - 0.2, z, inner ? rand(3, 7) : r > 95 ? rand(6, 18) : rand(5, 11), rand(0, 6.28)]);
    }
  }
  root.add(kelpForest(kelp));
  return root;
}

export function Seabed() {
  const root = useMemo(buildSeabed, []);
  useEffect(
    () => () => {
      disposeTree(root);
      root.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && (m as THREE.ShaderMaterial).isShaderMaterial) m.dispose();
      });
    },
    [root],
  );
  return <primitive object={root} />;
}
