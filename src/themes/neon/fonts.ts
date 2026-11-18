// Polices de l'univers néon (Orbitron pour les enseignes, Rajdhani pour l'interface), chargées avec le thème.
// Les textures dessinées sur canvas attendent qu'elles soient prêtes pour se redessiner.
import { useEffect, useState } from 'react';
import { clearSignCache } from './materials';

const HREF = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Rajdhani:wght@500;600;700&display=swap';

let ready = false;
let loading: Promise<void> | null = null;

function load() {
  if (!loading) {
    if (!document.querySelector(`link[href="${HREF}"]`)) {
      const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: HREF });
      document.head.appendChild(link);
    }
    // jamais bloquant : sans réseau, on garde les polices de repli
    const fonts = Promise.all([document.fonts.load('700 30px Orbitron'), document.fonts.load('500 20px Orbitron'), document.fonts.load("600 20px 'JetBrains Mono'")]);
    loading = Promise.race([fonts, new Promise((r) => setTimeout(r, 4000))])
      .catch(() => {})
      .then(() => {
        ready = true;
        clearSignCache();
      });
  }
  return loading;
}

/** Vrai quand les polices sont chargées (ou abandonnées) : à mettre dans les dépendances des dessins. */
export function useFontsReady() {
  const [ok, setOk] = useState(ready);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    load().then(() => alive && setOk(true));
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

load();
