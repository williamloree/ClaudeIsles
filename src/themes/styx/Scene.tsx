// Les Enfers : caverne, Styx, temple de la flamme éternelle, îlots de basalte reliés par des ponts de marbre.
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ISLAND_SLOTS } from '../../scene/slots';
import type { SceneProps } from '../types';
import { Bridges } from './Bridges';
import { Cave } from './Cave';
import { Hub } from './Hub';
import { HUB_TEMPLATE, ISLET_TEMPLATES } from './islands';
import { Islet } from './Islet';
import { ghostTime } from './materials';
import { Office } from './Office';
import { River } from './River';
import { SessionSat } from './SessionSat';
import { ShellStele } from './ShellStele';

/** Fait avancer l'horloge commune des fantômes. */
function GhostClock() {
  useFrame(({ clock }) => {
    ghostTime.value = clock.elapsedTime;
  });
  return null;
}

export function Scene({ layout, workers, selectedKey }: SceneProps) {
  const islets = [
    { pos: [0, 0, 0] as [number, number, number], r: HUB_TEMPLATE.radius * 1.12 },
    ...workers.map((w) => ({ pos: w.pos, r: ISLET_TEMPLATES[w.slot].radius * 1.2 })),
  ];

  return (
    <>
      {/* même teinte que le brouillard : l'eau se fond dans le noir sans ligne d'horizon */}
      <color attach="background" args={['#061012']} />
      <fogExp2 attach="fog" args={['#061012', 0.0062]} />
      <ambientLight intensity={0.9} color="#24393e" />
      <hemisphereLight args={['#2f5a5c', '#050505', 0.5]} />
      {/* lueur verdâtre tombant d'une faille de la voûte */}
      <directionalLight
        position={[-40, 90, -30]}
        intensity={0.7}
        color="#7fb7c4"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={300}
      />
      <GhostClock />
      <Cave />
      <River boats={layout.boats} islets={islets} />

      <Hub />

      {/* Seuls les îlots occupés existent ; le pont arrive côté temple, sans ruine dans le passage. */}
      {workers.map((w) => {
        const slot = ISLAND_SLOTS[w.slot];
        const template = ISLET_TEMPLATES[w.slot];
        const toHub = Math.atan2(-slot[2], -slot[0]);
        const angle = Math.atan2(slot[2], slot[0]);
        return (
          <Islet key={w.id} template={template} position={slot} clearAngle={toHub} onClick={w.onClick}>
            {/* l'esprit regarde vers le fleuve : on voit ses yeux en arrivant de l'extérieur */}
            <group position={[0, template.top, 0]} rotation-y={-angle - Math.PI / 2}>
              <Office info={w} />
            </group>
          </Islet>
        );
      })}
      <Bridges bridges={layout.bridges} />

      {layout.sessions.map((s) => (
        <SessionSat key={s.session.id} session={s.session} pos={s.pos} selected={selectedKey === `session:${s.session.id}`} />
      ))}

      {layout.shells.map((s) => (
        <ShellStele key={s.shell.id} shell={s.shell} pos={s.pos} selected={selectedKey === `shell:${s.shell.id}`} />
      ))}

      <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
        <Vignette offset={0.3} darkness={0.75} />
      </EffectComposer>
    </>
  );
}
