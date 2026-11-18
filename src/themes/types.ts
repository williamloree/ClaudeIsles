// Ce qu'un thème fournit. La logique (emplacements, données, caméra, sélection, panneaux) est commune ;
// un thème ne fait que dessiner le monde à ces emplacements, et nommer les choses à sa façon.
import type { ComponentType } from 'react';
import type { Layout } from '../scene/layout';
import type { WorkerInfo } from '../scene/info';
import type { Vec3 } from '../scene/slots';

export interface ThemeWords {
  /** Nom affiché dans la barre du haut : « CLAUDE · <title> ». */
  title: string;
  /** État de la connexion au serveur, dans la barre du haut. */
  connected: string;
  disconnected: string;
  /** Sous-titre de l'étiquette de Claude. */
  hubIdle: string;
  hubBusy: string;
  /** Badge d'un agent sur son îlot (et dans le panneau de détail). */
  agent: string;
  /** Badge d'une tâche rapide sur son îlot. */
  task: string;
  /** Badge d'un ancien agent qui dérive. */
  boat: string;
  /** Titre de la section des anciens agents dans la liste, et texte quand elle est vide. */
  boats: string;
  noBoats: string;
  /** Agents sans emplacement libre : « +3 <noSlot> ». */
  noSlot: string;
  /** Figurants qui dérivent quand il y a peu d'anciens agents. */
  ambientBoat: { title: string; subtitle: string };
}

export interface SceneProps {
  layout: Layout;
  /** Agents et tâches sur leur îlot, prêts à afficher. */
  workers: WorkerInfo[];
  /** Clé de l'élément sélectionné : `hub`, `agent:<id>`, `task:<id>`, `shell:<id>`, `session:<id>`. */
  selectedKey: string | null;
}

export interface Theme {
  id: string;
  /** Nom dans le sélecteur. */
  name: string;
  words: ThemeWords;
  /**
   * Tout le visuel : fond, brouillard, lumières, eau/sol, hub, îlots (`workers`), ponts (`layout.bridges`),
   * stèles (`layout.shells`), sessions (`layout.sessions`), barques (`layout.boats`, en tenant
   * `livePositions` à jour) et post-traitement. Utiliser les étiquettes de `scene/labels`.
   */
  Scene: ComponentType<SceneProps>;
  /** Position initiale de la caméra (défaut : [-20, 40, 125]). */
  camera?: Vec3;
  /** Exposition du rendu (défaut : 1.1). */
  exposure?: number;
  /** Variables CSS de l'interface à surcharger (voir `:root` dans styles.css), ex. `{ '--bronze': '#4fd' }`. */
  cssVars?: Record<string, string>;
}
