import { useEffect, useReducer } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { connect, useStore } from './store';
import { useLayout } from './scene/layout';
import { labelLayer } from './scene/labels';
import { World } from './scene/World';
import { Terminal } from './ui/Terminal';
import { TaskForm } from './ui/TaskForm';
import { Sidebar } from './ui/Sidebar';
import { Inspector } from './ui/Inspector';

export function App() {
  const layout = useLayout();
  const connected = useStore((s) => s.connected);
  const terminalOpen = useStore((s) => s.terminalOpen);
  const busy = useStore((s) => s.hub.busy);
  const snapshot = useStore((s) => s.snapshot);
  const tasks = useStore((s) => s.tasks);
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => connect(), []);
  // Rafraîchit les durées affichées.
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea')) return;
      const st = useStore.getState();
      if (e.key === 't' || e.key === 'T' || e.key === '²') {
        e.preventDefault();
        st.setTerminal(!st.terminalOpen);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        st.openTaskForm();
      } else if (e.key === 'Escape') st.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const running = (xs: { status: string }[]) => xs.filter((x) => x.status === 'running').length;
  const agentsRunning = running(snapshot.agents) + running(tasks);

  return (
    <div className="app">
      <div className="label-layer" ref={(el) => void (el && (labelLayer.current = el))} />
      <Canvas
        shadows
        camera={{ position: [-20, 40, 125], fov: 45, near: 0.3, far: 2000 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        onPointerMissed={() => useStore.getState().select(null)}
      >
        <World layout={layout} />
      </Canvas>

      <header className="topbar">
        <div className="logo">
          CLAUDE <span>·</span> STYX
        </div>
        <div className={`conn ${connected ? 'ok' : ''}`}>{connected ? 'le passeur veille' : 'le serveur s’est tu'}</div>
        <div className="stats">
          <span>
            <b>{agentsRunning}</b> agents
          </span>
          <span>
            <b>{running(snapshot.shells)}</b> shells
          </span>
          <span>
            <b>{layout.sessions.length}</b> sessions
          </span>
          {busy && <span className="busy">claude réfléchit</span>}
        </div>
        <div className="actions">
          <button className="primary" onClick={() => useStore.getState().openTaskForm()}>
            + Tâche rapide <kbd>N</kbd>
          </button>
          <button className={terminalOpen ? 'on' : ''} onClick={() => useStore.getState().setTerminal(!terminalOpen)}>
            Terminal <kbd>T</kbd>
          </button>
        </div>
      </header>

      <Sidebar layout={layout} />
      <Inspector />
      <Terminal />
      <TaskForm />
    </div>
  );
}
