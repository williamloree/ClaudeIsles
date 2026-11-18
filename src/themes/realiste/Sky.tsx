// Ciel physique de fin d'après-midi (soleil bas), éclairage d'environnement tiré du ciel,
// océan très loin en contrebas, mer de nuages, rochers en suspension et oiseaux.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky as SkyMesh } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { MAT, cloudTex, fbm, rng, waterNormals } from './materials';

/** Direction du soleil : 9° au-dessus de l'horizon. */
export const SUN = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 9), THREE.MathUtils.degToRad(205));

function makeSky(scale: number) {
  const sky = new SkyMesh();
  sky.scale.setScalar(scale);
  const u = sky.material.uniforms;
  u.turbidity.value = 5;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(SUN);
  return sky;
}

function SkyDome() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => makeSky(1500), []);
  // éclairage d'environnement : le ciel, préfiltré une fois
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envSky = makeSky(1000);
    const envScene = new THREE.Scene();
    envScene.add(envSky);
    const rt = pmrem.fromScene(envScene);
    scene.environment = rt.texture;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
      envSky.geometry.dispose();
      envSky.material.dispose();
    };
  }, [gl, scene]);
  useEffect(
    () => () => {
      sky.geometry.dispose();
      sky.material.dispose();
    },
    [sky],
  );
  return <primitive object={sky} />;
}

function Ocean() {
  const water = useMemo(() => {
    const w = new Water(new THREE.CircleGeometry(HAZE_FAR + 60, 64), {
      textureWidth: 256,
      textureHeight: 256,
      waterNormals,
      sunDirection: SUN.clone(),
      sunColor: 0xfff0dd,
      waterColor: 0x0d3b55,
      distortionScale: 3.2,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    w.position.y = -95;
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
    (water.material as THREE.ShaderMaterial).uniforms.time.value += dt * 0.6;
  });
  return <primitive object={water} />;
}

/** Couleur de la brume lointaine : le brouillard et le voile d'horizon la partagent. */
const HAZE = '#d6dde6';
const HAZE_FAR = 1300;

// Voile d'horizon : un grand cylindre opaque en bas, qui s'efface vers le ciel. Il cache le bord
// de l'océan (la caméra ne voit pas au-delà de 2000) et fond la mer dans le ciel.
const hazeTex = (() => {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.65, 'rgba(255,255,255,1)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1, 256);
  return new THREE.CanvasTexture(c);
})();
const hazeGeo = new THREE.CylinderGeometry(HAZE_FAR + 100, HAZE_FAR + 100, 300, 64, 1, true);
const hazeMat = new THREE.MeshBasicMaterial({ color: HAZE, alphaMap: hazeTex, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide });

const lowCloudMat = new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color(0xfff4ec).multiplyScalar(1.35), transparent: true, depthWrite: false, opacity: 0.8 });
const highCloudMat = new THREE.SpriteMaterial({ map: cloudTex, color: 0xffe9d6, transparent: true, depthWrite: false, opacity: 0.35 });

/** Mer de nuages sous les îles, et quelques nuages hauts au loin. */
function Clouds() {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const r = rng(2024);
    const low = Array.from({ length: 200 }, () => {
      const a = r() * Math.PI * 2;
      const d = 20 + r() * 470;
      return { pos: [Math.cos(a) * d, -66 + r() * 18, Math.sin(a) * d] as [number, number, number], s: 45 + r() * 70, high: false };
    });
    const high = Array.from({ length: 18 }, () => {
      const a = r() * Math.PI * 2;
      const d = 200 + r() * 220;
      return { pos: [Math.cos(a) * d, 25 + r() * 50, Math.sin(a) * d] as [number, number, number], s: 60 + r() * 60, high: true };
    });
    return [...low, ...high];
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004;
  });
  return (
    <group ref={ref}>
      {items.map((c, i) => (
        <sprite key={i} material={c.high ? highCloudMat : lowCloudMat} position={c.pos} scale={[c.s, c.high ? c.s : c.s * 0.55, 1]} />
      ))}
    </group>
  );
}

