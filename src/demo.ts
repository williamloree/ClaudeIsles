// Données fictives pour `?demo` : de quoi peupler tous les éléments du monde sans serveur.
import type { Agent, HubMessage, Session, Shell, Snapshot, Status, Task } from './types';

export function demoState(): { connected: boolean; snapshot: Snapshot; tasks: Task[]; messages: HubMessage[] } {
  const now = Date.now();
  const min = 60e3;

  const session = (id: string, project: string, title: string, ago: number, lastTool: string | null): Session => ({
    id, cwd: `C:\\Dev\\${project}`, project, title, lastPrompt: title, lastTool, lastText: null, toolUses: 12,
    lastActivity: now - ago, active: ago < min, origin: 'claude-code', ref: null,
  });
  const sessions = [
    session('s1', 'BDDStyx', 'Documenter le schéma', 5e3, 'Grep "ID_RESTITUTION"'),
    session('s2', 'MyStyx', 'Revue de la facturation', 12e3, 'Read lib/calcul.styx'),
    session('s3', 'ClaudeIsles', 'Nouveaux thèmes', 20 * min, null),
  ];

  const agent = (id: string, sessionId: string, description: string, agentType: string, status: Status, startedMin: number, toolUses: number, activity: string[], endedMin?: number): Agent => ({
    kind: 'agent', id, sessionId, agentId: id, description, agentType, prompt: description, model: 'claude-sonnet-5-5', background: false, status,
    startedAt: now - startedMin * min, endedAt: endedMin === undefined ? null : now - endedMin * min, toolUses,
    activity: activity.map((text, i) => ({ t: now - (activity.length - i) * 5e3, text })),
  });
  const agents = [
    agent('a1', 's2', 'Revue du module facturation', 'general-purpose', 'running', 2.2, 23, ['Read lib/tarifs.styx', 'Grep "TEOM"', 'Read lib/calcul.styx']),
    agent('a2', 's1', 'Explorer le dépôt BDDStyx', 'Explore', 'running', 4, 41, ['Glob **/*.sql', 'Read tables/restitution.sql', 'Grep "ID_RESTITUTION"']),
    agent('a3', 's2', 'Lancer les tests', 'general-purpose', 'failed', 3, 7, ['PS> npm test', '3 tests en échec'], 2),
  ];
  const history = [
    agent('h1', 's1', 'Résumer la réunion TEOM', 'general-purpose', 'completed', 90, 9, ['Write notes.md'], 80),
    agent('h2', 's2', 'Analyser les logs SMTP', 'Explore', 'completed', 70, 18, ['Grep "550"'], 62),
    agent('h3', 's3', 'Migrer la base de recette', 'general-purpose', 'failed', 50, 31, ['PS> migrate.ps1'], 44),
  ];

  const shell = (id: string, sessionId: string, command: string, description: string, status: Status, tail: string[]): Shell => ({
    kind: 'shell', id, sessionId, taskId: null, shell: 'powershell', command, description, status,
    startedAt: now - 6 * min, endedAt: status === 'running' ? null : now - min, tail: tail.join('\n'), size: 0,
  });
  const shells = [
    shell('sh1', 's3', 'npm run dev', 'Serveur de dev', 'running', ['VITE v8.3.8  ready in 412 ms', '➜ Local: http://localhost:5181/', '[hmr] src/App.tsx mis à jour', '[hmr] src/styles.css mis à jour']),
    shell('sh2', 's1', 'python -I scripts/doc/regenerer.py', 'Régénérer la doc', 'running', ['Lecture de knowledge.py…', '562 tables, 676 liaisons', 'Écriture 02 - Tables/… 451/562']),
    shell('sh3', 's2', 'git log --oneline -n 20', 'Historique', 'completed', ['a3f9c1e Corrige le calcul TEOM', '91b2d04 Ajoute la doc des ponts']),
  ];

  const tasks: Task[] = [
    {
      id: 't1', title: 'Mettre à jour le README', prompt: 'Mettre à jour le README', cwd: 'C:\\Dev\\ClaudeIsles', model: 'sonnet', status: 'completed',
      startedAt: now - 8 * min, endedAt: now - 6.5 * min, sessionId: null, toolUses: 12, cost: 0.04, result: 'README à jour.',
      log: [{ t: now - 7 * min, kind: 'tool', text: 'Edit README.md' }],
    },
  ];

  return {
    connected: true,
    snapshot: { now, sessions, agents, shells, history },
    tasks,
    messages: [{ id: 'm1', role: 'meta', text: 'Mode démo : données fictives, le terminal ne répond pas.', ts: now }],
  };
}
