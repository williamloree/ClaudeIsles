// Serveur local de Claude Isles : diffuse l'état des sessions Claude Code (SSE),
// pilote le chat du hub et les tâches rapides, et sert l'interface compilée (dist/).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createWatcher } from './watcher.mjs';
import { runClaude } from './runner.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DATA = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 4317);
const HOST = '127.0.0.1';
const MODELS = ['haiku', 'sonnet', 'opus'];

fs.mkdirSync(DATA, { recursive: true });

function load(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
  } catch {
    return fallback;
  }
}
const saveLater = (() => {
  const timers = {};
  return (name, getValue) => {
    clearTimeout(timers[name]);
    timers[name] = setTimeout(() => fs.writeFileSync(path.join(DATA, name), JSON.stringify(getValue(), null, 1)), 500);
  };
})();

// ---------- Diffusion SSE ----------
const clients = new Set();
function send(type, data, only) {
  const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const res of only ? [only] : clients) res.write(payload);
}

// ---------- Surveillance des sessions ----------
let snapTimer = null;
const watcher = createWatcher(() => {
  if (snapTimer) return;
  snapTimer = setTimeout(() => {
    snapTimer = null;
    send('snapshot', watcher.snapshot());
  }, 250);
});
setInterval(() => watcher.tick(), 1000);
watcher.tick();

const defaultCwd = ['C:\\Dev\\Styx', 'C:\\Dev'].find((d) => fs.existsSync(d)) || os.homedir();

// ---------- Hub : conversation avec Claude ----------
const hub = load('hub.json', { sessionId: null, cwd: defaultCwd, model: null, messages: [] });
hub.busy = false;
let hubRun = null;
if (hub.sessionId) watcher.setOrigin(hub.sessionId, 'hub', null);

const hubState = () => ({ busy: hub.busy, cwd: hub.cwd, sessionId: hub.sessionId, model: hub.model });
function hubPush(role, text, extra = {}) {
  const msg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), role, text, ts: Date.now(), ...extra };
  hub.messages.push(msg);
  if (hub.messages.length > 300) hub.messages.splice(0, hub.messages.length - 300);
  send('hubmsg', msg);
  saveLater('hub.json', () => ({ ...hub, busy: false }));
}

function hubSend(text) {
  if (hub.busy) throw httpError(409, 'Claude est déjà en train de répondre.');
  hubPush('user', text);
  hub.busy = true;
  send('hubstate', hubState());
  hubRun = runClaude({
    prompt: text,
    cwd: hub.cwd,
    model: hub.model,
    resume: hub.sessionId,
    onEvent(ev) {
      if (ev.k === 'init') {
        if (ev.sessionId && ev.sessionId !== hub.sessionId) {
          hub.sessionId = ev.sessionId;
          watcher.setOrigin(ev.sessionId, 'hub', null);
        }
      } else if (ev.k === 'text') hubPush('claude', ev.text);
      else if (ev.k === 'tool') hubPush('tool', ev.text);
      else if (ev.k === 'toolerr') hubPush('system', ev.text);
      else if (ev.k === 'error') hubPush('error', ev.text);
      else if (ev.k === 'result') {
        if (ev.sessionId) hub.sessionId = ev.sessionId;
        if (!ev.ok) hubPush('error', ev.text || 'La requête a échoué.');
        hubPush('meta', [ev.durationMs != null && `${(ev.durationMs / 1000).toFixed(1)} s`, ev.cost != null && `${ev.cost.toFixed(3)} $`].filter(Boolean).join(' · '));
      }
    },
    onExit() {
      hub.busy = false;
      hubRun = null;
      send('hubstate', hubState());
      saveLater('hub.json', () => ({ ...hub, busy: false }));
    },
  });
}

// ---------- Tâches rapides ----------
const tasks = load('tasks.json', []).filter((t) => Date.now() - t.startedAt < 24 * 3600e3);
for (const t of tasks) {
  if (t.status === 'running') t.status = 'stopped';
  if (t.sessionId) watcher.setOrigin(t.sessionId, 'task', t.id);
}
const runs = new Map();
const publishTasks = () => {
  send('tasks', tasks);
  saveLater('tasks.json', () => tasks);
};

