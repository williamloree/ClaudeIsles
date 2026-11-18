import type { Theme } from '../types';
import { Scene } from './Scene';

const styx: Theme = {
  id: 'styx',
  name: 'Styx',
  words: {
    title: 'STYX',
    connected: 'le passeur veille',
    disconnected: 'le serveur s’est tu',
    hubIdle: 'la flamme éternelle t’écoute',
    hubBusy: 'la flamme réfléchit…',
    agent: 'ÂME',
    task: 'ÂME',
    boat: 'ÂME EN BARQUE',
    boats: 'Barques',
    noBoats: 'Aucune âme sur le fleuve',
    noSlot: 'sans îlot libre',
    ambientBoat: { title: 'Âme oubliée', subtitle: 'une âme sans nom dérive sur le Styx' },
  },
  Scene,
};

export default styx;
