// La ville : ciel nocturne et halo, eau noire réfléchissante, gratte-ciel et enseignes, trafic aérien,
// pluie, éclaboussures et brume magenta / cyan.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useFontsReady } from './fonts';
import { HAZE, MAT, NEONS, drawTexture, glowMaterial, glowTex, mistTex, rng, signTexture, uTime, waterNormals } from './materials';

// ---------- Ciel ----------
const skyGeo = new THREE.SphereGeometry(1500, 48, 24);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: { top: { value: new THREE.Color(0x03030a) }, horizon: { value: new THREE.Color(HAZE) }, time: uTime },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform float time; varying vec3 vDir;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 c = mix(horizon, top, smoothstep(0.0, 0.45, h));
      // halo de la ville à l'horizon (discret : l'eau le reflète)
      c += vec3(0.5, 0.06, 0.35) * (1.0 - smoothstep(0.0, 0.12, abs(h))) * 0.12;
      vec2 q = d.xz / (abs(h) + 0.12) * 1.2 + vec2(time * 0.004, 0.0);
      float cl = vn(q) * 0.6 + vn(q * 2.3) * 0.3 + vn(q * 5.1) * 0.1;
      c += vec3(0.32, 0.06, 0.3) * smoothstep(0.35, 0.8, cl) * smoothstep(0.04, 0.25, h) * (1.0 - smoothstep(0.4, 0.8, h)) * 0.35;
      gl_FragColor = vec4(c, 1.0); }`,
});

function Sky() {
  return <mesh geometry={skyGeo} material={skyMat} renderOrder={-10} frustumCulled={false} />;
}

// ---------- Eau ----------
function NeonWater() {
  const water = useMemo(() => {
    const w = new Water(new THREE.PlaneGeometry(3000, 3000), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(0.3, 0.5, -0.8).normalize(),
      // reflet rose sombre : la diffusion de Water teinte toute la surface de cette couleur
      sunColor: 0x3a0f38,
      waterColor: 0x010104,
      distortionScale: 0.9,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    return w;
  }, []);
  useEffect(
    () => () => {
      water.geometry.dispose();
      (water.material as THREE.ShaderMaterial).dispose();
    },
    [water],
  );
  useFrame((_, dt) => {
    (water.material as THREE.ShaderMaterial).uniforms.time.value += dt * 0.3;
  });
  return <primitive object={water} />;
}

// ---------- Gratte-ciel ----------
const WORDS = ['CLAUDE', 'NEON', 'RAMEN', 'HOTEL', 'OPEN 24/7', 'SYNTH', 'BAR', 'DATA', 'ARCADE', 'NOODLE', 'CYBER', 'TOKENS', 'NEXUS', 'KAFE'];

const r1 = rng(808);
const winTex = drawTexture(128, 256, (ctx) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 256);
  const cols = ['#ffcf7a', '#7ff0ff', '#ff6ad5', '#ffffff'];
  for (let y = 4; y < 256; y += 8)
    for (let x = 4; x < 128; x += 8)
      if (r1() < 0.3) {
        ctx.fillStyle = r1() < 0.6 ? cols[0] : cols[Math.floor(r1() * cols.length)];
        ctx.globalAlpha = 0.3 + r1() * 0.7;
        ctx.fillRect(x, y, 5, 4);
      }
});
winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
const towerMat = new THREE.MeshStandardMaterial({ color: 0x090912, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.6 });
const signGeoH = new THREE.PlaneGeometry(4, 1);
const signGeoV = new THREE.PlaneGeometry(1, 4);

interface CityParts {
  group: THREE.Group;
  signs: { mat: THREE.MeshBasicMaterial; flicker: boolean }[];
  roof: { mat: THREE.SpriteMaterial; ph: number }[];
  dispose: () => void;
}

/** Tours sur un anneau lointain (une seule géométrie fusionnée), enseignes et feux d'obstacle. */
function buildCity(): CityParts {
  const r = rng(2077);
  const rnd = (a: number, b: number) => a + r() * (b - a);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const group = new THREE.Group();
  const boxes: THREE.BufferGeometry[] = [];
  const masts: THREE.BufferGeometry[] = [];
  const signs: CityParts['signs'] = [];
  const roof: CityParts['roof'] = [];
  const o = new THREE.Object3D();
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2 + rnd(-0.03, 0.03);
    const rad = rnd(190, 420);
    const w = rnd(12, 30);
    const d = rnd(12, 30);
    const h = rnd(40, 210);
    o.position.set(Math.cos(a) * rad, h / 2 - 2, Math.sin(a) * rad);
    o.rotation.set(0, -Math.PI / 2 - a, 0); // face +z vers le centre
    o.updateMatrix();
    const g = new THREE.BoxGeometry(w, h, d);
    // fenêtres à l'échelle de chaque face ; toit éteint
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let f = 0; f < 6; f++) {
      const fw = f < 2 ? d : w;
      for (let v = 0; v < 4; v++) {
        const k = f * 4 + v;
        if (f === 2 || f === 3) uv.setXY(k, 0.01, 0.01);
        else uv.setXY(k, uv.getX(k) * Math.round(fw / 12), uv.getY(k) * Math.round(h / 20));
      }
    }
    g.applyMatrix4(o.matrix);
    boxes.push(g);
    if (r() < 0.55) {
      const vertical = r() < 0.4;
      const s = rnd(2.5, 4.5);
      const mat = new THREE.MeshBasicMaterial({ map: signTexture(pick(WORDS), pick(NEONS), vertical), color: new THREE.Color(1.5, 1.5, 1.5) });
      const m = new THREE.Mesh(vertical ? signGeoV : signGeoH, mat);
      m.scale.setScalar(s);
      m.position.set(rnd(-w, w) * 0.25, rnd(-0.1, 0.35) * h, d / 2 + 0.3).applyMatrix4(o.matrix);
      m.rotation.copy(o.rotation);
      group.add(m);
      signs.push({ mat, flicker: r() < 0.35 });
    }
    if (r() < 0.6) {
      const top = new THREE.Vector3(0, h / 2 + 3, 0).applyMatrix4(o.matrix);
      masts.push(new THREE.CylinderGeometry(0.2, 0.3, 6, 5).translate(top.x, top.y, top.z));
      const mat = glowMaterial(0xff2a2a, 1);
      const l = new THREE.Sprite(mat);
      l.position.copy(top);
      l.scale.setScalar(5);
      group.add(l);
      roof.push({ mat, ph: r() * 6 });
    }
  }
  const towers = mergeGeometries(boxes);
  const antennas = mergeGeometries(masts);
  boxes.forEach((g) => g.dispose());
  masts.forEach((g) => g.dispose());
  group.add(new THREE.Mesh(towers, towerMat), new THREE.Mesh(antennas, MAT.dark));
  return {
    group,
    signs,
    roof,
    dispose: () => {
      towers.dispose();
      antennas.dispose();
      signs.forEach((s) => s.mat.dispose());
      roof.forEach((s) => s.mat.dispose());
    },
  };
}

const WHITE = new THREE.Color(1.5, 1.5, 1.5);
const DIM = new THREE.Color(0.25, 0.25, 0.25);

function Skyline() {
  const fonts = useFontsReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const city = useMemo(buildCity, [fonts]);
  useEffect(() => () => city.dispose(), [city]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    city.signs.forEach((s, i) => s.flicker && s.mat.color.copy(Math.sin(t * 13 + i * 7) + Math.sin(t * 3.1 + i) > 1.6 ? DIM : WHITE));
    city.roof.forEach((r) => (r.mat.opacity = Math.sin(t * 2 + r.ph) > 0.6 ? 1 : 0.1));
  });
  return <primitive object={city.group} />;
}

// ---------- Particules ----------
function ringPoints(n: number, seed: number, rMin: number, rMax: number, yMin: number, yMax: number) {
  const r = rng(seed);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = rMin + (rMax - rMin) * r();
    pos.set([Math.cos(a) * d, yMin + (yMax - yMin) * r(), Math.sin(a) * d], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

const pointsMat = (color: THREE.ColorRepresentation, size: number, opacity = 1) =>
  new THREE.PointsMaterial({ color, size, map: glowTex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });

/** Feux de véhicules volants qui tournent lentement autour de la ville. */
function Traffic() {
  const geo = useMemo(() => ringPoints(50, 91, 200, 320, 30, 110), []);
  const mat = useMemo(() => pointsMat(0xffe6c0, 2.2), []);
  const speed = useMemo(() => {
    const r = rng(92);
    return Array.from({ length: 50 }, () => (0.02 + r() * 0.04) * (r() < 0.5 ? -1 : 1));
  }, []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame((_, dt) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const c = Math.cos(speed[i] * dt);
      const s = Math.sin(speed[i] * dt);
      p.setX(i, x * c - z * s);
      p.setZ(i, x * s + z * c);
    }
    p.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} />;
}

const RAIN = 7000;
function Rain() {
  const { geo, mat } = useMemo(() => {
    const r = rng(5);
    const pos = new Float32Array(RAIN * 6);
    const tail = new Float32Array(RAIN * 2);
    for (let i = 0; i < RAIN; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 110;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const y = r() * 90;
      pos.set([x, y, z, x, y, z], i * 6);
      tail.set([0, 1], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('tail', new THREE.BufferAttribute(tail, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: uTime, color: { value: new THREE.Color(0xb8d8ff) } },
      vertexShader: `attribute float tail; uniform float time; varying float vA;
        void main(){ vec3 p = position; p.y = mod(p.y - time * 55.0, 90.0) - 5.0; p.y += tail * 1.4; p.x += tail * 0.18;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = (1.0 - tail * 0.8) * clamp(1.0 - (-mv.z) / 170.0, 0.0, 1.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color * vA * 0.45, vA * 0.45); }',
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
}