function createTask({ prompt, cwd, model, title }) {
  prompt = String(prompt || '').trim();
  if (!prompt) throw httpError(400, 'Consigne vide.');
  cwd = cwd || hub.cwd;
  if (!fs.existsSync(cwd)) throw httpError(400, `Dossier introuvable : ${cwd}`);
  if (model && !MODELS.includes(model)) throw httpError(400, 'Modèle inconnu.');
  const t = {
    id: 't' + Date.now().toString(36),
    title: String(title || '').trim() || prompt.replace(/\s+/g, ' ').slice(0, 60),
    prompt,
    cwd,
    model: model || 'sonnet',
    status: 'running',
    startedAt: Date.now(),
    endedAt: null,
    sessionId: null,
    toolUses: 0,
    cost: null,
    result: null,
    log: [],
  };
  tasks.unshift(t);
  if (tasks.length > 40) tasks.splice(40).forEach((x) => runs.get(x.id)?.stop());
  const log = (kind, text) => {
    t.log.push({ t: Date.now(), kind, text: String(text).slice(0, 2000) });
    if (t.log.length > 80) t.log.shift();
  };
  runs.set(
    t.id,
    runClaude({
      prompt,
      cwd,
      model: t.model,
      onEvent(ev) {
        if (ev.k === 'init' && ev.sessionId) {
          t.sessionId = ev.sessionId;
          watcher.setOrigin(ev.sessionId, 'task', t.id);
        } else if (ev.k === 'text') log('text', ev.text);
        else if (ev.k === 'tool') {
          t.toolUses++;
          log('tool', ev.text);
        } else if (ev.k === 'toolerr' || ev.k === 'error') log('error', ev.text);
        else if (ev.k === 'result') {
          t.result = ev.text;
          t.cost = ev.cost;
          t.status = ev.ok ? 'completed' : 'failed';
        }
        publishTasks();
      },
      onExit(code) {
        runs.delete(t.id);
        if (t.status === 'running') t.status = code === 0 ? 'completed' : 'stopped';
        t.endedAt = Date.now();
        publishTasks();
      },
    }),
  );
  publishTasks();
  return t;
}

// ---------- HTTP ----------
function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function readJson(req) {
  // Exige du JSON depuis une origine locale : une page web tierce ne peut pas piloter Claude.
  if (!String(req.headers['content-type'] || '').includes('application/json')) throw httpError(415, 'JSON attendu.');
  const origin = req.headers.origin;
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) throw httpError(403, 'Origine refusée.');
  let body = '';
  for await (const c of req) {
    body += c;
    if (body.length > 1e6) throw httpError(413, 'Requête trop grosse.');
  }
  return body ? JSON.parse(body) : {};
}

const routes = {
  'GET /api/events': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    clients.add(res);
    send('snapshot', watcher.snapshot(), res);
    send('hub', { state: hubState(), messages: hub.messages }, res);
    send('tasks', tasks, res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20e3);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
  },
  'GET /api/cwds': () => [...new Set([hub.cwd, ...watcher.recentCwds()])].slice(0, 15),
  'POST /api/hub/send': async (req) => {
    const { text } = await readJson(req);
    if (!String(text || '').trim()) throw httpError(400, 'Message vide.');
    hubSend(String(text).trim());
    return { ok: true };
  },
  'POST /api/hub/stop': () => {
    hubRun?.stop();
    return { ok: true };
  },
  'POST /api/hub/reset': () => {
    if (hub.busy) throw httpError(409, 'Arrête la réponse en cours avant.');
    hub.sessionId = null;
    hub.messages = [];
    send('hub', { state: hubState(), messages: [] });
    saveLater('hub.json', () => ({ ...hub, busy: false }));
    return { ok: true };
  },
  'POST /api/hub/config': async (req) => {
    const { cwd, model } = await readJson(req);
    if (cwd !== undefined) {
      if (!fs.existsSync(cwd)) throw httpError(400, `Dossier introuvable : ${cwd}`);
      if (path.resolve(cwd) !== path.resolve(hub.cwd)) hub.sessionId = null; // une session est liée à son dossier
      hub.cwd = path.resolve(cwd);
    }
    if (model !== undefined) {
      if (model && !MODELS.includes(model)) throw httpError(400, 'Modèle inconnu.');
      hub.model = model || null;
    }
    send('hubstate', hubState());
    saveLater('hub.json', () => ({ ...hub, busy: false }));
    return hubState();
  },
  'POST /api/tasks': async (req) => createTask(await readJson(req)),
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

function serveStatic(req, res) {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DIST, path.normalize(url).replace(/^([/\\])+/, ''));
  if (!file.startsWith(DIST)) file = DIST;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Interface non compilée : lance « npm run build » (ou « npm run dev » et ouvre http://localhost:5181).');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;
    let handler = routes[`${req.method} ${pathname}`];
    const m = pathname.match(/^\/api\/tasks\/([\w-]+)\/(stop|dismiss)$/);
    if (!handler && req.method === 'POST' && m) {
      handler = async (r) => {
        await readJson(r);
        const t = tasks.find((x) => x.id === m[1]);
        if (!t) throw httpError(404, 'Tâche inconnue.');
        if (m[2] === 'stop') runs.get(t.id)?.stop();
        else {
          runs.get(t.id)?.stop();
          tasks.splice(tasks.indexOf(t), 1);
          publishTasks();
        }
        return { ok: true };
      };
    }
    if (!handler) {
      if (pathname.startsWith('/api/')) {
        res.writeHead(404);
        return res.end();
      }
      return serveStatic(req, res);
    }
    try {
      const result = await handler(req, res);
      if (result !== undefined) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      }
    } catch (e) {
      res.writeHead(e.status || 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: e.message }));
    }
  })
  .listen(PORT, HOST, () => console.log(`Claude Isles : http://localhost:${PORT}`));
