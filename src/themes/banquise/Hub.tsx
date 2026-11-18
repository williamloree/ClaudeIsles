// Le hub : grand iceberg tabulaire, igloo-observatoire aux joints rougeoyants et phare de Claude
// au sommet du dôme. Quand Claude réfléchit, le feu s'avive et les faisceaux tournent plus vite.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../../format';
import { HubLabel, clickable, openHub } from '../../scene/labels';
import { ISLET_TOP } from '../../scene/slots';
import { useStore } from '../../store';
import { HUB_GEO } from './bergs';
import { Fire } from './Fire';
import { moundGeo } from './Floe';
import { MAT, glowTex, mistTex, rng } from './materials';

const T = ISLET_TOP;
const R = 6.4; // rayon du dôme
const LB = T + R - 0.3; // base de la lanterne du phare

const iglooTime = { value: 0 };
const iglooMat = new THREE.ShaderMaterial({
  uniforms: { time: iglooTime, heat: { value: 1 } },
  vertexShader:
    'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  // blocs de neige en rangées, joints traversés par la lueur du feu intérieur
  fragmentShader: `uniform float time; uniform float heat; varying vec3 vP; varying vec3 vN; varying vec3 vV;
    float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
    void main(){
      vec3 d = normalize(vP);
      float el = asin(clamp(d.y, 0.0, 1.0)) / 1.5708, rows = 8.0, r = floor(el * rows), fy = fract(el * rows);
      float n = max(3.0, floor(30.0 * cos((r + 0.5) / rows * 1.5708) + 0.5));
      float az = (atan(d.z, d.x) / 6.2832 + 0.5) * n + r * 0.5, fx = fract(az);
      vec2 id = vec2(floor(az), r);
      float joint = 1.0 - smoothstep(0.0, 0.07, min(min(fy, 1.0 - fy), min(fx, 1.0 - fx) * 1.3));
      float flick = 0.85 + 0.1 * sin(time * 7.0 + h(id) * 6.0) + 0.05 * sin(time * 13.0);
      float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
      vec3 warm = vec3(1.0, 0.42, 0.12);
      float inner = (0.3 + 0.7 * (1.0 - el)) * flick * (0.7 + 0.5 * h(id));
      vec3 col = vec3(0.07, 0.12, 0.18) + warm * inner * 0.5 * heat + warm * joint * 1.5 * flick * heat + vec3(0.3, 0.6, 0.9) * fres * 0.55;
      gl_FragColor = vec4(col, 1.0);
    }`,
});

const beamMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  uniforms: { strength: { value: 0.09 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform float strength; varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * pow(vUv.y, 2.2) * strength, 1.0); }',
});
const beamGeo = new THREE.ConeGeometry(3.2, 46, 24, 1, true);
beamGeo.translate(0, -23, 0);

