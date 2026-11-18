// L'étang : eau sombre qui reflète la lune et les lanternes, carpes koï sous la surface, brume,
// lucioles, et les tōrō nagashi (lanternes flottantes) des anciens agents qui dérivent.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { STATUS_COLOR, cut } from '../../format';
import { laneFor, laneIndex, lanePoint, setLivePosition, type Boat } from '../../scene/boats';
import { BoatLabel, selectKey } from '../../scene/labels';
import { useStore } from '../../store';
import { MAT, MOON_DISC, SERIF, glowTex, makeCanvas, rng, useFontsReady, waterNormals } from './materials';

// ---------- Eau ----------
function PondWater() {
  const water = useMemo(() => {
    const w = new Water(new THREE.PlaneGeometry(600, 600), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: MOON_DISC.clone(),
      sunColor: 0xc4d8ff,
      waterColor: 0x04101c,
      distortionScale: 1.1,
      fog: true,
      alpha: 0.78,
    });
    w.rotation.x = -Math.PI / 2;
    (w.material as THREE.ShaderMaterial).transparent = true;
    w.renderOrder = -1;
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
  return (
    <>
      <primitive object={water} />
      {/* fond de l'étang, entrevu sous l'eau */}
      <mesh rotation-x={-Math.PI / 2} position-y={-3}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#0b1714" roughness={1} />
      </mesh>
    </>
  );
}

// ---------- Carpes koï ----------
const koiBody = new THREE.SphereGeometry(1, 20, 14);
const koiTail = new THREE.PlaneGeometry(0.6, 0.55);
const koiFin = new THREE.PlaneGeometry(0.34, 0.2);

function Kois({ count = 12 }: { count?: number }) {
  const group = useRef<THREE.Group>(null);
  const kois = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = rng(900 + i);
        const rnd = (a: number, b: number) => a + r() * (b - a);
        const [c, ctx] = makeCanvas(128, 64);
        ctx.fillStyle = i % 3 === 0 ? '#e8501a' : '#f1ece2';
        ctx.fillRect(0, 0, 128, 64);
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = i % 3 === 0 ? '#f6e8d8' : '#e4561d';
          ctx.beginPath();
          ctx.ellipse(rnd(0, 128), rnd(10, 54), rnd(8, 22), rnd(6, 14), rnd(0, 3), 0, 6.283);
          ctx.fill();
        }
        if (i % 2)
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = '#141414';
            ctx.beginPath();
            ctx.arc(rnd(0, 128), rnd(10, 54), rnd(3, 7), 0, 6.283);
            ctx.fill();
          }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide });
        return { tex, mat, s: rnd(1.3, 2), r: rnd(24, 76), sp: rnd(0.035, 0.08) * (i % 2 ? 1 : -1), ph: rnd(0, 6.283), y: rnd(-0.6, -0.3) };
      }),
    [count],
  );
  useEffect(
    () => () =>
      kois.forEach((k) => {
        k.tex.dispose();
        k.mat.dispose();
      }),
    [kois],
  );
  const nxt = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((g, i) => {
      const k = kois[i];
      const pos = (a: number) => {
        const r = k.r + Math.sin(a * 3 + k.ph) * 4;
        return [Math.cos(a) * r, Math.sin(a) * r];
      };
      const a = k.ph + t * k.sp;
      const [x, z] = pos(a);
      const [x2, z2] = pos(a + 0.02 * Math.sign(k.sp));
      g.position.set(x, k.y, z);
      g.lookAt(nxt.set(x2, k.y, z2));
      g.children[1].rotation.y = Math.sin(t * 7 + k.ph) * 0.5; // queue
      g.children[0].rotation.y = Math.sin(t * 7 + k.ph - 1) * 0.08;
    });
  });
  return (
    <group ref={group}>
      {kois.map((k, i) => (
        <group key={i} scale={k.s}>
          <mesh geometry={koiBody} material={k.mat} scale={[0.3, 0.2, 1]} />
          <group position-z={-0.9}>
            <mesh geometry={koiTail} material={k.mat} rotation-x={-Math.PI / 2} position-z={-0.25} />
          </group>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={koiFin} material={k.mat} rotation-x={-Math.PI / 2} position={[s * 0.36, -0.03, 0.3]} />
          ))}
        </group>
      ))}
    </group>
  );
}

// ---------- Brume et lucioles ----------
function Mist() {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 80 }, () => {
      const a = r() * Math.PI * 2;
      const d = 10 + r() * 110;
      return { pos: [Math.cos(a) * d, 0.6 + r() * 1.6, Math.sin(a) * d] as [number, number, number], s: [18 + r() * 20, 4 + r() * 4, 1] as [number, number, number] };
    });
  }, []);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex, color: '#9fb4d0', transparent: true, opacity: 0.07, depthWrite: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y -= dt * 0.006;
  });
  return (
    <group ref={ref}>
      {items.map((m, i) => (
        <sprite key={i} material={mat} position={m.pos} scale={m.s} />
      ))}
    </group>
  );
}