/** Gouttes qui éclatent à la surface de l'eau. */
function Splashes() {
  const geo = useMemo(() => ringPoints(400, 6, 0, 90, 0.05, 0.05), []);
  const mat = useMemo(() => pointsMat(0xd8eaff, 0.35, 0.8), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  useFrame(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < 40; k++) {
      const i = Math.floor(Math.random() * p.count);
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * 90;
      p.setXYZ(i, Math.cos(a) * d, 0.05, Math.sin(a) * d);
    }
    p.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} />;
}

const mistMats = ['#ff2aa0', '#22c8ff'].flatMap((c) => [0.05, 0.09].map((o) => new THREE.SpriteMaterial({ map: mistTex, color: c, transparent: true, opacity: o, depthWrite: false })));

function Mist() {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 90 }, (_, i) => {
      const a = r() * Math.PI * 2;
      const d = 12 + r() * 138;
      return { mat: mistMats[(i % 2) * 2 + (r() < 0.5 ? 0 : 1)], pos: [Math.cos(a) * d, 0.8 + r() * 4.2, Math.sin(a) * d] as [number, number, number], s: [20 + r() * 25, 5 + r() * 5, 1] as [number, number, number] };
    });
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.008;
  });
  return (
    <group ref={ref}>
      {items.map((m, i) => (
        <sprite key={i} material={m.mat} position={m.pos} scale={m.s} />
      ))}
    </group>
  );
}

export function City() {
  return (
    <>
      <Sky />
      <NeonWater />
      <Skyline />
      <Traffic />
      <Rain />
      <Splashes />
      <Mist />
    </>
  );
}
