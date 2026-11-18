// Ce qui vit et flotte : bancs de poissons, raie manta, neige marine, plancton luminescent et
// bulles qui montent des cheminées, du dôme et des habitats.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { U, bubbleTex, glowTex, rng } from './materials';

// ---------- Poissons ----------
const fishGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(1, 0);
  s.quadraticCurveTo(0.3, 0.42, -0.6, 0.08);
  s.lineTo(-1, 0.32);
  s.lineTo(-0.88, 0);
  s.lineTo(-1, -0.32);
  s.lineTo(-0.6, -0.08);
  s.quadraticCurveTo(0.3, -0.42, 1, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 2, curveSegments: 8 });
  g.center();
  g.rotateY(-Math.PI / 2);
  g.scale(0.5, 0.5, 0.5);
  return g;
})();
const fishMat = (() => {
  const m = new THREE.MeshStandardMaterial({ color: 0xa8d4e0, metalness: 0.35, roughness: 0.35, emissive: 0x0a2030 });
  // la queue bat : chaque poisson à son rythme (identifiant d'instance)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uTime * 12.0 + float(gl_InstanceID) * 0.7 + position.z * 5.0) * 0.12 * max(0.0, 0.25 - position.z);');
  };
  m.customProgramCacheKey = () => 'abysses-fish';
  return m;
})();

interface School {
  offs: THREE.Vector3[];
  R: number;
  y: number;
  w: number;
  p: number;
  s: number;
}
const schoolPos = (s: School, t: number, o: THREE.Vector3, out: THREE.Vector3) => {
  const a = t * s.w + s.p;
  return out.set(Math.cos(a) * s.R + o.x + Math.sin(t * 0.7 + o.y * 3) * 0.6, s.y + Math.sin(a * 2) * 4 + o.y, Math.sin(a) * s.R + o.z + Math.cos(t * 0.6 + o.x * 2) * 0.6);
};

function Fish() {
  const schools = useMemo(() => {
    const r = rng(88);
    return [0, 1, 2].map((k) => {
      const n = 45;
      const mesh = new THREE.InstancedMesh(fishGeo, fishMat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      const school: School = {
        offs: Array.from({ length: n }, () => new THREE.Vector3(r() * 8 - 4, r() * 3 - 1.5, r() * 8 - 4)),
        R: 46 + k * 14,
        y: 24 + k * 5,
        w: (0.07 + k * 0.02) * (k % 2 ? -1 : 1),
        p: k * 2.1,
        s: 0.8 + k * 0.3,
      };
      return { mesh, school };
    });
  }, []);
  useEffect(() => () => schools.forEach((s) => s.mesh.dispose()), [schools]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const { mesh, school } of schools) {
      school.offs.forEach((o, i) => {
        schoolPos(school, t, o, dummy.position);
        schoolPos(school, t + 0.1, o, tmp);
        dummy.lookAt(tmp);
        dummy.scale.setScalar(school.s * (0.8 + (i % 5) * 0.08));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      {schools.map((s, i) => (
        <primitive key={i} object={s.mesh} />
      ))}
    </>
  );
}

// ---------- Raie manta ----------
const mantaMat = (() => {
  const m = new THREE.MeshStandardMaterial({ color: 0x1f3540, roughness: 0.8, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat ax = abs(position.x); transformed.y += sin(uTime * 1.3 - ax * 0.45) * ax * 0.22;');
  };
  m.customProgramCacheKey = () => 'abysses-manta';
  return m;
})();
const mantaGeo = (() => {
  const geo = new THREE.PlaneGeometry(2, 1, 36, 18);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i);
    const v = p.getY(i) + 0.5;
    const span = 6 * Math.sin(Math.PI * Math.pow(v, 1.36));
    p.setXYZ(i, u * span, (1 - u * u) * 0.45 * Math.sin(Math.PI * v), (v - 0.5) * 5 - Math.abs(u) * span * 0.3);
  }
  geo.computeVertexNormals();
  return geo;
})();
const mantaTail = new THREE.ConeGeometry(0.08, 5, 6);

function Manta() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = t * 0.03;
    ref.current?.position.set(Math.cos(a) * 85, 34 + Math.sin(t * 0.3) * 3, Math.sin(a) * 85);
    ref.current?.rotation.set(0, -a, -0.25);
  });
  return (
    <group ref={ref}>
      <mesh geometry={mantaGeo} material={mantaMat} castShadow />
      <mesh geometry={mantaTail} material={mantaMat} rotation-x={-Math.PI / 2} position={[0, 0, -4.8]} />
    </group>
  );
}