/** Lucioles : un seul nuage de points qui clignotent, animé dans le shader. */
function Fireflies({ count = 110 }: { count?: number }) {
  const { geo, mat } = useMemo(() => {
    const r = rng(55);
    const pos = new Float32Array(count * 3);
    const anim = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = r() < 0.4 ? 80 + r() * 25 : 15 + r() * 60;
      pos.set([Math.cos(a) * d, 1 + r() * 5, Math.sin(a) * d], i * 3);
      anim.set([r() * 6.283, 0.2 + r() * 0.3, 0.8 + r() * 1.2], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('anim', new THREE.BufferAttribute(anim, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color('#d8ff7a') } },
      vertexShader: `
        uniform float time; attribute vec3 anim; varying float vA;
        void main() {
          float ph = anim.x, w = anim.y, bl = anim.z;
          vec3 p = position + vec3(sin(time * w + ph) * 1.5, sin(time * w * 1.3 + ph) * 0.6, cos(time * w * 0.8 + ph) * 1.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = 0.1 + 0.9 * pow(max(0.0, sin(time * bl + ph)), 3.0);
          gl_PointSize = 260.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 color; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float k = pow(max(0.0, 1.0 - d), 2.2);
          gl_FragColor = vec4(color * 1.6 * k * vA, k * vA);
        }`,
    });
    return { geo, mat };
  }, [count]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(({ clock }) => {
    mat.uniforms.time.value = clock.elapsedTime;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// ---------- Tōrō nagashi : anciens agents qui dérivent ----------
const NAGASHI = 2.4; // assez grand pour être vu depuis la vue d'ensemble
const baseGeo = new THREE.BoxGeometry(1.1, 0.16, 1.1);
const paperGeo = new THREE.BoxGeometry(0.8, 0.9, 0.8);
const stickGeo = new THREE.BoxGeometry(0.06, 1.0, 0.06);
const roofGeo = new THREE.ConeGeometry(0.66, 0.3, 4, 1);
const poolGeo = new THREE.PlaneGeometry(1, 1);
const CORNERS: [number, number][] = [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]];

function drawNagashi(ctx: CanvasRenderingContext2D, boat: Boat) {
  const g = ctx.createRadialGradient(64, 80, 10, 64, 72, 90);
  g.addColorStop(0, '#fff2cf');
  g.addColorStop(1, '#e8a75a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 144);
  ctx.strokeStyle = '#5a3a1e';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 138);
  ctx.fillStyle = '#9e2a1c';
  ctx.font = `700 58px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText('灯', 64, 80);
  ctx.fillStyle = '#4a3420';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillText(cut(boat.title, 20), 64, 112);
  // liseré du statut
  ctx.fillStyle = STATUS_COLOR[boat.status];
  ctx.fillRect(10, 124, 108, 7);
}

function Nagashi({ boat, index, selected }: { boat: Boat; index: number; selected: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const lane = useMemo(() => laneFor(index), [index]);
  const color = STATUS_COLOR[boat.status];
  const canvas = useMemo(() => makeCanvas(128, 144)[0], []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  const paperMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 1.25 }), [texture]);
  // halo chaud sur l'eau, teinté du statut de l'agent
  const poolMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color('#ffa24d').lerp(new THREE.Color(color), 0.45), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    [color],
  );
  useEffect(
    () => () => {
      texture.dispose();
      paperMat.dispose();
      poolMat.dispose();
    },
    [texture, paperMat, poolMat],
  );
  const fonts = useFontsReady();
  useEffect(() => {
    drawNagashi(canvas.getContext('2d')!, boat);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boat.title, boat.status, fonts]);

  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!ref.current) return;
    lanePoint(lane, t, p);
    const y = 0.05 + Math.sin(t * 1.3 + index) * 0.05;
    ref.current.position.set(p.x, y, p.z);
    ref.current.rotation.set(Math.sin(t * 0.8 + index) * 0.03, t * 0.08 + index, Math.sin(t + index) * 0.04);
    poolMat.opacity = 0.5 + Math.sin(t * 2.1 + index) * 0.06;
    setLivePosition(boat.key, p.x, 1.5, p.z);
  });
  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        selectKey(boat.key);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
    >
      <group scale={NAGASHI}>
        <mesh geometry={baseGeo} material={MAT.wood} position-y={0.08} castShadow />
        <mesh geometry={paperGeo} material={paperMat} position-y={0.61} />
        {CORNERS.map(([x, z]) => (
          <mesh key={`${x},${z}`} geometry={stickGeo} material={MAT.wood} position={[x, 0.62, z]} />
        ))}
        <mesh geometry={roofGeo} material={MAT.lacquer} position-y={1.25} rotation-y={Math.PI / 4} />
      </group>
      <mesh geometry={poolGeo} material={poolMat} rotation-x={-Math.PI / 2} position-y={0.06} scale={NAGASHI * 5} renderOrder={1} />
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.1}>
          <ringGeometry args={[2.6, 2.85, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} />
        </mesh>
      )}
      {(hover || selected) && <BoatLabel boat={boat} selected={selected} position={[0, 5, 0]} />}
    </group>
  );
}

export function Pond({ boats }: { boats: Boat[] }) {
  const selection = useStore((s) => s.selection);
  const selKey = selection ? `${selection.kind}:${selection.id}` : null;
  return (
    <>
      <PondWater />
      <Kois />
      <Mist />
      <Fireflies />
      {boats.map((b) => (
        <Nagashi key={b.key} boat={b} index={laneIndex(b.key)} selected={selKey === b.key} />
      ))}
    </>
  );
}
