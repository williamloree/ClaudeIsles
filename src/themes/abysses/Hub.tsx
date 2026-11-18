// Le hub : ruine engloutie en gradins, dôme de verre cerclé de laiton, cœur battant de Claude
// et, au-dessus, Claude lui-même en grande méduse. Tout s'emballe quand Claude réfléchit.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HubLabel, clickable, openHub } from '../../scene/labels';
import { ISLET_TOP } from '../../scene/slots';
import { useStore } from '../../store';
import { Jelly } from './Jelly';
import { Batch, MAT, fbm, glowMat, glowTex, kelpForest, mat4, rng } from './materials';

const T = ISLET_TOP;
export const DOME = 9.5;
const JELLY_Y = T + 20;

// Socle, gradins et colonnade brisée : construits une fois.
const ruin = (() => {
  const r = rng(77);
  const b = new Batch();
  b.add(MAT.stone, new THREE.CylinderGeometry(17, 18.5, 4, 72), mat4(0, T - 2.8, 0));
  b.add(MAT.stone, new THREE.CylinderGeometry(16.2, 16.4, 0.4, 72), mat4(0, T - 0.6, 0));
  b.add(MAT.stone, new THREE.CylinderGeometry(15.3, 15.5, 0.4, 72), mat4(0, T - 0.2, 0));
  const kelp: [number, number, number, number, number][] = [];
  // colonnes entre les départs de tubes, mais jamais devant une tablette de nacre
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (Math.PI * 3) / 16;
    const h = i % 3 ? 2 + r() * 4 : 9;
    const m = mat4(Math.cos(a) * 15.8, T - 0.4, Math.sin(a) * 15.8);
    b.add(MAT.stone, new THREE.CylinderGeometry(0.55, 0.6, h, 16).translate(0, h / 2, 0), m);
    b.add(MAT.stone, new THREE.BoxGeometry(1.5, 0.5, 1.5).translate(0, 0.25, 0), m);
    if (r() < 0.35) b.add(MAT.stone, new THREE.BoxGeometry(1.7, 0.45, 1.7).translate(0, h, 0), m);
    kelp.push([Math.cos(a + 0.08) * 17.3, T - 0.8, Math.sin(a + 0.08) * 17.3, 5 + r() * 5, r() * 6.28]);
  }
  // armature du dôme : méridiens et anneaux de laiton
  for (let k = 0; k < 8; k++) b.add(MAT.brass, new THREE.TorusGeometry(DOME, 0.12, 6, 64, Math.PI), mat4(0, T, 0, 0, (k / 8) * Math.PI, 0));
  for (const [rr, y, tk] of [
    [DOME, 0, 0.3],
    [DOME * 0.87, DOME * 0.5, 0.12],
    [DOME * 0.5, DOME * 0.87, 0.12],
  ])
    b.add(MAT.brass, new THREE.TorusGeometry(rr, tk, 8, 96), mat4(0, T + y, 0, Math.PI / 2));
  b.add(MAT.stone, new THREE.CylinderGeometry(1.3, 1.9, 2.6, 24), mat4(0, T + 1.3, 0));
  b.add(MAT.brass, new THREE.CylinderGeometry(0.3, 0.4, 0.5, 12), mat4(0, T + DOME + 0.1, 0));
  const g = b.build();
  g.add(kelpForest(kelp));
  return g;
})();

const domeGeo = new THREE.SphereGeometry(DOME, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
const heartGeo = (() => {
  const g = new THREE.IcosahedronGeometry(1.3, 5);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + fbm(v.x * 1.4, v.y * 1.4, v.z * 1.4, 3) * 0.35);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
})();
const shellGeo = new THREE.SphereGeometry(2.4, 32, 16);
const heartMat = new THREE.MeshStandardMaterial({ color: 0x1a0420, emissive: 0xe08cff, emissiveIntensity: 3, roughness: 0.3 });
const shellMat = glowMat(0xb46bff, { rim: 0x7ff6ff, alpha: 0.12 });
const orbMats = [0x7ff6ff, 0xe08cff].map((c) => new THREE.SpriteMaterial({ map: glowTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false }));

export function Hub() {
  const busy = useStore((s) => s.hub.busy);
  const heart = useRef<THREE.Mesh>(null);
  const heartLight = useRef<THREE.PointLight>(null);
  const claude = useRef<THREE.Group>(null);
  const claudeLight = useRef<THREE.PointLight>(null);
  const orbs = useRef<THREE.Group>(null);
  const beatClock = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // le cœur bat deux fois plus vite quand Claude réfléchit
    beatClock.current += dt * (busy ? 5.5 : 2.4);
    const beat = 1 + (busy ? 0.16 : 0.1) * Math.pow(Math.max(Math.sin(beatClock.current), 0), 8);
    if (heart.current) {
      heart.current.scale.setScalar(beat);
      heart.current.rotation.y += dt * (busy ? 1.2 : 0.3);
    }
    heartMat.emissiveIntensity = (busy ? 4 : 3) * beat;
    if (heartLight.current) heartLight.current.intensity = (busy ? 60 : 34) + beat * 8;
    if (claude.current) {
      claude.current.position.y = JELLY_Y + Math.sin(t * (busy ? 1.4 : 0.6)) * 0.8;
      claude.current.rotation.y += dt * (busy ? 0.25 : 0.05);
    }
    if (claudeLight.current) claudeLight.current.intensity = busy ? 45 + Math.sin(t * 6) * 10 : 30;
    orbs.current?.children.forEach((o, i) => {
      const a = t * (0.4 + i * 0.07) * (busy ? 2.5 : 1) + i;
      o.position.set(Math.cos(a) * (3 + i * 0.4), T + 4.4 + Math.sin(t + i * 2) * 1.6, Math.sin(a) * (3 + i * 0.4));
    });
  });

  return (
    <group {...clickable(openHub)}>
      <primitive object={ruin} />
      <mesh geometry={domeGeo} material={MAT.glass} position={[0, T, 0]} />
      <mesh ref={heart} geometry={heartGeo} material={heartMat} position={[0, T + 4.4, 0]} />
      <mesh geometry={shellGeo} material={shellMat} position={[0, T + 4.4, 0]} />
      <group ref={orbs}>
        {Array.from({ length: 7 }, (_, i) => (
          <sprite key={i} material={orbMats[i % 2]} scale={0.9} />
        ))}
      </group>
      <pointLight ref={heartLight} color="#c58bff" intensity={40} distance={30} decay={1.5} position={[0, T + 4.4, 0]} />

      {/* Claude, la grande méduse */}
      <group ref={claude} position={[0, JELLY_Y, 0]}>
        <Jelly r={6} color="#9d7bff" rim="#6ff0ff" tentacles={28} lenK={2.2} pace={busy ? 3.2 : 1.5} strength={busy ? 1.35 : 1} />
        <pointLight ref={claudeLight} color="#9de7ff" intensity={30} distance={45} decay={1.4} position={[0, -1, 0]} />
      </group>

      <HubLabel position={[0, JELLY_Y + 8.5, 0]} />
    </group>
  );
}