// ---------- Particules ----------
function cloud(n: number, spread: number, yMin: number, yMax: number, seed: number) {
  const r = rng(seed);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * spread;
    pos.set([Math.cos(a) * d, yMin + r() * (yMax - yMin), Math.sin(a) * d], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

function Snow() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => cloud(2400, 140, 0, 60, 5), []);
  const mat = useMemo(() => new THREE.PointsMaterial({ color: 0xcfe8e0, size: 0.18, map: glowTex, transparent: true, opacity: 0.7, depthWrite: false }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const sp = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) - dt * (0.25 + (i % 7) * 0.05);
      if (y < 0) y = 60;
      sp.setY(i, y);
      sp.setX(i, sp.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.15);
    }
    sp.needsUpdate = true;
    if (ref.current) ref.current.rotation.y += dt * 0.004;
  });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

function Plankton() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => cloud(600, 110, 0.3, 5, 6), []);
  const mat = useMemo(() => new THREE.PointsMaterial({ color: 0x5ff7ff, size: 0.4, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame(({ clock }, dt) => {
    if (ref.current) ref.current.rotation.y -= dt * 0.01;
    mat.opacity = 0.6 + Math.sin(clock.elapsedTime * 0.9) * 0.3;
  });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

export interface Emitter {
  x: number;
  y: number;
  z: number;
  w: number;
}

const N_BUBBLES = 700;

function Bubbles({ emitters }: { emitters: Emitter[] }) {
  const src = useRef(emitters);
  src.current = emitters;
  const geo = useMemo(() => cloud(N_BUBBLES, 1, 0, 1, 7), []);
  const mat = useMemo(() => new THREE.PointsMaterial({ color: 0xdff8ff, size: 0.5, map: bubbleTex, transparent: true, opacity: 0.85, depthWrite: false }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const data = useMemo(() => {
    const r = rng(17);
    return Array.from({ length: N_BUBBLES }, (_, i) => ({ e: null as Emitter | null, sp: 1.5 + r() * 2.5, ph: r() * 6.28, x0: 0, z0: 0, top: 0, seed: i }));
  }, []);
  // une bulle repart d'un émetteur au hasard (la liste change avec les habitats)
  const reset = (i: number, initial: boolean) => {
    const es = src.current;
    const e = es[(i + Math.floor(Math.random() * es.length)) % es.length];
    const d = data[i];
    d.e = e;
    d.x0 = e.x + (Math.random() * 2 - 1) * e.w;
    d.z0 = e.z + (Math.random() * 2 - 1) * e.w;
    d.top = e.y + 55;
    (geo.attributes.position as THREE.BufferAttribute).setY(i, e.y + (initial ? Math.random() * 55 : 0));
  };
  const ready = useRef(false);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (!ready.current) {
      data.forEach((_, i) => reset(i, true));
      ready.current = true;
    }
    const bp = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N_BUBBLES; i++) {
      const d = data[i];
      const y = bp.getY(i) + dt * d.sp;
      if (y > d.top) {
        reset(i, false);
        continue;
      }
      bp.setXYZ(i, d.x0 + Math.sin(t * 2 + d.ph) * 0.25, y, d.z0 + Math.cos(t * 1.7 + d.ph) * 0.25);
    }
    bp.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

export function Life({ emitters }: { emitters: Emitter[] }) {
  return (
    <>
      <Fish />
      <Manta />
      <Snow />
      <Plankton />
      <Bubbles emitters={emitters} />
    </>
  );
}