/** Éclats de roche en suspension, détachés des îles, qui oscillent lentement. */
function FloatingRocks() {
  const ref = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    const r = rng(99);
    return Array.from({ length: 14 }, (_, i) => {
      const a = r() * Math.PI * 2;
      const d = 24 + r() * 66;
      const geo = new THREE.DodecahedronGeometry(0.5 + r() * 0.7, 1);
      const p = geo.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const y = p.getY(j);
        // dessus plat, dessous en pointe : de petites îles miniatures
        p.setXYZ(j, p.getX(j) * (1 + fbm(p.getX(j) + i, y, p.getZ(j)) * 0.5), y > 0 ? y * 0.3 : y * 1.6, p.getZ(j));
      }
      geo.computeVertexNormals();
      return { geo, pos: [Math.cos(a) * d, -16 + r() * 8, Math.sin(a) * d] as [number, number, number], phase: r() * 10, rot: r() * Math.PI };
    });
  }, []);
  useEffect(() => () => items.forEach((it) => it.geo.dispose()), [items]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current?.children.forEach((m, i) => {
      const it = items[i];
      m.position.y = it.pos[1] + Math.sin(t * 0.4 + it.phase) * 0.6;
      m.rotation.y = it.rot + t * 0.02;
    });
  });
  return (
    <group ref={ref}>
      {items.map((it, i) => (
        <mesh key={i} geometry={it.geo} material={MAT.rock} position={it.pos} castShadow />
      ))}
    </group>
  );
}

// oiseau : deux ailes triangulaires qui battent
const wingGeo = new THREE.BufferGeometry();
wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, 0, 0, 0.3, 1.1, 0, 0.05], 3));
wingGeo.computeVertexNormals();
const birdMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1, side: THREE.DoubleSide });

/** Un vol d'oiseaux qui tourne autour de l'archipel. */
function Birds() {
  const ref = useRef<THREE.Group>(null);
  const birds = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 11 }, (_, i) => ({ off: [(r() - 0.5) * 10, (r() - 0.5) * 3, -Math.abs(i - 5) * 1.6 + (r() - 0.5)] as [number, number, number], phase: r() * 6 }));
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = ref.current;
    if (!g) return;
    const a = t * 0.05;
    g.position.set(Math.cos(a) * 48, 24 + Math.sin(t * 0.3) * 2, Math.sin(a) * 48);
    g.rotation.y = -a;
    g.children.forEach((b, i) => {
      const flap = Math.sin(t * 7 + birds[i].phase) * 0.6;
      b.children[0].rotation.z = flap;
      b.children[1].rotation.z = -flap;
    });
  });
  return (
    <group ref={ref}>
      {birds.map((b, i) => (
        <group key={i} position={b.off}>
          <mesh geometry={wingGeo} material={birdMat} />
          <mesh geometry={wingGeo} material={birdMat} scale={[-1, 1, 1]} />
        </group>
      ))}
    </group>
  );
}

export function Environment() {
  const sunPos = SUN.clone().multiplyScalar(160).toArray() as [number, number, number];
  return (
    <>
      <color attach="background" args={[HAZE]} />
      <fog attach="fog" args={[HAZE, 230, HAZE_FAR]} />
      <SkyDome />
      <mesh geometry={hazeGeo} material={hazeMat} position={[0, -120, 0]} renderOrder={-1} />
      <directionalLight
        position={sunPos}
        intensity={3.2}
        color="#ffd6a5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-85}
        shadow-camera-right={85}
        shadow-camera-top={85}
        shadow-camera-bottom={-85}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#bfd4ff', '#5a4632', 0.5]} />
      <Ocean />
      <Clouds />
      <FloatingRocks />
      <Birds />
    </>
  );
}
