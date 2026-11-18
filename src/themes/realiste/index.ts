import type { Theme } from '../types';
import { Scene } from './Scene';

const realiste: Theme = {
  id: 'realiste',
  name: 'Réaliste',
  words: {
    title: 'ARCHIPEL',
    connected: 'ciel dégagé',
    disconnected: 'liaison perdue dans les nuages',
    hubIdle: 'à l’écoute · clique pour parler',
    hubBusy: 'l’observatoire calcule…',
    agent: 'ÉQUIPIER',
    task: 'ÉQUIPIER',
    boat: 'DIRIGEABLE',
    boats: 'Dirigeables',
    noBoats: 'Aucun dirigeable dans le ciel',
    noSlot: 'sans île libre',
    ambientBoat: { title: 'Dirigeable de passage', subtitle: 'un vieux dirigeable croise au large' },
  },
  Scene,
  camera: [-16, 44, 108],
  exposure: 0.65,
  // interface en verre bleuté, comme les étiquettes de la maquette
  cssVars: {
    '--bronze': '#9db4cc',
    '--bronze-dim': 'rgba(157, 180, 204, 0.4)',
    '--parchment': '#eef3f8',
    '--muted': '#9aa9ba',
    '--panel': 'linear-gradient(180deg, rgba(18, 26, 40, 0.86), rgba(10, 15, 24, 0.86))',
    '--serif': "Inter, 'Segoe UI', sans-serif",
  },
};

export default realiste;