const tunnelMat = MAT.snow.clone();
tunnelMat.side = THREE.DoubleSide;
const glassRoomMat = new THREE.MeshPhysicalMaterial({ color: 0xd6f2ff, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
const doorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a2d).multiplyScalar(1.4), toneMapped: false });
const lensMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9fe8ff, emissiveIntensity: 1.2 });
const wireMat = new THREE.LineBasicMaterial({ color: 0x6b7a88 });
const blinkMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff3a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const sparkMat = new THREE.PointsMaterial({ color: 0xffa25a, size: 0.3, map: mistTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

// télescope pointé vers l'aurore
const TEL = (() => {
  const az = -2.2;
  const el = 0.62;
  const dir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  const pos = dir.clone().multiplyScalar(R - 0.2).setY(T + Math.sin(el) * R);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().setY(dir.y + 0.7).normalize());
  return { pos: pos.toArray() as [number, number, number], quat: quat.toArray() as [number, number, number, number] };
})();

const wireGeo = (() => {
  const w: number[] = [];
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 + 0.4;
    w.push(0, 9.4, 0, Math.cos(a) * 4, 0, Math.sin(a) * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(w, 3));
  return g;
})();

// décor du parvis : aiguilles de glace au fond (entre les départs de passerelles et hors des monolithes), congères
const DECOR = (() => {
  const r = rng(1717);
  const spires = [213.75, 258.75, 303.75, 348.75, 168.75].map((deg) => {
    const a = (deg * Math.PI) / 180 + (r() - 0.5) * 0.06;
    const d = 15.4 + r() * 0.8;
    return { pos: [Math.cos(a) * d, T + 1, Math.sin(a) * d] as [number, number, number], rad: 1 + r() * 0.8, h: 4 + r() * 6, rot: [(r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3] as [number, number, number] };
  });
  const mounds: { pos: [number, number, number]; s: number; sy: number }[] = [];
  while (mounds.length < 10) {
    const a = r() * Math.PI * 2;
    const d = 8.2 + r() * 2.6;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (z > 5 && Math.abs(x) < 3) continue; // devant le tunnel d'entrée
    mounds.push({ pos: [x, T - 0.05, z], s: 0.7 + r() * 0.8, sy: 0.3 + r() * 0.2 });
  }
  return { spires, mounds };
})();

function Sparks() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const r = rng(31);
    const pos = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 4;
      pos.set([Math.cos(a) * d, LB + 1 + r() * 8, Math.sin(a) * d], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (1 + (i % 5) * 0.3);
      if (y > LB + 9) y = LB + 1;
      p.setY(i, y);
    }
    p.needsUpdate = true;
    if (ref.current) ref.current.rotation.y += dt * 0.05;
  });
  return <points ref={ref} geometry={geo} material={sparkMat} />;
}

