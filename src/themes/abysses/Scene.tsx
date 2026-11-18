// Les Abysses : une cité engloutie. Claude est une grande méduse au-dessus d'un dôme de verre ; les agents
// travaillent dans des habitats-bulles reliés par des tubes ; les sessions errent en petites méduses.
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ISLET_TOP } from '../../scene/slots';
import type { SceneProps } from '../types';
import { BUBBLE, Habitat } from './Habitat';
import { DOME, Hub } from './Hub';
import { Life, type Emitter } from './Life';
import { U } from './materials';
import { NacreTablet } from './NacreTablet';
import { CHIMNEYS, FOG, Seabed } from './Seabed';
import { SessionJelly } from './SessionJelly';
import { Tubes } from './Tubes';
import { Vessels } from './Vessels';

/** Fait avancer l'horloge commune des shaders (caustiques, méduses, kelp, rayons). */
function OceanClock() {
  useFrame(({ clock }) => {
    U.time.value = clock.elapsedTime;
  });
  return null;
}

export function Scene({ layout, workers, selectedKey }: SceneProps) {
  // Bulles : cheminées du fond, sommet du dôme et évent de chaque habitat.
  const ventsKey = workers.map((w) => w.slot).join(',');
  const emitters = useMemo<Emitter[]>(
    () => [
      { x: 0, y: ISLET_TOP + DOME, z: 0, w: 0.6 },
      ...CHIMNEYS.map(([x, y, z]) => ({ x, y: y + 2, z, w: 0.6 })),
      ...workers.map((w) => ({ x: w.pos[0], y: ISLET_TOP + BUBBLE + 0.5, z: w.pos[2], w: 0.3 })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ventsKey],
  );

  return (
    <>
      <color attach="background" args={[FOG]} />
      <fogExp2 attach="fog" args={[FOG, 0.0082]} />
      <ambientLight intensity={0.9} color="#0d3a4a" />
      <hemisphereLight args={['#3fa7c0', '#061418', 0.9]} />
      {/* lumière filtrée de la surface, très haut */}
      <directionalLight
        position={[20, 100, 10]}
        intensity={1.3}
        color="#8fd8ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-camera-far={300}
      />
      <OceanClock />
      <Seabed />
      <Life emitters={emitters} />

      <Hub />
      {workers.map((w) => (
        <Habitat key={w.id} info={w} />
      ))}
      <Tubes bridges={layout.bridges} />

      {layout.shells.map((s) => (
        <NacreTablet key={s.shell.id} shell={s.shell} pos={s.pos} slot={s.slot} selected={selectedKey === `shell:${s.shell.id}`} />
      ))}
      {layout.sessions.map((s) => (
        <SessionJelly key={s.session.id} session={s.session} pos={s.pos} slot={s.slot} selected={selectedKey === `session:${s.session.id}`} />
      ))}
      <Vessels boats={layout.boats} selectedKey={selectedKey} />

      <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.6} luminanceSmoothing={0.2} />
        <Vignette offset={0.3} darkness={0.7} />
      </EffectComposer>
    </>
  );
}
