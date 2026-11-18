// Partie commune du monde : caméra (vol vers la sélection, suivi des barques), décalage de la vue
// et contrôles. Le visuel vient du thème choisi.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import type { Theme } from '../themes/types';
import type { Selection } from '../types';
import { livePositions } from './boats';
import { workerInfo } from './info';
import { selectKey } from './labels';
import type { Layout } from './layout';
import type { Vec3 } from './slots';

export const selectionKey = (s: Selection) => (!s ? null : s.kind === 'hub' ? 'hub' : `${s.kind}:${s.id}`);

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
    // Hors hub, on arrive depuis l'extérieur : rien ne s'intercale et le hub reste en fond.
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

export function World({ layout, theme }: { layout: Layout; theme: Theme }) {
  const selection = useStore((s) => s.selection);
  const key = selectionKey(selection);
  const workers = layout.workers.map((w) => workerInfo(w, theme.words, key === w.id, () => selectKey(w.id)));
  const { Scene } = theme;

  return (
    <>
      <Scene layout={layout} workers={workers} selectedKey={key} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxDistance={170} minDistance={6} maxPolarAngle={Math.PI * 0.47} />
      <CameraRig positions={layout.positions} />
      <ViewOffset />
    </>
  );
}