export function Hub() {
  const busy = useStore((s) => s.hub.busy);
  const core = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const beams = useRef<THREE.Group>(null);
  const hearth = useRef<THREE.PointLight>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    iglooTime.value = t;
    // la chaleur monte quand Claude réfléchit
    const heat = iglooMat.uniforms.heat;
    heat.value += ((busy ? 1.5 + Math.sin(t * 6) * 0.15 : 1) - heat.value) * Math.min(1, dt * 3);
    beamMat.uniforms.strength.value = busy ? 0.13 : 0.09;
    if (beams.current) beams.current.rotation.y += dt * (busy ? 1.3 : 0.35);
    if (core.current) {
      core.current.rotation.y += dt * (busy ? 2.5 : 0.6);
      core.current.position.y = LB + 2.2 + Math.sin(t * (busy ? 4 : 1.4)) * (busy ? 0.3 : 0.15);
    }
    if (coreMat.current) coreMat.current.emissiveIntensity = busy ? 5 + Math.sin(t * 9) * 1.5 : 4;
    if (hearth.current) hearth.current.intensity = (busy ? 70 : 40) * (0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 27) * 0.05);
    blinkMat.opacity = Math.sin(t * 3) > 0.6 ? 1 : 0.15;
  });

  // demi-tour : l'entrée de l'igloo fait face à la caméra du thème (au nord), le télescope vise l'aurore
  return (
    <group rotation-y={Math.PI}>
      <group {...clickable(openHub)}>
        <mesh geometry={HUB_GEO} material={MAT.berg} castShadow receiveShadow />
        <mesh position={[0, T, 0]} material={iglooMat} castShadow>
          <sphereGeometry args={[R, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* tunnel d'entrée et porte rougeoyante */}
        <mesh position={[0, T, R + 1.2]} rotation-x={-Math.PI / 2} material={tunnelMat} castShadow receiveShadow>
          <cylinderGeometry args={[1.75, 1.75, 4, 20, 1, true, -Math.PI / 2, Math.PI]} />
        </mesh>
        <mesh position={[0, T + 0.01, R + 0.4]} material={doorMat}>
          <circleGeometry args={[1.6, 24, 0, Math.PI]} />
        </mesh>
        {/* lanterne du phare au sommet du dôme */}
        <mesh position={[0, LB + 0.3, 0]} material={MAT.block} castShadow>
          <cylinderGeometry args={[2.0, 2.4, 0.6, 24]} />
        </mesh>
        <mesh position={[0, LB + 1.9, 0]} material={glassRoomMat}>
          <cylinderGeometry args={[1.6, 1.6, 2.6, 32, 1, true]} />
        </mesh>
        {Array.from({ length: 8 }, (_, k) => (
          <mesh key={k} position={[Math.cos(k * 0.785) * 1.62, LB + 1.9, Math.sin(k * 0.785) * 1.62]} material={MAT.metal}>
            <cylinderGeometry args={[0.04, 0.04, 2.6, 5]} />
          </mesh>
        ))}
        <mesh position={[0, LB + 1.3, 0]} rotation-x={Math.PI / 2} material={MAT.metal}>
          <torusGeometry args={[2.15, 0.05, 6, 40]} />
        </mesh>
        <mesh position={[0, LB + 3.95, 0]} material={MAT.metal} castShadow>
          <coneGeometry args={[2.1, 1.5, 24]} />
        </mesh>
        <mesh position={[0, LB + 4.8, 0]} material={MAT.brass}>
          <sphereGeometry args={[0.2, 12, 10]} />
        </mesh>
        <group position={[0, LB + 0.6, 0]}>
          <Fire color={COLORS.claude} scale={busy ? 1.9 : 1.5} light={busy ? 40 : 27} />
        </group>
        <mesh ref={core} position={[0, LB + 2.2, 0]}>
          <icosahedronGeometry args={[0.45, 3]} />
          <meshStandardMaterial ref={coreMat} color="#220a00" emissive="#ff9a4d" emissiveIntensity={4} />
        </mesh>
        {/* télescope */}
        <group position={TEL.pos} quaternion={TEL.quat}>
          <mesh position={[0, 1.2, 0]} material={MAT.brass} castShadow>
            <cylinderGeometry args={[0.34, 0.42, 3.4, 18]} />
          </mesh>
          <mesh position={[0, 2.91, 0]} rotation-x={-Math.PI / 2} material={lensMat}>
            <circleGeometry args={[0.32, 18]} />
          </mesh>
        </group>
      </group>
      <pointLight ref={hearth} color="#ff7a2d" intensity={40} distance={34} decay={1.5} position={[0, T + 2, 0]} />
      <pointLight color="#ff8a3d" intensity={14} distance={16} decay={1.6} position={[0, T + 1, R + 3.2]} />
      {/* faisceaux tournants du phare */}
      <group ref={beams} position={[0, LB + 2, 0]}>
        {[1, -1].map((s) => (
          <mesh key={s} geometry={beamGeo} material={beamMat} rotation-x={s * (Math.PI / 2 + 0.06)} />
        ))}
      </group>
      <Sparks />

      {/* mât d'antenne et son feu clignotant */}
      <group position={[-4, T, -11.5]}>
        <mesh position={[0, 5, 0]} material={MAT.metal} castShadow>
          <cylinderGeometry args={[0.07, 0.1, 10, 6]} />
        </mesh>
        {[6.5, 8.2, 9.6].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={MAT.metal}>
            <boxGeometry args={[1.6 - (y - 6.5) * 0.3, 0.05, 0.05]} />
          </mesh>
        ))}
        <lineSegments geometry={wireGeo} material={wireMat} />
        <sprite material={blinkMat} position={[0, 10.2, 0]} scale={1.4} />
      </group>

      {/* torches de glace */}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.cos(a) * 10.5, T, Math.sin(a) * 10.5]}>
            <mesh position={[0, 0.85, 0]} material={MAT.facet} castShadow>
              <cylinderGeometry args={[0.25, 0.4, 1.7, 6]} />
            </mesh>
            <mesh position={[0, 1.85, 0]} material={MAT.brass}>
              <sphereGeometry args={[0.45, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            </mesh>
            <group position={[0, 1.8, 0]}>
              <Fire color="#ff9a4d" scale={0.9} light={i < 2 ? 16 : 0} />
            </group>
          </group>
        );
      })}
      {DECOR.spires.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={s.rot} material={MAT.facet} castShadow>
          <coneGeometry args={[s.rad, s.h, 5]} />
        </mesh>
      ))}
      {DECOR.mounds.map((m, i) => (
        <mesh key={i} geometry={moundGeo} material={MAT.snow} position={m.pos} scale={[m.s, m.s * m.sy, m.s]} castShadow receiveShadow />
      ))}

      <HubLabel position={[0, T + 12.8, 0]} />
    </group>
  );
}
