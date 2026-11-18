// Registre des thèmes. Chacun est chargé seulement quand on le choisit (un fichier JS par thème).
import type { Theme } from './types';

export const THEMES: { id: string; name: string; load: () => Promise<{ default: Theme }> }[] = [
  { id: 'styx', name: 'Styx', load: () => import('./styx') },
  { id: 'realiste', name: 'Réaliste', load: () => import('./realiste') },
  { id: 'abysses', name: 'Abysses', load: () => import('./abysses') },
  { id: 'neon', name: 'Néon', load: () => import('./neon') },
  { id: 'zen', name: 'Jardin zen', load: () => import('./zen') },
  { id: 'banquise', name: 'Banquise', load: () => import('./banquise') },
];

const KEY = 'claude-isles-theme';
const known = (id: string | null) => (id && THEMES.some((t) => t.id === id) ? id : null);

/** Thème au démarrage : `?theme=<id>` dans l'URL, sinon le dernier choisi, sinon Styx. */
export function initialThemeId() {
  return known(new URLSearchParams(location.search).get('theme')) ?? known(localStorage.getItem(KEY)) ?? 'styx';
}

export async function loadTheme(id: string) {
  localStorage.setItem(KEY, id);
  const entry = THEMES.find((t) => t.id === id) ?? THEMES[0];
  return (await entry.load()).default;
}
