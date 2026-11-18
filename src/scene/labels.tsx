// Étiquettes (DOM) communes à tous les thèmes, et utilitaires de clic sur les objets 3D.
// Un thème les place où il veut ; leur style vient de styles.css (variables CSS surchargeables).
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { STATUS_COLOR, STATUS_LABEL, ago, cut, duration } from '../format';
import { useStore } from '../store';
import type { Session, Shell } from '../types';
import type { Boat } from './boats';
import type { WorkerInfo } from './info';
import type { Vec3 } from './slots';

// Calque DOM fixe où drei <Html> place toutes les étiquettes. Sans lui, le conteneur par défaut
// change juste après le premier rendu et une étiquette montée à ce moment-là reste vide (React 19).
export const labelLayer: { current: HTMLDivElement } = { current: null as unknown as HTMLDivElement };

/** Props à étaler sur un `<group>` pour le rendre cliquable (curseur main au survol). */
export function clickable(onClick: () => void) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onClick();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => (document.body.style.cursor = ''),
  };
}

/** Sélectionne le hub et ouvre le terminal. */
export function openHub() {
  const st = useStore.getState();
  st.select({ kind: 'hub', id: 'hub' });
  st.setTerminal(true);
}

/** Sélectionne un agent ou une tâche à partir de sa clé (`agent:<id>`, `task:<id>`). */
export function selectKey(key: string) {
  if (key.startsWith('ambient:')) return;
  const [kind, ...rest] = key.split(':');
  useStore.getState().select({ kind: kind as 'agent' | 'task', id: rest.join(':') });
}

function Label({ position, children }: { position: Vec3; children: React.ReactNode }) {
  return (
    <Html position={position} center zIndexRange={[40, 0]} portal={labelLayer}>
      {children}
    </Html>
  );
}

/** Étiquette de Claude, au-dessus du hub. Masquée quand on regarde autre chose de près. */
export function HubLabel({ position }: { position: Vec3 }) {
  const busy = useStore((s) => s.hub.busy);
  const connected = useStore((s) => s.connected);
  const words = useStore((s) => s.theme?.words);
  const focusElsewhere = useStore((s) => !!s.selection && s.selection.kind !== 'hub');
  if (focusElsewhere || !words) return null;
  return (
    <Label position={position}>
      <div className={`hub-label ${busy ? 'busy' : ''}`} onClick={openHub}>
        <div className="hub-name">CLAUDE</div>
        <div className="hub-state">{!connected ? words.disconnected : busy ? words.hubBusy : words.hubIdle}</div>
      </div>
    </Label>
  );
}

/** Étiquette d'un agent ou d'une tâche, au-dessus de son îlot. */
export function WorkerLabel({ info, position }: { info: WorkerInfo; position: Vec3 }) {
  const running = info.status === 'running';
  const full = running || info.selected;
  return (
    <Label position={position}>
      <div className={`isle-label ${info.selected ? 'selected' : ''} ${full ? '' : 'mini'}`} style={{ ['--c' as string]: info.color }} onClick={info.onClick}>
        <div className="isle-badge">
          {info.badge} <span>{STATUS_LABEL[info.status]}</span>
        </div>
        <div className="isle-title">{cut(info.title, full ? 46 : 28)}</div>
        {full && (
          <>
            <div className="isle-sub">
              {info.subtitle} · {duration(info.startedAt, info.endedAt ?? undefined)} · {info.toolUses} outils
            </div>
            {info.activity && <div className="isle-act">{cut(info.activity, 54)}</div>}
          </>
        )}
      </div>
    </Label>
  );
}

/** Étiquette d'une session Claude Code ouverte ailleurs. */
export function SessionLabel({ session, selected, position }: { session: Session; selected: boolean; position: Vec3 }) {
  const live = Date.now() - session.lastActivity < 30e3;
  return (
    <Label position={position}>
      <div className={`sat-label ${selected ? 'selected' : ''} ${session.active ? 'active' : ''}`} onClick={() => useStore.getState().select({ kind: 'session', id: session.id })}>
        <div className="sat-project">{session.project}</div>
        <div className="sat-title">{cut(session.title || session.lastPrompt || 'session', 34)}</div>
        {(live || selected) && <div className="sat-tool">{live && session.lastTool ? cut(session.lastTool, 40) : ago(session.lastActivity)}</div>}
      </div>
    </Label>
  );
}

/** Étiquette d'un shell en arrière-plan (affichée seulement s'il tourne ou s'il est sélectionné). */
export function ShellLabel({ shell, selected, position }: { shell: Shell; selected: boolean; position: Vec3 }) {
  const running = shell.status === 'running';
  if (!running && !selected) return null;
  const lastLine = shell.tail.replace(/\s+$/, '').split('\n').at(-1) || '…';
  return (
    <Label position={position}>
      <div className={`pipe-label ${selected ? 'selected' : ''}`} style={{ ['--c' as string]: STATUS_COLOR[shell.status] }} onClick={() => useStore.getState().select({ kind: 'shell', id: shell.id })}>
        <div className="pipe-cmd">
          <span className="pill">{STATUS_LABEL[shell.status]}</span> {cut(shell.description || shell.command, 32)}
        </div>
        {running && <div className="pipe-out">{cut(lastLine, 42)}</div>}
      </div>
    </Label>
  );
}

/** Étiquette d'un ancien agent qui dérive (à afficher au survol ou s'il est sélectionné). */
export function BoatLabel({ boat, selected, position }: { boat: Boat; selected: boolean; position: Vec3 }) {
  const words = useStore((s) => s.theme?.words);
  return (
    <Label position={position}>
      <div className={`isle-label boat ${selected ? 'selected' : ''}`} style={{ ['--c' as string]: STATUS_COLOR[boat.status] }} onClick={() => selectKey(boat.key)}>
        <div className="isle-badge">
          {words?.boat} <span>{STATUS_LABEL[boat.status]}</span>
        </div>
        <div className="isle-title">{cut(boat.title, 40)}</div>
        <div className="isle-sub">
          {boat.subtitle}
          {boat.endedAt ? ` · ${ago(boat.endedAt)}` : ''}
        </div>
      </div>
    </Label>
  );
}

/** Dessine l'activité d'un agent sur un canvas (tablette, écran, rouleau…), aux couleurs du thème. */
export function drawActivity(
  ctx: CanvasRenderingContext2D,
  info: WorkerInfo,
  style: { bg: string; border: string; title: string; text: string; dim: string; titleFont: string; font: string },
) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = style.title;
  ctx.font = style.titleFont;
  ctx.textAlign = 'center';
  ctx.fillText(cut(info.title, 30).toUpperCase(), w / 2, 52);
  ctx.textAlign = 'left';
  ctx.font = style.font;
  const lines = (info.recent.length ? info.recent : [info.activity || '…']).slice(-5);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 ? style.text : style.dim;
    ctx.fillText('› ' + cut(l, 40), 30, 100 + i * 36);
  });
  ctx.fillStyle = style.dim;
  ctx.fillText(`${info.toolUses} outils · ${duration(info.startedAt, info.endedAt ?? undefined)}`, 30, h - 20);
}

/** Dernières lignes de la sortie d'un shell, coupées à `cols` caractères (pour l'écrire sur un canvas). */
export function tailLines(shell: Shell, cols: number, max: number) {
  const lines = shell.tail
    .replace(/\s+$/, '')
    .split('\n')
    .slice(-30)
    .flatMap((l) => (l ? l.match(new RegExp(`.{1,${cols}}`, 'g'))! : ['']))
    .slice(-max);
  if (!lines.length) lines.push('…');
  return lines;
}
