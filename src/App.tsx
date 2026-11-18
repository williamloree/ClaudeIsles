import { useEffect, useReducer } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { connect, useStore } from './store';
import { useLayout } from './scene/layout';
import { labelLayer } from './scene/labels';
import { World } from './scene/World';
import { THEMES } from './themes';
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
  const themeId = useStore((s) => s.themeId);
  const theme = useStore((s) => s.theme);
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => connect(), []);
  useEffect(() => useStore.getState().setTheme(useStore.getState().themeId), []);
  // Rafraîchit les durées affichées.
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Couleurs de l'interface propres au thème.
  useEffect(() => {
    const vars = Object.entries(theme?.cssVars ?? {});
    const root = document.documentElement;
    vars.forEach(([k, v]) => root.style.setProperty(k, v));
    return () => vars.forEach(([k]) => root.style.removeProperty(k));
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select')) return;
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
  const words = theme?.words;

  return (
    <div className="app">
      <div className="label-layer" ref={(el) => void (el && (labelLayer.current = el))} />
      {theme && (
        // une nouvelle scène par thème : caméra, exposition et ressources repartent de zéro
        <Canvas
          key={theme.id}
          shadows
          camera={{ position: theme.camera ?? [-20, 40, 125], fov: 45, near: 0.3, far: 2000 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: theme.exposure ?? 1.1 }}
          onPointerMissed={() => useStore.getState().select(null)}
        >
          <World layout={layout} theme={theme} />
        </Canvas>
      )}

      <header className="topbar">
        <div className="logo">
          CLAUDE <span>·</span> {words?.title ?? ''}
        </div>
        <div className={`conn ${connected ? 'ok' : ''}`}>{connected ? words?.connected : words?.disconnected}</div>
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
          <select className="theme-select" value={themeId} onChange={(e) => useStore.getState().setTheme(e.target.value)} title="Thème">
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
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
