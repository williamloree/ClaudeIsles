// Répartit sessions, agents, tâches et shells sur les emplacements prédéfinis, et liste les barques.
// Les affectations sont stables : un élément garde sa place tant qu'il est affiché.
import { useMemo } from 'react';
import { useStore } from '../store';
import type { Session, Shell, Status, Worker } from '../types';
import type { Boat } from './River';
import { HUB_ISLET_R, HUB_TEMPLATE, ISLAND_SLOTS, SESSION_SLOTS, STELE_SLOTS, type Vec3 } from './islands';

const TASK_VISIBLE_MS = 45 * 60e3;
const MIN_BOATS = 8; // le fleuve n'est jamais vide : quelques âmes oubliées dérivent toujours
const MAX_BOATS = 20;

export interface Bridge {
  id: string;
  from: Vec3;
  to: Vec3;
  status: Status;
}

export interface Layout {
  sessions: { session: Session; slot: number; pos: Vec3 }[];
  workers: { worker: Worker; id: string; slot: number; pos: Vec3 }[];
  shells: { shell: Shell; slot: number; pos: Vec3 }[];
  boats: Boat[];
  overflow: number;
  bridges: Bridge[];
  positions: Map<string, Vec3>;
}

export const HUB_POS: Vec3 = [0, HUB_TEMPLATE.top + 4, 0];

function assign(memo: Map<string, number>, ids: string[], size: number, prefer: (id: string) => number[]) {
  const live = new Set(ids);
  for (const id of [...memo.keys()]) if (!live.has(id)) memo.delete(id);
  const used = new Set(memo.values());
  for (const id of ids) {
    if (memo.has(id)) continue;
    const slot = prefer(id).find((s) => !used.has(s)) ?? [...Array(size).keys()].find((s) => !used.has(s));
    if (slot === undefined) continue;
    memo.set(id, slot);
    used.add(slot);
  }
  return memo;
}

const angleOf = (p: Vec3) => Math.atan2(p[2], p[0]);
const angDist = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const byAngle = (slots: Vec3[], angle: number) =>
  slots.map((p, i) => [i, angDist(angleOf(p), angle)] as const).sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([i]) => i);

/** Extrémités du pont d'un emplacement, calculées une fois (mêmes tableaux : pas de reconstruction). */
const bridgeEnds = ISLAND_SLOTS.map(({ pos, template }): [Vec3, Vec3] => {
  const len = Math.hypot(pos[0], pos[2]);
  const dx = pos[0] / len;
  const dz = pos[2] / len;
  const isleR = template.radius * 0.84;
  return [
    [dx * HUB_ISLET_R, HUB_TEMPLATE.top + 0.1, dz * HUB_ISLET_R],
    [pos[0] - dx * isleR, template.top + 0.1, pos[2] - dz * isleR],
  ];
});

const sessionMemo = new Map<string, number>();
const workerMemo = new Map<string, number>();
const shellMemo = new Map<string, number>();

