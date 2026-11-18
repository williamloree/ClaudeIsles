import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useStore } from '../store';
import type { Selection, Worker } from '../types';
import { Bridges } from './Bridges';
import { Cave } from './Cave';
import { Hub } from './Hub';
import { HUB_TEMPLATE, ISLAND_SLOTS, type Vec3 } from './islands';
import { Islet } from './Islet';
import type { Layout } from './layout';
import { ghostTime } from './materials';
import { Office, type OfficeInfo } from './Office';
import { River, livePositions } from './River';
import { SessionSat } from './SessionSat';
import { ShellStele } from './ShellStele';

export const selectionKey = (s: Selection) => (!s ? null : s.kind === 'hub' ? 'hub' : `${s.kind}:${s.id}`);

const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7);

function officeInfo(w: Worker, selected: boolean): OfficeInfo {
  if (w.kind === 'agent') {
    const a = w.agent;
    return {
      title: a.description,
      subtitle: a.agentType + (a.model ? ` · ${a.model.replace(/^claude-/, '')}` : ''),
      status: a.status,
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      toolUses: a.toolUses,
      activity: a.activity.at(-1)?.text ?? null,
      recent: a.activity.map((x) => x.text),
      badge: a.background ? 'ÂME · AGENT ⇄' : 'ÂME · AGENT',
      selected,
      seed: seedOf(a.id),
    };
  }
  const t = w.task;
  return {
    title: t.title,
    subtitle: `tâche · ${t.model}`,
    status: t.status,
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    toolUses: t.toolUses,
    activity: t.log.at(-1)?.text ?? null,
    recent: t.log.map((x) => x.text.split('\n')[0]),
    badge: 'ÂME · TÂCHE',
    selected,
    seed: seedOf(t.id),
  };
}

function CameraRig({ positions }: { positions: Map<string, Vec3> }) {
  const selection = useStore((s) => s.selection);
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3; update: () => void; addEventListener: Function; removeEventListener: Function } | null };
  const fly = useRef<{ target: THREE.Vector3; pos: THREE.Vector3; follow?: { key: string; offset: THREE.Vector3 } } | null>(null);
  const key = selectionKey(selection);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => (fly.current = null); // l'utilisateur reprend la main : on arrête aussi de suivre
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useEffect(() => {
    if (!key || !controls) return;
    // les barques bougent : on vole vers leur position du moment
    const p = positions.get(key) ?? livePositions.get(key)?.toArray();
    if (!p) return;
    const target = new THREE.Vector3(...p);
    const boat = !positions.has(key);
    const dist = key === 'hub' ? 40 : key.startsWith('shell:') ? 13 : key.startsWith('session:') ? 18 : boat ? 16 : 20;
    // Hors hub, on arrive depuis l'extérieur : rien ne s'intercale et le temple reste en fond.
    const dir = key === 'hub' ? camera.position.clone().sub(controls.target) : target.clone();
    dir.setY(0).normalize();
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    const pos = target.clone().add(dir.multiplyScalar(dist));
    pos.y = target.y + dist * 0.5;
    // une barque bouge : la caméra la suit, en gardant le même angle de vue
    fly.current = { target, pos, follow: boat ? { key, offset: pos.clone().sub(target) } : undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, controls]);

  useFrame((_, dt) => {
    const f = fly.current;
    if (!f || !controls) return;
    const live = f.follow && livePositions.get(f.follow.key);
    if (live) {
      f.target.copy(live);
      f.pos.copy(live).add(f.follow!.offset);
    }
    const k = 1 - Math.exp(-dt * 3);
    controls.target.lerp(f.target, k);
    camera.position.lerp(f.pos, k);
    controls.update();
    if (!f.follow && camera.position.distanceTo(f.pos) < 0.05) fly.current = null;
  });
  return null;
}

/** Décale le centre de la vue vers l'espace laissé libre entre la liste (gauche) et le terminal (droite). */
function ViewOffset() {
  const terminalOpen = useStore((s) => s.terminalOpen);
  const inspecting = useStore((s) => !!s.selection && s.selection.kind !== 'hub');
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const left = 298;
    const right = terminalOpen ? Math.min(520, size.width * 0.4) + 28 : 0;
    const bottom = inspecting ? size.height * 0.46 : 0; // panneau de détail en bas
    cam.setViewOffset(size.width, size.height, (right - left) / 2, bottom / 2, size.width, size.height);
    cam.updateProjectionMatrix();
  }, [camera, size, terminalOpen, inspecting]);
  return null;
}

/** Fait avancer l'horloge commune des fantômes. */
function GhostClock() {
  useFrame(({ clock }) => {
    ghostTime.value = clock.elapsedTime;
  });
  return null;
}

export function World({ layout }: { layout: Layout }) {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const key = selectionKey(selection);

  const islets = [
    { pos: [0, 0, 0] as [number, number, number], r: HUB_TEMPLATE.radius * 1.12 },
    ...layout.workers.map((w) => ({ pos: w.pos, r: ISLAND_SLOTS[w.slot].template.radius * 1.2 })),
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
      {layout.workers.map((w) => {
        const slot = ISLAND_SLOTS[w.slot];
        const toHub = Math.atan2(-slot.pos[2], -slot.pos[0]);
        const angle = Math.atan2(slot.pos[2], slot.pos[0]);
        return (
          <Islet key={w.id} template={slot.template} position={slot.pos} clearAngle={toHub} onClick={() => select(sel(w.id))}>
            {/* l'esprit regarde vers le fleuve : on voit ses yeux en arrivant de l'extérieur */}
            <group position={[0, slot.template.top, 0]} rotation-y={-angle - Math.PI / 2}>
              <Office info={officeInfo(w.worker, key === w.id)} onClick={() => select(sel(w.id))} />
            </group>
          </Islet>
        );
      })}
      <Bridges bridges={layout.bridges} />

      {layout.sessions.map((s) => (
        <SessionSat key={s.session.id} session={s.session} pos={s.pos} selected={key === `session:${s.session.id}`} onClick={() => select({ kind: 'session', id: s.session.id })} />
      ))}

      {layout.shells.map((s) => (
        <ShellStele key={s.shell.id} shell={s.shell} pos={s.pos} selected={key === `shell:${s.shell.id}`} onClick={() => select({ kind: 'shell', id: s.shell.id })} />
      ))}

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxDistance={170} minDistance={6} maxPolarAngle={Math.PI * 0.47} />
      <CameraRig positions={layout.positions} />
      <ViewOffset />

      <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
        <Vignette offset={0.3} darkness={0.75} />
      </EffectComposer>
    </>
  );
}

function sel(workerId: string): Selection {
  const [kind, ...rest] = workerId.split(':');
  return { kind: kind as 'agent' | 'task', id: rest.join(':') };
}
