// Calque DOM fixe où drei <Html> place toutes les étiquettes. Sans lui, le conteneur par défaut
// change juste après le premier rendu et une étiquette montée à ce moment-là reste vide (React 19).
export const labelLayer: { current: HTMLDivElement } = { current: null as unknown as HTMLDivElement };
