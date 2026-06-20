// src/ui/gallery.ts
import { GameState, Character } from '../engine/state';
import { CLASSES, ClassId, MAX_STAR, WORLD_FACE, worldGenre, ZONES } from '../engine/content';
import { setVariant } from '../engine/variants';
import { ICON, starPips } from './icons';

const WORLD_COUNT = WORLD_FACE.length;

// Which class the detail pane is showing. Module-local UI state, preserved across
// re-renders (equipping re-renders but keeps you on the same character).
let selectedClass: ClassId = 'protagonist';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function fieldedOf(state: GameState, classId: ClassId): Character | undefined {
  return state.party.find((c) => c.classId === classId);
}

function pips(n: number): string {
  return starPips(n, MAX_STAR);
}

export function renderGallery(state: GameState): void {
  const collected = CLASSES.reduce((sum, c) => sum + state.unlockedVariants[c.id].length, 0);
  const total = CLASSES.length * WORLD_COUNT;

  const list = CLASSES.map((c) => {
    const fielded = fieldedOf(state, c.id);
    const face = fielded && fielded.variantWorld !== null ? WORLD_FACE[fielded.variantWorld] : ICON.baseFace;
    const count = state.unlockedVariants[c.id].length;
    const sel = c.id === selectedClass ? ' gal-row-sel' : '';
    return `
      <div class="gal-row${sel}" data-action="select" data-class="${c.id}">
        <span class="gal-face">${face}</span>
        <span class="gal-row-info">
          <span class="gal-name">${c.name}</span>
          <span class="gal-stars">${pips(state.stars[c.id])}</span>
        </span>
        <span class="gal-count">${count}/${WORLD_COUNT}</span>
      </div>`;
  }).join('');

  const sel = CLASSES.find((c) => c.id === selectedClass)!;
  const fielded = fieldedOf(state, selectedClass);
  const worn = fielded ? fielded.variantWorld : null;
  const unlocked = state.unlockedVariants[selectedClass];

  const baseWorn = !!fielded && worn === null;
  const baseTile = `
    <button class="gal-tile${baseWorn ? ' gal-tile-worn' : ''}" data-action="equip" data-world="base" ${fielded ? '' : 'disabled'}>
      <span class="gal-tile-face">${ICON.baseFace}</span>
      <span class="gal-tile-label">Base</span>
      ${baseWorn ? `<span class="gal-spark">${ICON.worn}</span>` : ''}
    </button>`;

  const worldTiles = WORLD_FACE.map((face, w) => {
    const isUnlocked = unlocked.includes(w);
    const isWorn = !!fielded && worn === w;
    const canEquip = isUnlocked && !!fielded;
    return `
      <button class="gal-tile${isUnlocked ? '' : ' gal-tile-locked'}${isWorn ? ' gal-tile-worn' : ''}"
              data-action="equip" data-world="${w}" ${canEquip ? '' : 'disabled'}
              ${isUnlocked ? `style="border-color:${ZONES[w].accent}"` : ''}>
        <span class="gal-tile-face">${face}</span>
        <span class="gal-tile-label">${worldGenre(w)}</span>
        ${isUnlocked ? '' : `<span class="gal-lock">${ICON.locked}</span>`}
        ${isWorn ? `<span class="gal-spark">${ICON.worn}</span>` : ''}
      </button>`;
  }).join('');

  const caption = !fielded
    ? `Recruit the ${sel.name} to wear its skins.`
    : worn === null
      ? `Wearing the base look — no zone affinity.`
      : `Wearing ${worldGenre(worn)} ${WORLD_FACE[worn]} — in element in ${worldGenre(worn)} zones.`;

  el('collection-body').innerHTML = `
    <div class="gal-head">
      <span class="gal-title">Collection</span>
      <span class="gal-completion">${collected} / ${total} skins</span>
    </div>
    <div class="gal-bar"><div class="gal-bar-fill" style="width:${total ? (collected / total) * 100 : 0}%"></div></div>
    <div class="gal-body">
      <div class="gal-list">${list}</div>
      <div class="gal-detail">
        <div class="gal-detail-head">${sel.name} <span class="gal-stars">${pips(state.stars[selectedClass])}</span></div>
        <div class="gal-tiles">${baseTile}${worldTiles}</div>
        <div class="gal-caption">${caption}</div>
      </div>
    </div>`;
}

export function wireGallery(getState: () => GameState, setState: (s: GameState) => void): void {
  const modal = el('collection-modal');

  el('collection-open').addEventListener('click', () => {
    renderGallery(getState());
    modal.style.display = 'flex';
  });

  el('collection-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  el('collection-body').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const selBtn = target.closest('[data-action="select"]');
    if (selBtn) {
      selectedClass = selBtn.getAttribute('data-class') as ClassId;
      renderGallery(getState());
      return;
    }

    const equipBtn = target.closest('button[data-action="equip"]') as HTMLButtonElement | null;
    if (!equipBtn || equipBtn.disabled) return;
    const fielded = getState().party.find((c) => c.classId === selectedClass);
    if (!fielded) return;
    const worldAttr = equipBtn.getAttribute('data-world');
    const world = worldAttr === 'base' ? null : Number(worldAttr);
    setState(setVariant(getState(), fielded.id, world));
    renderGallery(getState());
  });
}
