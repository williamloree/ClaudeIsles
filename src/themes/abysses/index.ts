import type { Theme } from '../types';
import { Scene } from './Scene';

const abysses: Theme = {
  id: 'abysses',
  name: 'Abysses',
  words: {
    title: 'ABYSSES',
    connected: 'le sonar écoute',
    disconnected: 'le sonar s’est tu',
    hubIdle: 'le cœur des abysses t’écoute',
    hubBusy: 'la grande méduse réfléchit…',
    agent: 'SCAPHANDRIER',
    task: 'PLONGEUR',
    boat: 'ÉPAVE À LA DÉRIVE',
    boats: 'Épaves',
    noBoats: 'Aucune épave ne dérive',
    noSlot: 'sans habitat libre',
    ambientBoat: { title: 'Sous-marin fantôme', subtitle: 'un vieux submersible sans équipage dérive dans le noir' },
  },
  Scene,
  camera: [-16, 46, 80],
  exposure: 1.15,
  cssVars: {
    '--bronze': '#3fa9b5',
    '--bronze-dim': 'rgba(63, 169, 181, 0.45)',
    '--parchment': '#dff6f4',
    '--muted': '#9cc3c4',
    '--claude': '#b26bff',
    '--lantern': '#58f0c8',
    '--panel': 'linear-gradient(180deg, rgba(6, 34, 44, 0.9), rgba(2, 16, 22, 0.9))',
  },
};

export default abysses;
