# Claude Isles · Styx

Visualisation 3D de ce que fait Claude Code sur la machine, dans les Enfers grecs : une caverne, le fleuve Styx, des îlots de basalte et un temple.

- **Claude = la flamme éternelle**, sur l'autel d'un temple rond (tholos) au centre. Clic dessus (ou touche `T`) : terminal pour lui parler directement. La flamme grandit et le cœur s'agite quand il réfléchit.
- **Îlots** : chaque agent lancé (outil `Agent`) ou tâche rapide fait surgir un îlot, relié au temple par un pont de marbre en arche. L'esprit de l'agent (robe spectrale qui ondule, capuche au visage d'ombre, yeux luisants) écrit à la plume sur une tablette de pierre où s'inscrit son activité réelle. Le brasero et la torchère du pont donnent le statut : bleu en cours, or terminé, rouge échec. Pas d'agent, pas d'îlot.
- **Barques** : les anciens agents (sortis de leur îlot) et les anciennes tâches dérivent sur le fleuve, chacun dans sa barque avec sa lanterne et son sillage. Survol : son nom ; clic : son détail, la caméra suit la barque. Quelques âmes oubliées dérivent toujours, pour que le fleuve ne soit jamais vide. Charon fait sa ronde, au large, avec sa lanterne verte.
- **Stèles** : chaque shell en arrière-plan (`run_in_background`) est une stèle gravée sur le parvis ; la commande et la fin de sa sortie y luisent comme des braises, en direct. Clic : sortie complète.
- **Lanternes** au-dessus du temple : les sessions Claude Code ouvertes ailleurs (terminal, VS Code…).
- Ambiance : eau qui reflète les feux, ondes au pied des îlots, bougies sur des nénuphars, brume, braises, feux follets, stalactites.

Les 16 îlots sont prédéfinis (géométrie calculée une fois au chargement, graine fixe) : un agent prend simplement un emplacement libre, l'anneau intérieur d'abord.

Les maquettes d'origine sont dans `maquettes/` (`styx.html` et `realiste.html`, ouvrables par double-clic).

## Lancer

```cmd
lancer.cmd
```

Puis <http://localhost:4317>.

Développement : `npm run dev` (serveur relancé à chaque modification + Vite sur <http://localhost:5181>).

## Comment ça marche

| Partie | Rôle |
| --- | --- |
| `server/watcher.mjs` | Lit en continu les journaux de Claude Code : `~/.claude/projects/<projet>/<session>.jsonl` (appels d'outils, notifications de fin), `…/<session>/subagents/agent-*.jsonl` (activité des agents) et `%TEMP%\claude\<projet>\<session>\tasks\<id>.output` (sortie des shells). Aucun hook, aucune modification de la config de Claude. |
| `server/runner.mjs` | Lance `claude -p --output-format stream-json` pour le chat du hub et les tâches. |
| `server/index.mjs` | Serveur local (127.0.0.1:4317) : flux SSE `/api/events`, API du hub et des tâches, sert `dist/`. |
| `src/scene/` | Scène three.js (React Three Fiber) : `Hub`, `Islet`, `Office` (esprit et tablette), `Ghost`, `River` (eau, barques, Charon, bougies), `Cave`, `Bridges`, `ShellStele`, `SessionSat` (lanternes), `materials` (textures procédurales, shader des fantômes). |
| `src/ui/` | Terminal, formulaire de tâche, liste, panneau de détail. |

- Le chat du hub reprend la même session d'un message à l'autre (`--resume`) ; `/new` repart de zéro, `/cd` change de dossier.
- Les tâches et le hub tournent en **`acceptEdits`** : ils lisent et modifient des fichiers, les commandes shell non autorisées par tes règles sont refusées.
- Les sessions des dernières 24 h sont relues au démarrage. Un agent ou un shell terminé reste sur son îlot 45 min, puis l'agent part en barque (24 barques au plus). Sans signe de vie depuis 1 h 30, il est « perdu » (âme grise).
- `data/` (local, ignoré par git) garde la conversation du hub et les tâches des dernières 24 h.

## Raccourcis

| Touche | Action |
| --- | --- |
| `T` ou `²` | Ouvrir / fermer le terminal |
| `N` | Nouvelle tâche rapide |
| `Échap` | Désélectionner |
| Terminal : `/tache <consigne>` | Lancer une tâche sans quitter le clavier |
