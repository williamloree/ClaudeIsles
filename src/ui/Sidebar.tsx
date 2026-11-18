// Liste de tout ce qui vit dans le monde ; un clic y amène la caméra.
import { useStore } from '../store';
import { STATUS_COLOR, ago, cut, duration } from '../format';
import type { Layout } from '../scene/layout';
import { selectionKey } from '../scene/World';

export function Sidebar({ layout }: { layout: Layout }) {
  const select = useStore((s) => s.select);
  const selection = useStore((s) => s.selection);
  const tasks = useStore((s) => s.tasks);
  const snapshot = useStore((s) => s.snapshot);
  const key = selectionKey(selection);

  const Item = ({ k, color, title, sub, onClick }: { k: string; color: string; title: string; sub: string; onClick: () => void }) => (
    <button className={`item ${key === k ? 'on' : ''}`} onClick={onClick}>
      <span className="dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <span className="item-text">
        <span className="item-title">{title}</span>
        <span className="item-sub">{sub}</span>
      </span>
    </button>
  );

  const agents = [...snapshot.agents].sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running') || b.startedAt - a.startedAt);
  const shells = [...snapshot.shells].sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running') || b.startedAt - a.startedAt);
  const project = (sessionId: string) => snapshot.sessions.find((s) => s.id === sessionId)?.project ?? '';

  return (
    <aside className="sidebar panel">
      <h3>Sessions</h3>
      {layout.sessions.length === 0 && <p className="empty">Aucune session active</p>}
      {layout.sessions.map(({ session: s }) => (
        <Item key={s.id} k={`session:${s.id}`} color={s.active ? STATUS_COLOR.running : STATUS_COLOR.stopped} title={cut(s.title || s.lastPrompt || s.project, 34)} sub={s.project} onClick={() => select({ kind: 'session', id: s.id })} />
      ))}

      <h3>Agents</h3>
      {agents.length === 0 && <p className="empty">Aucun agent</p>}
      {agents.map((a) => (
        <Item key={a.id} k={`agent:${a.id}`} color={STATUS_COLOR[a.status]} title={cut(a.description, 34)} sub={`${a.agentType} · ${project(a.sessionId)} · ${duration(a.startedAt, a.endedAt ?? undefined)}`} onClick={() => select({ kind: 'agent', id: a.id })} />
      ))}

      <h3>Shells</h3>
      {shells.length === 0 && <p className="empty">Aucun shell en arrière-plan</p>}
      {shells.map((s) => (
        <Item key={s.id} k={`shell:${s.id}`} color={STATUS_COLOR[s.status]} title={cut(s.description || s.command, 34)} sub={cut(s.command, 40)} onClick={() => select({ kind: 'shell', id: s.id })} />
      ))}

      <h3>Tâches</h3>
      {tasks.length === 0 && <p className="empty">Aucune tâche (N pour en créer une)</p>}
      {tasks.map((t) => (
        <Item key={t.id} k={`task:${t.id}`} color={STATUS_COLOR[t.status]} title={cut(t.title, 34)} sub={`${t.model} · ${duration(t.startedAt, t.endedAt ?? undefined)}`} onClick={() => select({ kind: 'task', id: t.id })} />
      ))}
      {layout.overflow > 0 && <p className="empty">+{layout.overflow} sans îlot libre</p>}

      <h3>Barques</h3>
      {snapshot.history.length === 0 && <p className="empty">Aucune âme sur le fleuve</p>}
      {snapshot.history.map((a) => (
        <Item key={a.id} k={`agent:${a.id}`} color={STATUS_COLOR[a.status]} title={cut(a.description, 34)} sub={`${a.agentType} · ${project(a.sessionId) || 'session close'}${a.endedAt ? ` · ${ago(a.endedAt)}` : ''}`} onClick={() => select({ kind: 'agent', id: a.id })} />
      ))}
    </aside>
  );
}
