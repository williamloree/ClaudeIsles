import type { Status } from './types';

// Palette des Enfers : bronze, marbre, feux colorés selon le statut.
export const COLORS = {
  claude: '#ff7a3d',
  soul: '#6fd6ff',
  gold: '#ffc94d',
  blood: '#ff4a3d',
  ember: '#ff9a4d',
  ash: '#8a9aa0',
  bronze: '#a8844f',
  parchment: '#f1e4c8',
  lantern: '#7dffb0',
};

export const STATUS_COLOR: Record<Status, string> = {
  running: COLORS.soul,
  completed: COLORS.gold,
  failed: COLORS.blood,
  killed: COLORS.ember,
  stopped: COLORS.ash,
  stale: COLORS.ash,
};

export const STATUS_LABEL: Record<Status, string> = {
  running: 'en cours',
  completed: 'terminé',
  failed: 'échec',
  killed: 'arrêté',
  stopped: 'stoppé',
  stale: 'perdu',
};

export function duration(from: number, to: number = Date.now()) {
  const s = Math.max(0, Math.round((to - from) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export function ago(ts: number) {
  return `il y a ${duration(ts)}`;
}

export const cut = (s: string | null | undefined, n: number) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
