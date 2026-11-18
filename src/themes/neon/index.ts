import type { Theme } from '../types';
import { Scene } from './Scene';

const neon: Theme = {
  id: 'neon',
  name: 'Néon',
  words: {
    title: 'NÉON',
    connected: 'liaison neuronale établie',
    disconnected: 'signal perdu',
    hubIdle: 'noyau holographique · en écoute',
    hubBusy: 'le noyau calcule…',
    agent: 'ANDROÏDE',
    task: 'ANDROÏDE',
    boat: 'ANCIEN AGENT',
    boats: 'Dérive',
    noBoats: 'Aucun drone à la dérive',
    noSlot: 'sans plateforme libre',
    ambientBoat: { title: 'Drone sans maître', subtitle: 'un vieux programme patrouille sous la pluie' },
  },
  Scene,
  camera: [-28, 32, 92],
  cssVars: {
    '--soul': '#6fd6ff',
    '--claude': '#2de2e6',
    '--lantern': '#3cff8f',
    '--ember': '#ff6c11',
    '--bronze': '#ff3cac',
    '--bronze-dim': 'rgba(255, 60, 172, 0.4)',
    '--parchment': '#eaf4ff',
    '--muted': '#a596c8',
    '--panel': 'linear-gradient(180deg, rgba(16, 8, 32, 0.9), rgba(5, 3, 14, 0.9))',
    '--serif': "Orbitron, 'Segoe UI', sans-serif",
  },
};

export default neon;
