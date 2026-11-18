import { create } from 'zustand';
import type { HubMessage, HubState, Selection, Snapshot, Task } from './types';

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
  select: (s: Selection) => void;
  setTerminal: (open: boolean) => void;
  openTaskForm: (draft?: string) => void;
  closeTaskForm: () => void;
}

export const useStore = create<Store>((set) => ({
  connected: false,
  snapshot: { now: Date.now(), sessions: [], agents: [], shells: [], history: [] },
  hub: { busy: false, cwd: '', sessionId: null, model: null },
  messages: [],
  tasks: [],
  selection: null,
  terminalOpen: true,
  taskFormOpen: false,
  taskDraft: '',
  select: (selection) => set({ selection }),
  setTerminal: (terminalOpen) => set({ terminalOpen }),
  openTaskForm: (taskDraft = '') => set({ taskFormOpen: true, taskDraft }),
  closeTaskForm: () => set({ taskFormOpen: false }),
}));

export function connect() {
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
