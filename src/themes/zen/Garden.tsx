// Le jardin autour de l'étang : ciel nocturne, lune et étoiles, montagnes, berges de sable ratissé
// (karesansui), rochers, haies, forêt, torii, érables et cerisiers dont les pétales tombent.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HUB_TREES } from './Hub';
import { MAT, MOON_DISC, canvasTex, fbm, glowTex, leafGeo, makeCanvas, rng, rockGeos } from './materials';
import { Rock, Toro, Torii, Tree, treeShape, type TreeKind } from './Props';

export const FOG = '#0c1626';
// Le sable commence au-delà des voies des lanternes flottantes (jusqu'à ~87 m).
const SAND_IN = 93;
const SAND_R = 175;
const GY = 0.5;

// ---------- Plan des berges (déterministe) ----------
const BANK = (() => {
  const r = rng(2024);
  return Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * 6.283 + (r() - 0.5) * 0.16;
    const kind = i === 8 ? 'torii' : i % 2 ? 'rocks' : i % 4 ? 'sakura' : 'maple';
    const d = i % 2 ? 118 + r() * 32 : 104 + r() * 26;
    return { a, kind, d, h: 9 + r() * 4, seed: 100 + i };
  });
})();
const ROCK_SPOTS = (() => {
  const r = rng(77);
  return BANK.filter((b) => b.kind === 'rocks').map((b, i) => ({ x: Math.cos(b.a) * b.d, z: Math.sin(b.a) * b.d, r: 2.6 + r() * 1.6, seed: i }));
})();
const BANK_TREES = BANK.filter((b) => b.kind === 'sakura' || b.kind === 'maple').map((b) => ({
  pos: [Math.cos(b.a) * b.d, GY, Math.sin(b.a) * b.d] as [number, number, number],
  h: b.h,
  kind: b.kind as TreeKind,
  seed: b.seed,
}));

