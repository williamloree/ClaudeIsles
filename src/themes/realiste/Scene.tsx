// Archipel céleste : îles flottantes au-dessus d'une mer de nuages, ponts de cordes, sapins,
// observatoire de verre au centre, montgolfières et dirigeables, sous un soleil de fin d'après-midi.
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { ISLAND_SLOTS, ISLET_TOP } from '../../scene/slots';
import type { SceneProps } from '../types';
import { Airships } from './Airships';
import { Balloon } from './Balloon';
import { Bridges } from './Bridges';
import { Hub } from './Hub';
import { Island } from './Island';
import { islandTemplate } from './islands';
import { Office } from './Office';
import { ShellScreen } from './ShellScreen';
import { Environment } from './Sky';

export function Scene({ layout, workers, selectedKey }: SceneProps) {
  return (
    <>
      <Environment />
      <Hub />

      {/* Seules les îles occupées existent ; le pont arrive du côté de l'île centrale. */}
      {workers.map((w) => {
        const slot = ISLAND_SLOTS[w.slot];
        const angle = Math.atan2(slot[2], slot[0]);
        return (
          <Island key={w.id} template={islandTemplate(w.slot)} position={slot} onClick={w.onClick}>
            {/* l'agent tourne le dos au large : en arrivant de l'extérieur, on lit son écran par-dessus son épaule */}
            <group position={[0, ISLET_TOP, 0]} rotation-y={-angle + Math.PI / 2}>
              <Office info={w} />
            </group>
          </Island>
        );
      })}
      <Bridges bridges={layout.bridges} />

      {layout.sessions.map((s) => (
        <Balloon key={s.session.id} session={s.session} slot={s.slot} pos={s.pos} selected={selectedKey === `session:${s.session.id}`} />
      ))}

      {layout.shells.map((s) => (
        <ShellScreen key={s.shell.id} shell={s.shell} pos={s.pos} selected={selectedKey === `shell:${s.shell.id}`} />
      ))}

      <Airships boats={layout.boats} />

      {/* rendu HDR : le ciel physique dépasse 1, l'ACES (exposition du thème) le ramène à l'écran */}
      <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur intensity={0.4} luminanceThreshold={1.4} luminanceSmoothing={0.3} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.35} darkness={0.45} />
      </EffectComposer>
    </>
  );
}
