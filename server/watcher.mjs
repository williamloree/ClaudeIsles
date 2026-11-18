// Lit en continu les journaux de Claude Code (~/.claude/projects/<projet>/<session>.jsonl)
// pour reconstituer, pour toutes les sessions de la machine : les agents lancés,
// les shells en arrière-plan et leur sortie (%TEMP%\claude\<projet>\<session>\tasks\<id>.output).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const TASKS_TMP = path.join(os.tmpdir(), 'claude');

const LOOKBACK_MS = 24 * 3600e3; // sessions relues au démarrage (alimente aussi les barques)
const SESSION_ACTIVE_MS = 15 * 60e3; // session considérée active
const KEEP_DONE_MS = 45 * 60e3; // durée d'affichage d'un agent ou shell terminé
const STALE_MS = 90 * 60e3; // plus aucun signe de vie : statut "perdu"
const TAIL_BYTES = 8000;
const HISTORY_MAX = 24; // barques d'anciens agents sur le fleuve

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

export function formatTool(name, input = {}) {
  const base = (p) => (p ? String(p).split(/[\\/]/).slice(-2).join('/') : '');
  const cut = (s, n = 90) => {
    const t = String(s ?? '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  };
  switch (name) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return `${name} ${base(input.file_path || input.notebook_path)}`;
    case 'Grep':
      return `Grep ${cut(input.pattern, 60)}`;
    case 'Glob':
      return `Glob ${cut(input.pattern, 60)}`;
    case 'Bash':
    case 'PowerShell':
      return `${name === 'Bash' ? '$' : 'PS>'} ${cut(input.command)}`;
    case 'WebFetch':
      return `WebFetch ${cut(input.url, 70)}`;
    case 'WebSearch':
      return `WebSearch ${cut(input.query, 70)}`;
    case 'Agent':
    case 'Task':
      return `Agent « ${cut(input.description, 60)} »`;
    default:
      return name.startsWith('mcp__') ? name.split('__').slice(1).join(' › ') : name;
  }
}

/** Lecteur incrémental d'un fichier JSONL : ne renvoie que les lignes complètes ajoutées. */
function readNewLines(file, cursor) {
  let st;
  try {
    st = fs.statSync(file);
  } catch {
    return [];
  }
  if (st.size < cursor.offset) {
    cursor.offset = 0;
    cursor.rest = Buffer.alloc(0);
  }
  if (st.size === cursor.offset) return [];
  const len = st.size - cursor.offset;
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buf, 0, len, cursor.offset);
  } finally {
    fs.closeSync(fd);
  }
  cursor.offset = st.size;
  const all = cursor.rest.length ? Buffer.concat([cursor.rest, buf]) : buf;
  const last = all.lastIndexOf(0x0a);
  if (last < 0) {
    cursor.rest = all;
    return [];
  }
  cursor.rest = all.subarray(last + 1);
  const out = [];
  for (const line of all.subarray(0, last).toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* ligne tronquée ou corrompue : ignorée */
    }
  }
  return out;
}

function tailFile(file, bytes = TAIL_BYTES) {
  const st = fs.statSync(file);
  const len = Math.min(bytes, st.size);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buf, 0, len, st.size - len);
  } finally {
    fs.closeSync(fd);
  }
  let text = buf.toString('utf8').replace(ANSI, '').replace(/\r(?!\n)/g, '\n');
  if (st.size > len) text = text.slice(text.indexOf('\n') + 1);
  return { text, size: st.size, mtime: st.mtimeMs };
}

const tsOf = (o) => (o.timestamp ? Date.parse(o.timestamp) : Date.now());
const tag = (s, name) => s.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim();

function mapStatus(s) {
  if (!s) return 'completed';
  if (/complet|success/i.test(s)) return 'completed';
  if (/kill|stop|cancel/i.test(s)) return 'killed';
  if (/fail|error/i.test(s)) return 'failed';
  return 'completed';
}