// ---------- Ciel ----------
function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(0x01030a) }, mid: { value: new THREE.Color(0x0a1426) }, hor: { value: new THREE.Color(FOG) }, md: { value: MOON_DISC } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 md; varying vec3 vP;
          void main(){ vec3 d = normalize(vP); float h = d.y;
            vec3 c = h < 0.15 ? mix(hor, mid, smoothstep(-0.02, 0.15, h)) : mix(mid, top, smoothstep(0.15, 0.7, h));
            c += vec3(0.10, 0.13, 0.2) * pow(max(dot(d, md), 0.0), 24.0);
            gl_FragColor = vec4(c, 1.0); }`,
      }),
    [],
  );
  const stars = useMemo(() => {
    const r = rng(8);
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = r() * 6.283;
      const h = 0.06 + Math.pow(r(), 0.8) * 0.94;
      const q = Math.sqrt(1 - h * h);
      pos.set([Math.cos(u) * q * 1600, h * 1600, Math.sin(u) * q * 1600], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const moonTex = useMemo(() => {
    const [c, ctx] = makeCanvas(256, 256);
    const r = rng(3);
    ctx.fillStyle = '#f4f0e2';
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, 6.283);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = `rgba(120,128,145,${0.05 + r() * 0.11})`;
      ctx.beginPath();
      ctx.arc(40 + r() * 176, 40 + r() * 176, 5 + r() * 27, 0, 6.283);
      ctx.fill();
    }
    ctx.restore();
    return canvasTex(c);
  }, []);
  // montagnes en silhouettes successives, de plus en plus sombres
  const ranges = useMemo(
    () =>
      ([[850, 190, 0x050a12, 2], [620, 120, 0x07101b, 1], [430, 60, 0x0a1220, 0]] as const).map(([r, h, c, L]) => {
        const geo = new THREE.CylinderGeometry(r, r, 1, 256, 1, true);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          if (p.getY(i) > 0) {
            const a = Math.atan2(p.getZ(i), p.getX(i));
            p.setY(i, h * (0.3 + 0.7 * Math.max(0, fbm(Math.cos(a) * 3 + L * 7, Math.sin(a) * 3, L, 5) + 0.45)));
          } else p.setY(i, -5);
        }
        return { geo, mat: new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, fog: false }) };
      }),
    [],
  );
  useEffect(
    () => () => {
      mat.dispose();
      stars.dispose();
      moonTex.dispose();
      ranges.forEach((m) => {
        m.geo.dispose();
        m.mat.dispose();
      });
    },
    [mat, stars, moonTex, ranges],
  );
  const moonPos = MOON_DISC.clone().multiplyScalar(1400).toArray();
  return (
    <>
      <mesh material={mat} renderOrder={-10}>
        <sphereGeometry args={[1800, 32, 16]} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial color="#cfdcff" size={1.6} sizeAttenuation={false} fog={false} transparent opacity={0.85} />
      </points>
      <sprite position={moonPos} scale={96}>
        <spriteMaterial map={moonTex} color={new THREE.Color(1.5, 1.5, 1.45)} fog={false} transparent depthWrite={false} />
      </sprite>
      <sprite position={moonPos} scale={540}>
        <spriteMaterial map={glowTex} color="#8fb0e0" fog={false} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      {ranges.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={m.mat} />
      ))}
    </>
  );
}

// ---------- Berges ----------
/** Sable ratissé en cercles autour de l'étang, et en ondes autour de chaque groupe de rochers. */
function sandTexture() {
  const S = 2048;
  const k = S / (2 * SAND_R);
  const BASE = '#aaa395';
  const [c, ctx] = makeCanvas(S, S);
  const r = rng(5);
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60000; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(r() * S, r() * S, 2, 2);
  }
  const rake = (x: number, y: number, rad: number) => {
    ctx.strokeStyle = 'rgba(55,50,44,0.6)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 6.283);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,236,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, rad + 2.2, 0, 6.283);
    ctx.stroke();
  };
  for (let rad = SAND_IN + 0.6; rad < SAND_R; rad += 0.9) rake(S / 2, S / 2, rad * k);
  for (const s of ROCK_SPOTS) {
    // l'anneau couché projette le canvas à plat : (x, z) du monde → (x, y) du canvas
    const x = ((s.x / SAND_R + 1) * S) / 2;
    const y = ((s.z / SAND_R + 1) * S) / 2;
    ctx.fillStyle = BASE;
    ctx.beginPath();
    ctx.arc(x, y, (s.r + 4.2) * k, 0, 6.283);
    ctx.fill();
    for (let rr = s.r + 0.5; rr < s.r + 4.2; rr += 0.9) rake(x, y, rr * k);
  }
  return canvasTex(c);
}

/** Instances posées une fois pour toutes (rochers de la rive, haies, forêt). */
function Instances({ geo, mat, count, seed, place, shadows = false }: { geo: THREE.BufferGeometry; mat: THREE.Material; count: number; seed: number; place: (o: THREE.Object3D, rnd: (a: number, b: number) => number, i: number) => void; shadows?: boolean }) {
  const mesh = useMemo(() => {
    const r = rng(seed);
    const rnd = (a: number, b: number) => a + r() * (b - a);
    const m = new THREE.InstancedMesh(geo, mat, count);
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      place(o, rnd, i);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.receiveShadow = true;
    m.castShadow = shadows;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, mat, count, seed]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x1b2d1a, roughness: 1, flatShading: true });
const forestMat = new THREE.MeshStandardMaterial({ color: 0x0b1511, roughness: 1 });
const forestGeo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);

function Banks() {
  const sand = useMemo(() => {
    const tex = sandTexture();
    return { tex, mat: new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2, roughness: 1 }) };
  }, []);
  useEffect(
    () => () => {
      sand.tex.dispose();
      sand.mat.dispose();
    },
    [sand],
  );
  return (
    <>
      {/* berge de sable ratissé bordée de rochers, puis l'herbe jusqu'à la forêt */}
      <mesh rotation-x={-Math.PI / 2} position-y={GY} material={sand.mat} receiveShadow>
        <ringGeometry args={[SAND_IN, SAND_R, 160, 4]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={GY}>
        <ringGeometry args={[SAND_R, 1300, 96, 2]} />
        <meshStandardMaterial color="#0f1a12" roughness={1} />
      </mesh>
      <Instances
        geo={rockGeos[1]}
        mat={MAT.stone}
        count={240}
        seed={11}
        place={(o, rnd, i) => {
          const a = (i / 240) * 6.283 + rnd(-0.01, 0.01);
          const r = rnd(SAND_IN - 1, SAND_IN + 2.5);
          const s = rnd(0.7, 2);
          o.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
          o.scale.set(s * rnd(0.9, 1.4), s * 0.55, s);
          o.rotation.set(0, rnd(0, 6.3), 0);
        }}
      />
      <Instances
        geo={leafGeo}
        mat={hedgeMat}
        count={80}
        seed={12}
        place={(o, rnd) => {
          const a = rnd(0, 6.283);
          const r = rnd(168, 184);
          o.position.set(Math.cos(a) * r, GY, Math.sin(a) * r);
          o.scale.set(rnd(2, 3.6), rnd(1.1, 1.8), rnd(2, 3.6));
          o.rotation.set(0, rnd(0, 6), 0);
        }}
      />
      <Instances
        geo={forestGeo}
        mat={forestMat}
        count={300}
        seed={13}
        place={(o, rnd) => {
          const a = rnd(0, 6.283);
          const r = rnd(192, 340);
          const h = rnd(10, 30);
          o.position.set(Math.cos(a) * r, GY, Math.sin(a) * r);
          o.scale.set(h * 0.27, h, h * 0.27);
          o.rotation.set(0, 0, 0);
        }}
      />
      {BANK_TREES.map((t) => (
        <group key={t.seed} position={t.pos}>
          <Tree h={t.h} kind={t.kind} seed={t.seed} />
        </group>
      ))}
      {ROCK_SPOTS.map((s) => (
        <group key={s.seed}>
          <Rock size={s.r * 0.75} flat={0.8} seed={s.seed} position={[s.x, GY, s.z]} />
          {[0, 1].map((k) => {
            const a = s.seed * 2.1 + k * 2.6;
            return <Rock key={k} size={s.r * (0.25 + k * 0.12)} seed={s.seed + k + 5} position={[s.x + Math.cos(a) * s.r * 0.75, GY, s.z + Math.sin(a) * s.r * 0.75]} />;
          })}
        </group>
      ))}
      {/* lanternes de pierre tout autour de l'étang */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * 6.283 + Math.PI / 8;
        return (
          <group key={i} position={[Math.cos(a) * (SAND_IN + 5), GY, Math.sin(a) * (SAND_IN + 5)]}>
            <Toro scale={1.4} color="#ffb46b" />
          </group>
        );
      })}
      {/* grand torii les pieds dans l'eau, et un plus petit sur la berge */}
      <group position={[0, -0.6, -(SAND_IN - 3)]}>
        <Torii scale={1.45} />
      </group>
      {BANK.filter((b) => b.kind === 'torii').map((b) => (
        <group key={b.seed} position={[Math.cos(b.a) * 110, GY, Math.sin(b.a) * 110]} rotation-y={-b.a + Math.PI / 2}>
          <Torii scale={0.75} />
        </group>
      ))}
    </>
  );
}

// ---------- Pétales ----------
const NP = 600;
const petalGeo = new THREE.PlaneGeometry(0.22, 0.14);
const petalMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, emissive: 0x2a1018 });

function Petals() {
  const { mesh, P, spawn } = useMemo(() => {
    const crowns = [...BANK_TREES, ...HUB_TREES].flatMap((t) => {
      const s = treeShape(t.h, t.kind, t.seed);
      s.tubes.forEach((g) => g.dispose());
      if (s.petal === null) return [];
      const color = s.petal;
      return s.crown.map((c) => ({ p: c.add(new THREE.Vector3(...t.pos)), c: color }));
    });
    const mesh = new THREE.InstancedMesh(petalGeo, petalMat, NP);
    mesh.frustumCulled = false;
    const P = Array.from({ length: NP }, () => ({ p: new THREE.Vector3(), r: new THREE.Euler(), v: 1, w: 1 }));
    const r = rng(66);
    const rnd = (a: number, b: number) => a + r() * (b - a);
    const col = new THREE.Color();
    // un pétale repart de la couronne d'un arbre en fleurs
    const spawn = (i: number, init = false) => {
      const s = crowns[Math.floor(r() * crowns.length)];
      const q = P[i];
      q.p.copy(s.p).add(new THREE.Vector3(rnd(-2.5, 2.5), rnd(-1, 1), rnd(-2.5, 2.5)));
      if (init) q.p.y = rnd(0.5, s.p.y);
      q.v = rnd(0.5, 1.1);
      q.w = rnd(1, 3);
      q.r.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
      mesh.setColorAt(i, col.set(s.c).offsetHSL(0, 0, rnd(-0.08, 0.08)));
    };
    for (let i = 0; i < NP; i++) spawn(i, true);
    return { mesh, P, spawn };
  }, []);
  useEffect(() => () => mesh.dispose(), [mesh]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = clock.elapsedTime;
    for (let i = 0; i < NP; i++) {
      const q = P[i];
      q.p.y -= dt * q.v;
      q.p.x += dt * (0.5 + Math.sin(t * 0.7 + i) * 0.5);
      q.p.z += dt * Math.cos(t * 0.5 + i * 0.3) * 0.4;
      q.r.x += dt * q.w;
      q.r.y += dt * q.w * 0.7;
      if (q.p.y < 0.1) spawn(i);
      o.position.copy(q.p);
      o.rotation.copy(q.r);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

export function Garden() {
  return (
    <>
      <Sky />
      <Banks />
      <Petals />
    </>
  );
}
