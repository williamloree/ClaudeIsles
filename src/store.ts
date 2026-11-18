import { create } from 'zustand';
import { demoState } from './demo';
import { initialThemeId, loadTheme } from './themes';
import type { Theme } from './themes/types';
import type { HubMessage, HubState, Selection, Snapshot, Task } from './types';

/** `?demo` dans l'URL : données fictives, sans serveur (essais, captures d'écran). */
export const DEMO = new URLSearchParams(location.search).has('demo');

interface Store {
  connected: boolean;
  snapshot: Snapshot;
  hub: HubState;
  messages: HubMessage[];
  tasks: Task[];
  selection: Selection;
  terminalOpen: boolean;
  taskFormOpen: boolean;
  taskDraft: string;
  themeId: string;
  /** Thème chargé (null pendant le chargement). */
  theme: Theme | null;
  select: (s: Selection) => void;
  setTerminal: (open: boolean) => void;
  openTaskForm: (draft?: string) => void;
  closeTaskForm: () => void;
  setTheme: (id: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  connected: false,
  snapshot: { now: Date.now(), sessions: [], agents: [], shells: [], history: [] },
  hub: { busy: false, cwd: '', sessionId: null, model: null },
  messages: [],
  tasks: [],
  selection: null,
  terminalOpen: !DEMO,
  taskFormOpen: false,
  taskDraft: '',
  themeId: initialThemeId(),
  theme: null,
  select: (selection) => set({ selection }),
  setTerminal: (terminalOpen) => set({ terminalOpen }),
  openTaskForm: (taskDraft = '') => set({ taskFormOpen: true, taskDraft }),
  closeTaskForm: () => set({ taskFormOpen: false }),
  setTheme: (id) => {
    set({ themeId: id, selection: null });
    loadTheme(id).then((theme) => get().themeId === id && set({ theme }));
  },
}));

export function connect() {
  if (DEMO) {
    useStore.setState(demoState());
    return () => {};
  }
  const es = new EventSource('/api/events');
  es.onopen = () => useStore.setState({ connected: true });
  es.onerror = () => useStore.setState({ connected: false });
  es.onmessage = (e) => {
    const { type, data } = JSON.parse(e.data);
    switch (type) {
      case 'snapshot':
        useStore.setState({ snapshot: { history: [], ...data } });
        break;
      case 'hub':
        useStore.setState({ hub: data.state, messages: data.messages });
        break;
      case 'hubstate':
        useStore.setState({ hub: data });
        break;
      case 'hubmsg':
        useStore.setState((s) => ({ messages: [...s.messages, data].slice(-300) }));
        break;
      case 'tasks':
        useStore.setState({ tasks: data });
        break;
    }
  };
  return () => es.close();
}

export async function api<T = unknown>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json as T;
}
