import type { Theme } from '../types';
import { Scene } from './Scene';

const banquise: Theme = {
  id: 'banquise',
  name: 'Banquise',
  words: {
    title: 'BANQUISE',
    connected: 'la radio grésille',
    disconnected: 'liaison radio perdue',
    hubIdle: 'le feu du phare veille sur la banquise',
    hubBusy: 'le phare scrute la nuit…',
    agent: 'EXPLORATEUR',
    task: 'ÉCLAIREUR',
    boat: 'À LA DÉRIVE',
    boats: 'À la dérive',
    noBoats: 'Aucun kayak dans le chenal',
    noSlot: 'sans floe libre',
    ambientBoat: { title: 'Glaçon errant', subtitle: 'une lanterne oubliée dérive dans la nuit polaire' },
  },
  Scene,
  // vue depuis le nord (-z) : l'aurore danse au fond, face à l'entrée de l'igloo
  camera: [14, 31, -118],
  exposure: 1.05,
  // interface givrée : acier bleuté, texte blanc glacé
  cssVars: {
    '--bronze': '#7fb8d8',
    '--bronze-dim': 'rgba(127, 184, 216, 0.4)',
    '--parchment': '#e6f3ff',
    '--muted': '#9cb8cc',
    '--panel': 'linear-gradient(180deg, rgba(18, 38, 58, 0.88), rgba(6, 14, 24, 0.9))',
    '--serif': "'Josefin Sans', Inter, 'Segoe UI', sans-serif",
  },
};

export default banquise;
