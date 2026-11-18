// La banquise : nuit polaire sous l'aurore boréale, phare de Claude sur son grand iceberg,
// floes des explorateurs reliés par des passerelles de glace, kayaks et glaçons à la dérive.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { SceneProps } from '../types';
import { Bridges } from './Bridges';
import { Drift } from './Drift';
import { Floe } from './Floe';
import { Hub } from './Hub';
import { Monolith } from './Monolith';
import { Sea } from './Sea';
import { FOG, Sky } from './Sky';
import { Sonde } from './Sonde';
import { Weather } from './Weather';

/** Lueur verte de l'aurore qui respire doucement. */
function AuroraLight() {
  const ref = useRef<THREE.DirectionalLight>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.intensity = 0.4 + Math.sin(clock.elapsedTime * 0.3) * 0.12;
  });
  return <directionalLight ref={ref} position={[30, 60, 90]} intensity={0.45} color="#52ffb4" />;
}

export function Scene({ layout, workers, selectedKey }: SceneProps) {
  return (
    <>
      <color attach="background" args={[FOG]} />
      <fogExp2 attach="fog" args={[FOG, 0.0058]} />
      <ambientLight intensity={0.7} color="#1c2c46" />
      <hemisphereLight args={['#5577a8', '#081018', 0.65]} />
      {/* clair de lune bleuté */}
      <directionalLight
        position={[-50, 80, -30]}
        intensity={0.65}
        color="#a9c6ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={300}
      />
      <AuroraLight />
      <Sky />
      <Sea />
      <Weather />

      <Hub />
      {workers.map((w) => (
        <Floe key={w.id} info={w} />
      ))}
      <Bridges bridges={layout.bridges} />

      {layout.shells.map((s) => (
        <Monolith key={s.shell.id} shell={s.shell} pos={s.pos} selected={selectedKey === `shell:${s.shell.id}`} />
      ))}
      {layout.sessions.map((s) => (
        <Sonde key={s.session.id} session={s.session} pos={s.pos} selected={selectedKey === `session:${s.session.id}`} />
      ))}
      <Drift boats={layout.boats} />

      <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
        <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.7} luminanceSmoothing={0.2} />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
    </>
  );
}
