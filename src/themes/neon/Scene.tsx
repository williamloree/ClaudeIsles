// Néon : ville cyberpunk sous la pluie, eau noire, tour holographique de Claude, plateformes
// hexagonales reliées par des passerelles lumineuses, androïdes devant leurs écrans.
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { SceneProps } from '../types';
import { Bridges } from './Bridges';
import { City } from './City';
import { Drifters } from './Drifters';
import { Hub } from './Hub';
import { HAZE, uTime } from './materials';
import { Satellite } from './Satellite';
import { Station } from './Station';
import { ShellTerminal } from './Terminal';

/** Fait avancer l'horloge commune des shaders (pluie, hologrammes, impulsions…). */
function Clock() {
  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime;
  });
  return null;
}

export function Scene({ layout, workers, selectedKey }: SceneProps) {
  return (
    <>
      <color attach="background" args={[HAZE]} />
      <fogExp2 attach="fog" args={[HAZE, 0.0042]} />
      <ambientLight intensity={0.8} color="#1a0f30" />
      <hemisphereLight args={['#4a2a7a', '#05040a', 0.6]} />
      {/* clair de lune bleuté au-dessus des nuages */}
      <directionalLight position={[40, 80, -60]} intensity={0.5} color="#6a7cff" />
      <Clock />
      <City />

      <Hub />
      {workers.map((w) => (
        <Station key={w.id} info={w} />
      ))}
      <Bridges bridges={layout.bridges} />

      {layout.shells.map((s) => (
        <ShellTerminal key={s.shell.id} shell={s.shell} pos={s.pos} selected={selectedKey === `shell:${s.shell.id}`} />
      ))}
      {layout.sessions.map((s) => (
        <Satellite key={s.session.id} session={s.session} pos={s.pos} selected={selectedKey === `session:${s.session.id}`} />
      ))}
      <Drifters boats={layout.boats} />

      {/* rendu en flottants : seuls les néons (> 1) débordent dans le bloom, puis ACES */}
      <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.85} luminanceSmoothing={0.25} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.7} />
      </EffectComposer>
    </>
  );
}
