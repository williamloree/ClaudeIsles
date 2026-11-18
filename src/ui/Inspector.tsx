// Détail de l'élément sélectionné.
import { useEffect, useRef } from 'react';
import { api, useStore } from '../store';
import { STATUS_COLOR, STATUS_LABEL, ago, duration } from '../format';
import type { Status } from '../types';

function Head({ kind, title, status, since, until }: { kind: string; title: string; status?: Status; since?: number; until?: number | null }) {
  const select = useStore((s) => s.select);
  return (
    <header className="insp-head">
      <span className="insp-kind">{kind}</span>
      {status && (
        <span className="insp-status" style={{ color: STATUS_COLOR[status] }}>
          ● {STATUS_LABEL[status]}
          {since ? ` · ${duration(since, until ?? undefined)}` : ''}
        </span>
      )}
      <button className="ghost" onClick={() => select(null)}>
        ✕
      </button>
      <h2>{title}</h2>
    </header>
  );
}

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const snapshot = useStore((s) => s.snapshot);
  const tasks = useStore((s) => s.tasks);
  const pre = useRef<HTMLPreElement>(null);
  const shell = selection?.kind === 'shell' ? snapshot.shells.find((x) => x.id === selection.id) : undefined;

  useEffect(() => {
    pre.current?.scrollTo({ top: pre.current.scrollHeight });
  }, [shell?.tail]);

  if (!selection || selection.kind === 'hub') return null;
  const sessionOf = (id: string) => snapshot.sessions.find((s) => s.id === id);

  if (selection.kind === 'agent') {
    const live = snapshot.agents.find((x) => x.id === selection.id);
    const a = live ?? snapshot.history.find((x) => x.id === selection.id);
    if (!a) return null;
    const s = sessionOf(a.sessionId);
    return (
      <section className="inspector panel">
        <Head kind={`${live ? 'ÂME' : 'ÂME EN BARQUE'} · ${a.agentType}`} title={a.description} status={a.status} since={a.startedAt} until={a.endedAt} />
        <dl>
          <dt>Session</dt>
          <dd>{s ? `${s.project} — ${s.title || ''}` : a.sessionId}</dd>
          <dt>Modèle</dt>
          <dd>{a.model || 'hérité'}</dd>
          <dt>Outils</dt>
          <dd>
            {a.toolUses} {a.background ? '· arrière-plan' : ''}
          </dd>
        </dl>
        <details>
          <summary>Consigne</summary>
          <p className="prewrap">{a.prompt}</p>
        </details>
        <h4>Activité</h4>
        <ol className="feed">
          {a.activity.length === 0 && <li className="empty">pas encore d’activité lue</li>}
          {[...a.activity].reverse().map((x, i) => (
            <li key={i}>
              <time>{new Date(x.t).toLocaleTimeString('fr-FR')}</time> {x.text}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (selection.kind === 'shell') {
    if (!shell) return null;
    const s = sessionOf(shell.sessionId);
    return (
      <section className="inspector panel wide">
        <Head kind={`SHELL · ${shell.shell}`} title={shell.description || 'Commande en arrière-plan'} status={shell.status} since={shell.startedAt} until={shell.endedAt} />
        <code className="cmd">{shell.command}</code>
        <p className="muted">
          {s?.project} · id {shell.taskId || '…'} · {(shell.size / 1024).toFixed(1)} Ko de sortie
        </p>
        <pre className="out" ref={pre}>
          {shell.tail || '…en attente de sortie'}
        </pre>
      </section>
    );
  }

  if (selection.kind === 'task') {
    const t = tasks.find((x) => x.id === selection.id);
    if (!t) return null;
    return (
      <section className="inspector panel wide">
        <Head kind={`TÂCHE · ${t.model}`} title={t.title} status={t.status} since={t.startedAt} until={t.endedAt} />
        <p className="muted">
          {t.cwd} · {t.toolUses} outils{t.cost != null ? ` · ${t.cost.toFixed(3)} $` : ''}
        </p>
        <details>
          <summary>Consigne</summary>
          <p className="prewrap">{t.prompt}</p>
        </details>
        <ol className="feed">
          {t.log.map((x, i) => (
            <li key={i} className={x.kind}>
              {x.kind === 'tool' ? '⚙ ' : x.kind === 'error' ? '✖ ' : ''}
              {x.text}
            </li>
          ))}
        </ol>
        {t.result && (
          <>
            <h4>Résultat</h4>
            <p className="prewrap result">{t.result}</p>
          </>
        )}
        <footer className="row">
          {t.status === 'running' ? (
            <button className="danger" onClick={() => api(`/api/tasks/${t.id}/stop`)}>
              Arrêter
            </button>
          ) : (
            <button className="ghost" onClick={() => api(`/api/tasks/${t.id}/dismiss`).then(() => useStore.getState().select(null))}>
              Retirer
            </button>
          )}
          <button className="ghost" onClick={() => useStore.getState().openTaskForm(t.prompt)}>
            Relancer…
          </button>
        </footer>
      </section>
    );
  }

  const s = sessionOf(selection.id);
  if (!s) return null;
  const agents = snapshot.agents.filter((a) => a.sessionId === s.id);
  const shells = snapshot.shells.filter((x) => x.sessionId === s.id);
  return (
    <section className="inspector panel">
      <Head kind="SESSION CLAUDE CODE" title={s.title || s.project} />
      <dl>
        <dt>Dossier</dt>
        <dd>{s.cwd}</dd>
        <dt>Activité</dt>
        <dd>
          {ago(s.lastActivity)} · {s.toolUses} outils
        </dd>
        <dt>En cours</dt>
        <dd>
          {agents.filter((a) => a.status === 'running').length} agent(s), {shells.filter((x) => x.status === 'running').length} shell(s)
        </dd>
      </dl>
      {s.lastPrompt && (
        <>
          <h4>Dernière demande</h4>
          <p className="prewrap">{s.lastPrompt}</p>
        </>
      )}
      {s.lastTool && (
        <>
          <h4>Dernier outil</h4>
          <p className="mono">{s.lastTool}</p>
        </>
      )}
      {s.lastText && (
        <>
          <h4>Dernier message</h4>
          <p className="prewrap">{s.lastText}</p>
        </>
      )}
    </section>
  );
}
