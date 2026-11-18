// Jardin zen au clair de lune : étang, grande lanterne de pierre de Claude, îlots de mousse reliés
// par des ponts rouges, moines qui écrivent sur leurs rouleaux, lanternes de papier et tōrō nagashi.
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ISLAND_SLOTS, ISLET_RADIUS } from '../../scene/slots';
import type { SceneProps } from '../types';
import { Bridges } from './Bridges';
import { Chochin } from './Chochin';
import { FOG, Garden } from './Garden';
import { Hub } from './Hub';
import { Islet } from './Islet';
import { Kakemono } from './Kakemono';
import { MOON_LIGHT } from './materials';
import { MonkIsle } from './Monk';
import { Pond } from './Pond';

const moonPos = MOON_LIGHT.clone().multiplyScalar(160).toArray();

export function Scene({ layout, workers, selectedKey }: SceneProps) {
  return (
    <>
      <color attach="background" args={['#02040a']} />
      <fogExp2 attach="fog" args={[FOG, 0.0042]} />
      <ambientLight intensity={1.0} color="#22304f" />
      <hemisphereLight args={['#4a6a9c', '#141a12', 0.85]} />
      {/* clair de lune, qui porte les ombres */}
      <directionalLight
        position={moonPos}
        intensity={1.5}
        color="#a9c2ee"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
        shadow-camera-near={1}
        shadow-camera-far={400}
      />
      <Garden />
      <Pond boats={layout.boats} />

      <Hub />

      {/* Seuls les îlots occupés existent ; le moine tourne le dos au pont qui arrive du hub. */}
      {workers.map((w) => {
        const slot = ISLAND_SLOTS[w.slot];
        const angle = Math.atan2(slot[2], slot[0]);
        return (
          <Islet key={w.id} radius={ISLET_RADIUS} seed={5 + w.slot * 2.7} position={slot} onClick={w.onClick}>
            <MonkIsle info={w} angle={angle} />
          </Islet>
        );
      })}
      <Bridges bridges={layout.bridges} />

      {layout.sessions.map((s) => (
        <Chochin key={s.session.id} session={s.session} pos={s.pos} selected={selectedKey === `session:${s.session.id}`} />
      ))}

      {layout.shells.map((s) => (
        <Kakemono key={s.shell.id} shell={s.shell} pos={s.pos} selected={selectedKey === `shell:${s.shell.id}`} />
      ))}

      <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
        <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.6} luminanceSmoothing={0.25} />
        <Vignette offset={0.3} darkness={0.7} />
      </EffectComposer>
    </>
  );
}
