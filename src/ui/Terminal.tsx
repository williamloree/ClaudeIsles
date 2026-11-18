// Terminal du hub : discussion directe avec Claude (claude -p, session reprise d'un message à l'autre).
import { useEffect, useRef, useState } from 'react';
import { api, useStore } from '../store';

const HELP = `Commandes :
  /tache <consigne>   lance une tâche rapide (un agent sur sa propre île)
  /cd <dossier>       change le dossier de travail (nouvelle conversation)
  /model haiku|sonnet|opus|defaut
  /new                nouvelle conversation
  /stop               interrompt la réponse en cours
  /clear              vide l'écran
Entrée : envoyer · Maj+Entrée : retour à la ligne · ↑ : message précédent`;

export function Terminal() {
  const open = useStore((s) => s.terminalOpen);
  const setTerminal = useStore((s) => s.setTerminal);
  const hub = useStore((s) => s.hub);
  const messages = useStore((s) => s.messages);
  const openTaskForm = useStore((s) => s.openTaskForm);
  const [text, setText] = useState('');
  const [local, setLocal] = useState<{ id: string; role: string; text: string }[]>([]);
  const [clearedAt, setClearedAt] = useState(0);
  const history = useRef<string[]>([]);
  const histPos = useRef(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const shown = [...messages.filter((m) => m.ts > clearedAt), ...local];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [shown.length, open]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const echo = (role: string, t: string) => setLocal((l) => [...l, { id: Math.random().toString(36), role, text: t }]);

  async function submit() {
    const raw = text.trim();
    if (!raw) return;
    history.current.unshift(raw);
    histPos.current = -1;
    setText('');
    const [cmd, ...rest] = raw.split(' ');
    const arg = rest.join(' ').trim();
    try {
      switch (cmd.toLowerCase()) {
        case '/aide':
        case '/help':
          return echo('system', HELP);
        case '/clear':
          setLocal([]);
          return setClearedAt(Date.now());
        case '/stop':
          return void (await api('/api/hub/stop'));
        case '/new':
          setLocal([]);
          return void (await api('/api/hub/reset'));
        case '/cd':
          await api('/api/hub/config', { cwd: arg });
          return echo('system', `Dossier : ${arg} (nouvelle conversation)`);
        case '/model':
          await api('/api/hub/config', { model: arg === 'defaut' ? null : arg });
          return echo('system', `Modèle : ${arg}`);
        case '/tache':
        case '/task':
          if (!arg) return openTaskForm();
          await api('/api/tasks', { prompt: arg, cwd: hub.cwd });
          return echo('system', `Tâche lancée : ${arg}`);
        default:
          if (raw.startsWith('/') && !raw.includes(' ') && raw.length < 20) return echo('error', `Commande inconnue. /aide pour la liste.`);
          await api('/api/hub/send', { text: raw });
      }
    } catch (e) {
      echo('error', (e as Error).message);
    }
  }

  if (!open) return null;
  return (
    <section className="terminal panel">
      <header className="term-head">
        <span className="term-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="term-title">
          claude@hub:<b>{hub.cwd}</b>
        </span>
        <span className="term-model">{hub.model || 'modèle par défaut'}</span>
        <button className="ghost" title="Nouvelle conversation" onClick={() => api('/api/hub/reset').catch((e) => echo('error', e.message))}>
          ⟲
        </button>
        <button className="ghost" title="Fermer (T)" onClick={() => setTerminal(false)}>
          ✕
        </button>
      </header>
      <div className="term-body" ref={scroller}>
        {shown.length === 0 && (
          <div className="msg system">
            {`┌─ HUB CLAUDE ─────────────────────────
│ Parle à Claude ici. Il travaille dans le dossier ci-dessus,
│ en mode acceptEdits (modifie des fichiers, pas de commande non autorisée).
└─ /aide pour les commandes`}
          </div>
        )}
        {shown.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.role === 'user' && <span className="prompt">❯ </span>}
            {m.role === 'tool' && <span className="prompt">⚙ </span>}
            {m.text}
          </div>
        ))}
        {hub.busy && (
          <div className="msg thinking">
            <span className="spinner" /> Claude travaille… <button className="link" onClick={() => api('/api/hub/stop')}>stop</button>
          </div>
        )}
      </div>
      <footer className="term-input">
        <span className="prompt">❯</span>
        <textarea
          ref={input}
          rows={Math.min(6, text.split('\n').length)}
          value={text}
          placeholder={hub.busy ? 'Claude répond… (tu peux préparer ton message)' : 'Écris à Claude, ou /aide'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!hub.busy || text.trim().startsWith('/')) submit();
            } else if (e.key === 'ArrowUp' && !text.includes('\n') && history.current.length) {
              e.preventDefault();
              histPos.current = Math.min(histPos.current + 1, history.current.length - 1);
              setText(history.current[histPos.current]);
            } else if (e.key === 'ArrowDown' && histPos.current >= 0) {
              e.preventDefault();
              histPos.current--;
              setText(histPos.current >= 0 ? history.current[histPos.current] : '');
            } else if (e.key === 'Escape') setTerminal(false);
          }}
        />
      </footer>
    </section>
  );
}
