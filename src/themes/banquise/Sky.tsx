// Nuit polaire : dégradé vers l'horizon brumeux, aurore boréale animée en rideaux (shader), étoiles.
// Le ciel est vu par la caméra miroir de l'eau : l'aurore se reflète dans la mer.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rng } from './materials';

export const FOG = '#101c29';

const skyGeo = new THREE.SphereGeometry(1800, 64, 32);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: { time: { value: 0 }, horizon: { value: new THREE.Color(FOG) } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float time; uniform vec3 horizon; varying vec3 vDir;
    float h1(float n){ return fract(sin(n) * 43758.5453); }
    float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
    void main(){
      vec3 d = normalize(vDir); float y = d.y;
      vec3 col = mix(horizon, vec3(0.0015, 0.003, 0.009), pow(smoothstep(-0.02, 0.6, y), 0.6));
      vec3 au = vec3(0.0);
      if (y > 0.012 && y < 0.6) {
        for (int i = 0; i < 12; i++) {
          float fi = float(i) / 12.0;
          vec2 p = d.xz / y * (1.0 + fi * 3.0) * 0.26;   // calque de rideau à l'altitude fi
          for (int r = 0; r < 3; r++) {
            float fr = float(r);
            float c = (r == 0 ? 2.4 : r == 1 ? -2.6 : 3.5) + sin(p.x * 0.42 + time * 0.07 + fr * 2.0) * 0.6 + sin(p.x * 1.25 - time * 0.11 + fr) * 0.2 + (n1(p.x * 0.8 + fr * 13.0 + time * 0.05) - 0.5) * 0.45;
            float dd = p.y - c, band = exp(-dd * dd * 7.0);
            float rays = pow(n1(p.x * 6.0 + fr * 31.0 + time * 0.35) * 0.7 + n1(p.x * 17.0 - time * 0.5) * 0.3, 1.6);
            vec3 tint = r == 1 ? mix(vec3(0.25, 0.85, 0.8), vec3(0.75, 0.25, 0.85), smoothstep(0.05, 0.7, fi))
                               : mix(vec3(0.12, 1.0, 0.5), vec3(0.5, 0.18, 0.95), smoothstep(0.15, 0.85, fi));
            au += tint * band * rays * (1.0 - fi) * (1.0 - fi * 0.3);
          }
        }
        au *= 0.26 * smoothstep(0.012, 0.06, y) * (1.0 - smoothstep(0.45, 0.6, y));
      }
      gl_FragColor = vec4(col + au, 1.0);
    }`,
});

function Stars() {
  const geo = useMemo(() => {
    const r = rng(4711);
    const pos: number[] = [];
    const col: number[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < 2600; i++) {
      v.set(r() * 2 - 1, 0.03 + r() * 0.97, r() * 2 - 1).normalize().multiplyScalar(1700);
      pos.push(v.x, v.y, v.z);
      const k = Math.pow(r(), 3) * 0.9 + 0.1;
      col.push(k * 0.9, k * 0.95, k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return <points geometry={geo} material={mat} renderOrder={-1} frustumCulled={false} />;
}

export function Sky() {
  useFrame(({ clock }) => {
    skyMat.uniforms.time.value = clock.elapsedTime;
  });
  return (
    <>
      <mesh geometry={skyGeo} material={skyMat} renderOrder={-2} frustumCulled={false} />
      <Stars />
    </>
  );
}
