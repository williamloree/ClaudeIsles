export type Status = 'running' | 'completed' | 'failed' | 'killed' | 'stopped' | 'stale';

export interface Session {
  id: string;
  cwd: string | null;
  project: string;
  title: string | null;
  lastPrompt: string | null;
  lastTool: string | null;
  lastText: string | null;
  toolUses: number;
  lastActivity: number;
  active: boolean;
  origin: 'claude-code' | 'hub' | 'task';
  ref: string | null;
}

export interface Activity {
  t: number;
  text: string;
}

export interface Agent {
  kind: 'agent';
  id: string;
  sessionId: string;
  agentId: string | null;
  description: string;
  agentType: string;
  prompt: string;
  model: string | null;
  background: boolean;
  status: Status;
  startedAt: number;
  endedAt: number | null;
  toolUses: number;
  activity: Activity[];
}

export interface Shell {
  kind: 'shell';
  id: string;
  sessionId: string;
  taskId: string | null;
  shell: string;
  command: string;
  description: string;
  status: Status;
  startedAt: number;
  endedAt: number | null;
  tail: string;
  size: number;
}

export interface Task {
  id: string;
  title: string;
  prompt: string;
  cwd: string;
  model: string;
  status: Status;
  startedAt: number;
  endedAt: number | null;
  sessionId: string | null;
  toolUses: number;
  cost: number | null;
  result: string | null;
  log: { t: number; kind: 'text' | 'tool' | 'error'; text: string }[];
}

export interface Snapshot {
  now: number;
  sessions: Session[];
  agents: Agent[];
  shells: Shell[];
  /** Anciens agents (plus sur une île) : âmes en barque sur le fleuve. */
  history: Agent[];
}

export interface HubState {
  busy: boolean;
  cwd: string;
  sessionId: string | null;
  model: string | null;
}

export interface HubMessage {
  id: string;
  role: 'user' | 'claude' | 'tool' | 'system' | 'error' | 'meta';
  text: string;
  ts: number;
}

/** Ce qui occupe une île : un agent d'une session Claude Code, ou une tâche lancée depuis l'app. */
export type Worker = { kind: 'agent'; agent: Agent } | { kind: 'task'; task: Task };

export type Selection = { kind: 'agent' | 'task' | 'shell' | 'session' | 'hub'; id: string } | null;
