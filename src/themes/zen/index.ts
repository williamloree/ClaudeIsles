// La police Shippori Mincho est chargée par materials.ts (importé par la scène).
import type { Theme } from '../types';
import { Scene } from './Scene';

const zen: Theme = {
  id: 'zen',
  name: 'Jardin zen',
  words: {
    title: 'ZEN',
    connected: 'le jardin respire',
    disconnected: 'le jardin s’est tu',
    hubIdle: 'la lanterne veille sur l’étang',
    hubBusy: 'la lanterne médite…',
    agent: 'MOINE',
    task: 'NOVICE',
    boat: 'LANTERNE FLOTTANTE',
    boats: 'Lanternes flottantes',
    noBoats: 'Aucune lanterne sur l’étang',
    noSlot: 'sans îlot libre',
    ambientBoat: { title: 'Lanterne votive', subtitle: 'une prière sans nom dérive sur l’étang' },
  },
  Scene,
  camera: [-14, 21, 84],
  exposure: 1.15,
  // vermillon des ponts et indigo de la nuit pour l'interface
  cssVars: {
    '--bronze': '#b4432c',
    '--bronze-dim': 'rgba(180, 67, 44, 0.45)',
    '--parchment': '#f3ead6',
    '--muted': '#b9b2a0',
    '--claude': '#ff9a4d',
    '--panel': 'linear-gradient(180deg, rgba(14, 18, 30, 0.88), rgba(7, 9, 16, 0.9))',
    '--serif': "'Shippori Mincho', 'Yu Mincho', Georgia, serif",
  },
};

export default zen;
