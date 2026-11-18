// Tubes de verre entre le dôme et chaque habitat : arceaux de laiton, câble lumineux, piliers jusqu'au
// fond, et impulsions de données qui filent (en cours), flânent (terminé) ou clignotent sur place (échec).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATUS_COLOR } from '../../format';
import type { Bridge } from '../../scene/layout';
import { ISLET_TOP } from '../../scene/slots';
import { BUBBLE } from './Habitat';
import { DOME } from './Hub';
import { MAT, glowTex, ground } from './materials';

const ringGeo = new THREE.TorusGeometry(0.8, 0.1, 8, 28);
const collarGeo = new THREE.TorusGeometry(0.95, 0.22, 8, 28);
const postGeo = new THREE.CylinderGeometry(0.1, 0.16, 1, 8);
const Y = ISLET_TOP + 1; // axe du tube : il entre dans les bulles un mètre au-dessus du plancher

function Tube({ bridge }: { bridge: Bridge }) {
  const parts = useMemo(() => {
    // du dôme à la bulle : on prolonge les extrémités communes jusqu'au verre
    const dir = new THREE.Vector3(bridge.to[0], 0, bridge.to[2]).normalize();
    const slotDist = Math.hypot(bridge.to[0], bridge.to[2]) + 7 * 0.84;
    const a = dir.clone().multiplyScalar(DOME - 0.4).setY(Y);
    const b = dir.clone().multiplyScalar(slotDist - BUBBLE + 0.4).setY(Y);
    const rise = Math.min(4, a.distanceTo(b) * 0.1);
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => a.clone().lerp(b, i / 23).add(new THREE.Vector3(0, Math.sin((Math.PI * i) / 23) * rise, 0))));
    const glass = new THREE.TubeGeometry(curve, 120, 0.75, 18);
    const cable = new THREE.TubeGeometry(curve, 120, 0.1, 6);
    const n = Math.round(curve.getLength() / 3.2);
    const o = new THREE.Object3D();
    const rings: { pos: THREE.Vector3; quat: THREE.Quaternion; end: boolean }[] = [];
    const posts: { pos: [number, number, number]; h: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = curve.getPointAt(t);
      o.position.copy(p);
      o.lookAt(p.clone().add(curve.getTangentAt(t)));
      rings.push({ pos: p, quat: o.quaternion.clone(), end: i === 0 || i === n });
      const gy = ground(p.x, p.z);
      if (i % 2 === 1 && p.y - gy > 1.6 && Math.hypot(p.x, p.z) > 17.5) {
        const h = p.y - 0.8 - gy;
        posts.push({ pos: [p.x, gy + h / 2, p.z], h });
      }
    }
    return { curve, glass, cable, rings, posts };
  }, [bridge.from, bridge.to]);
  useEffect(() => () => [parts.glass, parts.cable].forEach((g) => g.dispose()), [parts]);

  const color = STATUS_COLOR[bridge.status];
  const pulseMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }), [color]);
  useEffect(() => () => pulseMat.dispose(), [pulseMat]);
  const pulses = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const sp = bridge.status === 'running' ? 0.22 : bridge.status === 'completed' ? 0.05 : 0;
    pulses.current?.children.forEach((s, k) => {
      const off = k / 4;
      parts.curve.getPointAt((((t * sp + off) % 1) + 1) % 1, s.position);
    });
    pulseMat.opacity = sp === 0 ? 0.35 + 0.65 * Math.max(0, Math.sin(t * 6)) : 1;
  });

  return (
    <group>
      <mesh geometry={parts.glass} material={MAT.glass} />
      <mesh geometry={parts.cable} material={MAT.cable} />
      {parts.rings.map((r, i) => (
        <mesh key={i} geometry={r.end ? collarGeo : ringGeo} material={MAT.brass} position={r.pos} quaternion={r.quat} castShadow />
      ))}
      {parts.posts.map((p, i) => (
        <mesh key={i} geometry={postGeo} material={MAT.brass} position={p.pos} scale={[1, p.h, 1]} castShadow />
      ))}
      <group ref={pulses}>
        {[0, 1, 2, 3].map((k) => (
          <sprite key={k} material={pulseMat} scale={1.3} />
        ))}
      </group>
      {/* feux de statut aux deux sas */}
      {[parts.rings[0], parts.rings[parts.rings.length - 1]].map((r, i) => (
        <sprite key={i} material={pulseMat} position={[r.pos.x, r.pos.y + 1.15, r.pos.z]} scale={0.9} />
      ))}
    </group>
  );
}

export function Tubes({ bridges }: { bridges: Bridge[] }) {
  return (
    <>
      {bridges.map((b) => (
        <Tube key={b.id} bridge={b} />
      ))}
    </>
  );
}