export function useLayout(): Layout {
  const snapshot = useStore((s) => s.snapshot);
  const tasks = useStore((s) => s.tasks);

  return useMemo(() => {
    const now = Date.now();

    // Sessions Claude Code (celles du hub et des tâches sont déjà représentées autrement).
    const sats = snapshot.sessions.filter((s) => s.origin === 'claude-code').sort((a, b) => b.lastActivity - a.lastActivity);
    // Derrière le temple d'abord (-z) : vues de face, les lanternes ne cachent rien.
    assign(sessionMemo, sats.map((s) => s.id), SESSION_SLOTS.length, () => [5, 7, 4, 6, 3, 0, 2, 1]);
    const sessions = sats.filter((s) => sessionMemo.has(s.id)).map((session) => {
      const slot = sessionMemo.get(session.id)!;
      return { session, slot, pos: SESSION_SLOTS[slot] };
    });
    const sessionPos = new Map(sessions.map((s) => [s.session.id, s.pos]));

    const taskVisible = (t: (typeof tasks)[number]) => t.status === 'running' || now - (t.endedAt || t.startedAt) < TASK_VISIBLE_MS;
    const visibleTasks = tasks.filter(taskVisible);
    const workerList: { id: string; worker: Worker; prefer: number }[] = [
      ...visibleTasks.map((task) => ({ id: `task:${task.id}`, worker: { kind: 'task', task } as Worker, prefer: Math.PI / 2 })),
      ...snapshot.agents.map((agent) => ({
        id: `agent:${agent.id}`,
        worker: { kind: 'agent', agent } as Worker,
        prefer: angleOf(sessionPos.get(agent.sessionId) || [0, 0, 1]),
      })),
    ];
    const prefer = new Map(workerList.map((w) => [w.id, w.prefer]));
    // L'anneau intérieur se remplit d'abord : ponts plus courts.
    const innerFirst = (angle: number) => {
      const order = byAngle(ISLAND_SLOTS.map((s) => s.pos), angle);
      return [...order.filter((i) => i < 8), ...order.filter((i) => i >= 8)];
    };
    assign(workerMemo, workerList.map((w) => w.id), ISLAND_SLOTS.length, (id) => innerFirst(prefer.get(id) ?? 0));
    const workers = workerList
      .filter((w) => workerMemo.has(w.id))
      .map((w) => {
        const slot = workerMemo.get(w.id)!;
        return { worker: w.worker, id: w.id, slot, pos: ISLAND_SLOTS[slot].pos };
      });

    assign(shellMemo, snapshot.shells.map((s) => s.id), STELE_SLOTS.length, (id) => {
      const sh = snapshot.shells.find((x) => x.id === id)!;
      return byAngle(STELE_SLOTS, angleOf(sessionPos.get(sh.sessionId) || [0, 0, 1]));
    });
    const shells = snapshot.shells
      .filter((s) => shellMemo.has(s.id))
      .map((shell) => {
        const slot = shellMemo.get(shell.id)!;
        return { shell, slot, pos: STELE_SLOTS[slot] };
      });

    // Barques : anciens agents et anciennes tâches, puis des âmes oubliées pour que le fleuve vive.
    const boats: Boat[] = [
      ...snapshot.history.map((a) => ({ key: `agent:${a.id}`, title: a.description, status: a.status, endedAt: a.endedAt, subtitle: `${a.agentType} · ${a.toolUses} outils` })),
      ...tasks.filter((t) => !taskVisible(t)).map((t) => ({ key: `task:${t.id}`, title: t.title, status: t.status, endedAt: t.endedAt, subtitle: `tâche · ${t.model}` })),
    ]
      .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))
      .slice(0, MAX_BOATS);
    for (let i = 0; boats.length < MIN_BOATS; i++) boats.push({ key: `ambient:${i}`, title: 'Âme oubliée', status: 'stale', endedAt: null, subtitle: 'une âme sans nom dérive sur le Styx' });

    const positions = new Map<string, Vec3>([['hub', HUB_POS]]);
    for (const s of sessions) positions.set(`session:${s.session.id}`, s.pos);
    for (const w of workers) positions.set(w.id, [w.pos[0], ISLAND_SLOTS[w.slot].template.top + 1.5, w.pos[2]]);
    for (const s of shells) positions.set(`shell:${s.shell.id}`, [s.pos[0], s.pos[1] + 2, s.pos[2]]);

    const bridges: Bridge[] = workers.map((w) => {
      const [from, to] = bridgeEnds[w.slot];
      return { id: `bridge-${w.id}`, from, to, status: w.worker.kind === 'task' ? w.worker.task.status : w.worker.agent.status };
    });

    return { sessions, workers, shells, boats, bridges, positions, overflow: workerList.length - workers.length };
  }, [snapshot, tasks]);
}
