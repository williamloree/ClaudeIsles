// Création rapide d'une tâche : un agent Claude part travailler sur sa propre île.
import { useEffect, useRef, useState } from 'react';
import { api, useStore } from '../store';

const PRESETS: { label: string; prompt: string }[] = [
  { label: 'Explorer', prompt: 'Explore ce dossier et résume en 10 lignes : à quoi il sert, sa structure, comment le lancer.' },
  { label: 'Revue git', prompt: 'Fais une revue des changements non commités (git diff) : bugs probables, oublis, simplifications. Ne modifie rien.' },
  { label: 'Chercher', prompt: 'Trouve où est géré : ' },
  { label: 'TODO', prompt: 'Liste les TODO, FIXME et code mort de ce dossier, classés par importance. Ne modifie rien.' },
  { label: 'Doc', prompt: 'Mets à jour le README pour qu’il corresponde au code actuel.' },
];

const MODELS = [
  { id: 'haiku', label: 'Haiku', hint: 'éclair' },
  { id: 'sonnet', label: 'Sonnet', hint: 'rapide' },
  { id: 'opus', label: 'Opus', hint: 'costaud' },
];

export function TaskForm() {
  const open = useStore((s) => s.taskFormOpen);
  const draft = useStore((s) => s.taskDraft);
  const close = useStore((s) => s.closeTaskForm);
  const hubCwd = useStore((s) => s.hub.cwd);
  const [prompt, setPrompt] = useState('');
  const [cwd, setCwd] = useState('');
  const [model, setModel] = useState('sonnet');
  const [cwds, setCwds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setPrompt(draft);
    setError('');
    setCwd((c) => c || hubCwd);
    fetch('/api/cwds')
      .then((r) => r.json())
      .then(setCwds)
      .catch(() => {});
    setTimeout(() => area.current?.focus(), 30);
  }, [open, draft, hubCwd]);

  if (!open) return null;

  async function launch() {
    if (!prompt.trim() || sending) return;
    setSending(true);
    try {
      await api('/api/tasks', { prompt, cwd, model });
      close();
      setPrompt('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-back" onMouseDown={close}>
      <div
        className="modal panel"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') close();
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) launch();
        }}
      >
        <h2>
          <span className="glitch">NOUVELLE TÂCHE</span>
        </h2>
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.label} className="chip" onClick={() => (setPrompt(p.prompt), area.current?.focus())}>
              {p.label}
            </button>
          ))}
        </div>
        <textarea ref={area} rows={5} value={prompt} placeholder="Que doit faire l'agent ?" onChange={(e) => setPrompt(e.target.value)} />
        <label>
          Dossier
          <input list="cwds" value={cwd} onChange={(e) => setCwd(e.target.value)} />
          <datalist id="cwds">
            {cwds.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <div className="models">
          {MODELS.map((m) => (
            <button key={m.id} className={`model ${model === m.id ? 'on' : ''}`} onClick={() => setModel(m.id)}>
              {m.label} <small>{m.hint}</small>
            </button>
          ))}
        </div>
        {error && <div className="error">{error}</div>}
        <footer>
          <span className="hint">acceptEdits · Ctrl+Entrée</span>
          <button className="ghost" onClick={close}>
            Annuler
          </button>
          <button className="primary" disabled={!prompt.trim() || sending} onClick={launch}>
            {sending ? 'Lancement…' : 'Lancer ⚡'}
          </button>
        </footer>
      </div>
    </div>
  );
}
