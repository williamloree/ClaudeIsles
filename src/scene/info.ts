// Ce qu'on affiche d'un agent ou d'une tâche sur son îlot, quel que soit le thème.
import { STATUS_COLOR } from '../format';
import type { ThemeWords } from '../themes/types';
import type { Status, Worker } from '../types';
import type { Vec3 } from './slots';

export interface WorkerInfo {
  /** `agent:<id>` ou `task:<id>` */
  id: string;
  slot: number;
  pos: Vec3;
  title: string;
  subtitle: string;
  status: Status;
  /** Couleur du statut (bleu en cours, or terminé, rouge échec…). */
  color: string;
  startedAt: number;
  endedAt: number | null;
  toolUses: number;
  /** Dernière action, et les précédentes (de la plus ancienne à la plus récente). */
  activity: string | null;
  recent: string[];
  badge: string;
  selected: boolean;
  /** Graine stable, pour varier les décors d'un îlot à l'autre. */
  seed: number;
  onClick: () => void;
}

const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7);

export function workerInfo(
  w: { worker: Worker; id: string; slot: number; pos: Vec3 },
  words: ThemeWords,
  selected: boolean,
  onClick: () => void,
): WorkerInfo {
  const base = { id: w.id, slot: w.slot, pos: w.pos, selected, onClick };
  if (w.worker.kind === 'agent') {
    const a = w.worker.agent;
    return {
      ...base,
      title: a.description,
      subtitle: a.agentType + (a.model ? ` · ${a.model.replace(/^claude-/, '')}` : ''),
      status: a.status,
      color: STATUS_COLOR[a.status],
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      toolUses: a.toolUses,
      activity: a.activity.at(-1)?.text ?? null,
      recent: a.activity.map((x) => x.text),
      badge: `${words.agent} · AGENT${a.background ? ' ⇄' : ''}`,
      seed: seedOf(a.id),
    };
  }
  const t = w.worker.task;
  return {
    ...base,
    title: t.title,
    subtitle: `tâche · ${t.model}`,
    status: t.status,
    color: STATUS_COLOR[t.status],
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    toolUses: t.toolUses,
    activity: t.log.at(-1)?.text ?? null,
    recent: t.log.map((x) => x.text.split('\n')[0]),
    badge: `${words.task} · TÂCHE`,
    seed: seedOf(t.id),
  };
}
