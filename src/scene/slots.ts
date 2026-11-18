// Emplacements fixes du monde, communs à tous les thèmes : chaque thème dessine ses propres
// îlots, ponts, stèles et lanternes, mais toujours à ces positions (la caméra et la liste en dépendent).

export type Vec3 = [number, number, number];

/** Rayon d'un îlot d'agent. */
export const ISLET_RADIUS = 7;
/** Hauteur du sol d'un îlot (et du parvis du hub) au-dessus de l'eau. */
export const ISLET_TOP = 2.07;
/** Rayon du grand îlot central. */
export const HUB_RADIUS = 17;
/** Bord du parvis du hub : départ des ponts. */
export const HUB_EDGE = 14.6;
/** Point visé par la caméra quand on sélectionne le hub. */
export const HUB_POS: Vec3 = [0, ISLET_TOP + 4, 0];

// 16 emplacements sur deux anneaux. Les ponts de l'anneau extérieur passent entre
// les îlots de l'anneau intérieur (décalage de 22,5°).
export const ISLAND_SLOTS: Vec3[] = Array.from({ length: 16 }, (_, i) => {
  const inner = i < 8;
  const k = inner ? i : i - 8;
  const angle = (k / 8) * Math.PI * 2 + (inner ? Math.PI / 8 : 0);
  const radius = inner ? 36 : 56;
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
});

// Shells en arrière-plan, sur le parvis du hub, entre les départs de ponts.
export const STELE_SLOTS: Vec3[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
  return [Math.cos(a) * 12.4, ISLET_TOP, Math.sin(a) * 12.4];
});

// Sessions Claude Code ouvertes ailleurs, au-dessus du hub.
export const SESSION_SLOTS: Vec3[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  return [Math.cos(a) * 20, 16 + (i % 2) * 3, Math.sin(a) * 20];
});

/** Extrémités du pont d'un emplacement : bord du hub → bord de l'îlot. */
export const BRIDGE_ENDS: [Vec3, Vec3][] = ISLAND_SLOTS.map((pos) => {
  const len = Math.hypot(pos[0], pos[2]);
  const dx = pos[0] / len;
  const dz = pos[2] / len;
  const isleR = ISLET_RADIUS * 0.84;
  return [
    [dx * HUB_EDGE, ISLET_TOP + 0.1, dz * HUB_EDGE],
    [pos[0] - dx * isleR, ISLET_TOP + 0.1, pos[2] - dz * isleR],
  ];
});
