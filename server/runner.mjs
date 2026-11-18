// Lance `claude -p` en mode stream-json et traduit ses événements en messages simples pour l'interface.
import { spawn } from 'node:child_process';
import { formatTool } from './watcher.mjs';

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

export function runClaude({ prompt, cwd, model, resume, permissionMode = 'acceptEdits', onEvent, onExit }) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', permissionMode];
  if (model) args.push('--model', model);
  if (resume) args.push('--resume', resume);

  // Sans ces variables, un serveur lancé depuis une session Claude Code se croirait imbriqué.
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_')) delete env[k];

  const child = spawn(CLAUDE_BIN, args, { cwd, env, windowsHide: true });
  let out = '';
  let err = '';
  let gotResult = false;

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    out += chunk;
    let i;
    while ((i = out.indexOf('\n')) >= 0) {
      const line = out.slice(0, i).trim();
      out = out.slice(i + 1);
      if (!line) continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      for (const ev of translate(o)) {
        if (ev.k === 'result') gotResult = true;
        onEvent(ev);
      }
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c) => (err = (err + c).slice(-4000)));
  child.stdin.on('error', () => {});
  child.stdin.end(prompt);

  child.on('error', (e) => {
    onEvent({ k: 'error', text: `Impossible de lancer « ${CLAUDE_BIN} » : ${e.message}` });
    onExit?.(-1);
  });
  child.on('close', (code) => {
    if (!gotResult && code !== 0) onEvent({ k: 'error', text: err.trim() || `claude s'est arrêté (code ${code})` });
    onExit?.(code);
  });

  return { stop: () => child.kill() };
}

function* translate(o) {
  if (o.type === 'system' && o.subtype === 'init') {
    yield { k: 'init', sessionId: o.session_id, model: o.model, cwd: o.cwd };
  } else if (o.type === 'assistant' && Array.isArray(o.message?.content)) {
    for (const b of o.message.content) {
      if (b.type === 'text' && b.text?.trim()) yield { k: 'text', text: b.text };
      else if (b.type === 'tool_use') yield { k: 'tool', name: b.name, text: formatTool(b.name, b.input) };
    }
  } else if (o.type === 'user' && Array.isArray(o.message?.content)) {
    for (const b of o.message.content) if (b.type === 'tool_result' && b.is_error) yield { k: 'toolerr', text: 'outil refusé ou en erreur' };
  } else if (o.type === 'result') {
    yield {
      k: 'result',
      ok: o.subtype === 'success' && !o.is_error,
      text: typeof o.result === 'string' ? o.result : '',
      cost: o.total_cost_usd ?? null,
      durationMs: o.duration_ms ?? null,
      sessionId: o.session_id,
    };
  }
}