export function createWatcher(onChange) {
  const sessions = new Map(); // sessionId -> session
  const agents = new Map(); // toolUseId -> agent
  const shells = new Map(); // toolUseId -> shell
  const byTaskId = new Map(); // agentId / backgroundTaskId -> toolUseId
  const files = new Map(); // fichier jsonl -> curseur
  const origins = new Map(); // sessionId -> { origin, ref } (sessions lancées par l'app)
  const startedAt = Date.now();
  let dirty = true;

  const touch = () => (dirty = true);

  function session(id, projDir) {
    let s = sessions.get(id);
    if (!s) {
      s = {
        id,
        projDir,
        slug: path.basename(projDir),
        cwd: null,
        title: null,
        lastPrompt: null,
        lastTool: null,
        lastText: null,
        lastTs: 0,
        mtime: 0,
        toolUses: 0,
      };
      sessions.set(id, s);
    }
    return s;
  }

  function finish(item, status, ts) {
    if (item.status !== 'running' && item.status !== 'stale') return;
    item.status = status;
    item.endedAt = ts || Date.now();
    touch();
  }

  function onNotification(text, ts) {
    if (!text || !text.includes('<task-notification>')) return;
    for (const block of text.split('</task-notification>')) {
      const taskId = tag(block, 'task-id');
      const toolUseId = tag(block, 'tool-use-id') || byTaskId.get(taskId);
      const status = mapStatus(tag(block, 'status'));
      const item = agents.get(toolUseId) || shells.get(toolUseId) || shells.get(byTaskId.get(taskId));
      if (!item) continue;
      if (item.kind === 'shell' && taskId) item.taskId ??= taskId;
      const usage = tag(block, 'usage');
      if (usage && item.kind === 'agent') {
        const tu = tag(usage, 'tool_uses');
        if (tu) item.toolUses = Math.max(item.toolUses, Number(tu));
      }
      finish(item, status, ts);
    }
  }

  function onLine(o, s) {
    const ts = tsOf(o);
    if (o.cwd) s.cwd = o.cwd;
    if (o.timestamp) s.lastTs = Math.max(s.lastTs, ts);
    switch (o.type) {
      case 'ai-title':
        s.title = o.aiTitle;
        touch();
        return;
      case 'last-prompt':
        s.lastPrompt = String(o.lastPrompt || '').slice(0, 200);
        return;
      case 'queue-operation':
        if (o.operation === 'enqueue') onNotification(o.content, ts);
        return;
      case 'assistant':
        break;
      case 'user':
        break;
      default:
        return;
    }
    const content = o.message?.content;
    if (typeof content === 'string') {
      onNotification(content, ts);
      return;
    }
    if (!Array.isArray(content)) return;

    for (const b of content) {
      if (b.type === 'text' && o.type === 'assistant' && b.text?.trim()) {
        s.lastText = b.text.trim().slice(0, 240);
        touch();
      } else if (b.type === 'text' && o.type === 'user') {
        onNotification(b.text, ts);
      } else if (b.type === 'tool_use') {
        const input = b.input || {};
        s.toolUses++;
        s.lastTool = formatTool(b.name, input);
        touch();
        if (b.name === 'Agent' || b.name === 'Task') {
          agents.set(b.id, {
            kind: 'agent',
            id: b.id,
            sessionId: s.id,
            agentId: null,
            description: input.description || 'Agent',
            agentType: input.subagent_type || 'general-purpose',
            prompt: String(input.prompt || '').slice(0, 600),
            model: input.model || null,
            background: !!input.run_in_background,
            status: 'running',
            startedAt: ts,
            endedAt: null,
            toolUses: 0,
            activity: [],
            lastSeen: ts,
            cursor: { offset: 0, rest: Buffer.alloc(0) },
          });
        } else if ((b.name === 'Bash' || b.name === 'PowerShell') && input.run_in_background) {
          shells.set(b.id, {
            kind: 'shell',
            id: b.id,
            sessionId: s.id,
            taskId: null,
            shell: b.name,
            command: String(input.command || ''),
            description: input.description || '',
            status: 'running',
            startedAt: ts,
            endedAt: null,
            outputFile: null,
            tail: '',
            size: 0,
            outMtime: 0,
          });
        } else if (['TaskStop', 'KillShell', 'KillBash'].includes(b.name)) {
          const ref = byTaskId.get(input.task_id || input.shell_id);
          const item = shells.get(ref) || agents.get(ref);
          if (item) finish(item, 'killed', ts);
        }
      } else if (b.type === 'tool_result') {
        const id = b.tool_use_id;
        const r = o.toolUseResult && typeof o.toolUseResult === 'object' ? o.toolUseResult : {};
        const agent = agents.get(id);
        if (agent) {
          if (r.agentId) {
            agent.agentId = r.agentId;
            byTaskId.set(r.agentId, id);
          }
          if (r.resolvedModel) agent.model = r.resolvedModel;
          if (r.status === 'async_launched' || r.isAsync) agent.background = true;
          else finish(agent, b.is_error ? 'failed' : mapStatus(r.status), ts);
        }
        const shell = shells.get(id);
        if (shell) {
          if (r.backgroundTaskId) {
            shell.taskId = r.backgroundTaskId;
            byTaskId.set(r.backgroundTaskId, id);
            shell.outputFile = path.join(TASKS_TMP, s.slug, s.id, 'tasks', `${r.backgroundTaskId}.output`);
          } else if (b.is_error) {
            finish(shell, 'failed', ts);
          }
        }
      }
    }
  }

  function scanFiles() {
    let dirs = [];
    try {
      dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      return;
    }
    for (const d of dirs) {
      const projDir = path.join(PROJECTS_DIR, d.name);
      let entries = [];
      try {
        entries = fs.readdirSync(projDir).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }
      for (const f of entries) {
        const file = path.join(projDir, f);
        let st;
        try {
          st = fs.statSync(file);
        } catch {
          continue;
        }
        let cur = files.get(file);
        if (!cur) {
          if (st.mtimeMs < startedAt - LOOKBACK_MS) continue;
          cur = { offset: 0, rest: Buffer.alloc(0), mtime: 0 };
          files.set(file, cur);
        }
        if (st.mtimeMs === cur.mtime) continue;
        cur.mtime = st.mtimeMs;
        const s = session(f.slice(0, -6), projDir);
        s.mtime = st.mtimeMs;
        for (const o of readNewLines(file, cur)) onLine(o, s);
        touch();
      }
    }
  }

  /** Relie les agents à leur journal de sous-agent (subagents/agent-<id>.meta.json) et suit leur activité. */
  function scanAgents() {
    const metaDone = new Map();
    for (const a of agents.values()) {
      const s = sessions.get(a.sessionId);
      if (!s) continue;
      const dir = path.join(s.projDir, s.id, 'subagents');
      if (!a.agentId) {
        if (!metaDone.has(dir)) {
          const map = new Map();
          try {
            for (const f of fs.readdirSync(dir)) {
              if (!f.endsWith('.meta.json')) continue;
              try {
                const meta = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
                if (meta.toolUseId) map.set(meta.toolUseId, f.slice(6, -10));
              } catch {
                /* méta en cours d'écriture */
              }
            }
          } catch {
            /* pas encore de dossier subagents */
          }
          metaDone.set(dir, map);
        }
        const agentId = metaDone.get(dir).get(a.id);
        if (agentId) {
          a.agentId = agentId;
          byTaskId.set(agentId, a.id);
        }
      }
      if (!a.agentId) continue;
      const recent = a.status === 'running' || Date.now() - (a.endedAt || 0) < 60e3;
      if (!recent && a.cursor.offset > 0) continue;
      const file = path.join(dir, `agent-${a.agentId}.jsonl`);
      for (const o of readNewLines(file, a.cursor)) {
        if (o.timestamp) a.lastSeen = Math.max(a.lastSeen, tsOf(o));
        const content = o.message?.content;
        if (o.type !== 'assistant' || !Array.isArray(content)) continue;
        for (const b of content) {
          let text = null;
          if (b.type === 'tool_use') {
            a.toolUses++;
            text = formatTool(b.name, b.input);
          } else if (b.type === 'text' && b.text?.trim()) {
            text = '» ' + b.text.trim().replace(/\s+/g, ' ').slice(0, 140);
          }
          if (text) {
            a.activity.push({ t: tsOf(o), text });
            if (a.activity.length > 14) a.activity.shift();
            touch();
          }
        }
      }
      if (a.status === 'running') {
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(dir, `agent-${a.agentId}.meta.json`), 'utf8'));
          if (meta.finished === true && Date.now() - a.lastSeen > 5e3) finish(a, 'completed', a.lastSeen);
        } catch {
          /* rien */
        }
      }
    }
  }

  function scanShells() {
    for (const sh of shells.values()) {
      if (!sh.outputFile) continue;
      if (sh.status !== 'running' && sh.tailDone) continue;
      try {
        const st = fs.statSync(sh.outputFile);
        if (st.mtimeMs !== sh.outMtime || st.size !== sh.size) {
          const t = tailFile(sh.outputFile);
          sh.tail = t.text;
          sh.size = t.size;
          sh.outMtime = t.mtime;
          touch();
        }
        if (sh.status !== 'running') sh.tailDone = true;
      } catch {
        if (sh.status !== 'running') sh.tailDone = true;
      }
    }
  }

  function markStale() {
    const now = Date.now();
    for (const it of [...agents.values(), ...shells.values()]) {
      if (it.status !== 'running') continue;
      const s = sessions.get(it.sessionId);
      const last = Math.max(s?.mtime || 0, it.lastSeen || 0, it.outMtime || 0, it.startedAt);
      if (now - last > STALE_MS) {
        it.status = 'stale';
        touch();
      }
    }
  }

  function tick() {
    scanFiles();
    scanAgents();
    scanShells();
    markStale();
    if (dirty) {
      dirty = false;
      onChange();
    }
  }

  function snapshot() {
    const now = Date.now();
    const visible = (it) => it.status === 'running' || now - (it.endedAt || it.startedAt) < KEEP_DONE_MS;
    const ag = [...agents.values()].filter((a) => a.status !== 'stale' && visible(a));
    const sh = [...shells.values()].filter((x) => x.status !== 'stale' && visible(x));
    const busy = new Set([...ag, ...sh].map((x) => x.sessionId));
    const ss = [...sessions.values()]
      .filter((s) => busy.has(s.id) || now - s.mtime < SESSION_ACTIVE_MS || origins.has(s.id))
      .map((s) => ({
        id: s.id,
        cwd: s.cwd,
        project: s.cwd ? path.basename(s.cwd) : s.slug,
        title: s.title,
        lastPrompt: s.lastPrompt,
        lastTool: s.lastTool,
        lastText: s.lastText,
        toolUses: s.toolUses,
        lastActivity: s.mtime,
        active: now - s.mtime < SESSION_ACTIVE_MS,
        ...(origins.get(s.id) || { origin: 'claude-code', ref: null }),
      }));
    // Anciens agents, plus affichés sur une île : ils dérivent en barque sur le fleuve.
    const shown = new Set(ag.map((a) => a.id));
    const history = [...agents.values()]
      .filter((a) => !shown.has(a.id) && a.status !== 'running')
      .sort((a, b) => (b.endedAt || b.startedAt) - (a.endedAt || a.startedAt))
      .slice(0, HISTORY_MAX)
      .map(({ cursor, activity, ...a }) => ({ ...a, activity: activity.slice(-6) }));
    return {
      now,
      sessions: ss,
      agents: ag.map(({ cursor, ...a }) => a),
      shells: sh.map(({ tailDone, ...x }) => x),
      history,
    };
  }

  function recentCwds() {
    const seen = new Map();
    for (const s of sessions.values()) if (s.cwd) seen.set(s.cwd, Math.max(seen.get(s.cwd) || 0, s.mtime));
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }

  function setOrigin(sessionId, origin, ref) {
    origins.set(sessionId, { origin, ref });
    touch();
  }

  return { tick, snapshot, recentCwds, setOrigin };
}
