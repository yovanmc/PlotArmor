// src/ui/render.ts
import { GameState } from '../engine/state';
import { fmt, div, toNum } from '../engine/num';
import {
  ZONES, TARGETS_PER_BOOK,
  isBossIndex, targetName, targetEmoji, targetsClearedInBook, CLASSES, MAX_STAR, starUpCost,
  WORLD_FACE, worldGenre, WORLD_SET_BONUS, AFFINITY_MAG,
} from '../engine/content';
import { unlockedWorldsFor, setBonusBreakdown } from '../engine/variants';
import {
  effectivePartyDps, effectiveLevelCost, effectiveRecruitCost, effectivePartyCap,
  effectiveTargetMaxHp, effectiveBossRegen, effectiveCharacterPower,
} from '../engine/modifiers';
import { canLevel, canRecruit, canStarUp } from '../engine/economy';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function render(state: GameState): void {
  const { zoneIndex, encounterIndex } = state.zone;
  const zone = ZONES[zoneIndex];
  document.body.style.setProperty('--bg', zone.bg);
  document.body.style.setProperty('--accent', zone.accent);

  const maxHp = effectiveTargetMaxHp(state, zoneIndex, encounterIndex);
  const hpPct = Math.max(0, Math.min(100, toNum(div(state.currentHp, maxHp)) * 100));
  const isBoss = isBossIndex(encounterIndex);
  const progress = state.bookComplete
    ? 100
    : Math.round((targetsClearedInBook(zoneIndex, encounterIndex) / TARGETS_PER_BOOK) * 100);

  const sets = setBonusBreakdown(state.party);
  const setLine = sets.length
    ? `<div>🎭 Sets: ${sets
        .map((s) => `${worldGenre(s.world)} ×${s.count} (+${Math.round(WORLD_SET_BONUS[s.world].tiers[s.tier - 1] * 100)}% ${WORLD_SET_BONUS[s.world].axis})`)
        .join(', ')}</div>`
    : '';

  const inElementCount = state.party.filter((c) => c.variantWorld !== null && c.variantWorld === zoneIndex).length;
  const affinityLine = inElementCount > 0
    ? `<div>✨ In element: ${inElementCount} (+${Math.round(AFFINITY_MAG * 100)}% each)</div>`
    : '';

  el('hud').innerHTML = `
    <div>Book #${state.bookNumber} — <strong>${zone.genre}</strong></div>
    <div>📜 Manuscript: ${progress}%</div>
    <div>✒️ Inspiration: <strong>${fmt(state.inspiration)}</strong></div>
    <div>📖 Words: ${fmt(state.words)}</div>
    <div>💰 Royalties: ${fmt(state.royalties)}</div>
    <div>✏️ Edits: ${fmt(state.edits)}</div>
    <div>⚔️ Party DPS: ${fmt(effectivePartyDps(state))}</div>
    ${setLine}
    ${affinityLine}`;

  el('enemy').innerHTML = `
    <div class="enemy-emoji">${targetEmoji(zoneIndex, encounterIndex)}</div>
    <div class="enemy-name">${targetName(zoneIndex, encounterIndex)} ${isBoss ? '<span class="boss-tag">BOSS</span>' : ''}</div>
    <div class="hpbar"><div class="hpfill" style="width:${hpPct}%"></div></div>
    <div class="hptext">${fmt(state.currentHp)} / ${fmt(maxHp)} HP${isBoss ? ` · regen ${fmt(effectiveBossRegen(state, zoneIndex, encounterIndex))}/s` : ''}</div>`;

  const cards = state.party
    .map((c) => {
      const stars = state.stars[c.classId];
      const isProtagonist = c.classId === 'protagonist';
      const starRow = `<div class="cstars">${'★'.repeat(stars)}${'☆'.repeat(MAX_STAR - stars)}</div>`;
      const starBtn = (!isProtagonist && stars < MAX_STAR)
        ? `<button data-action="starup" data-class="${c.classId}" ${canStarUp(state, c.classId) ? '' : 'disabled'}>★ Up (✏️${fmt(starUpCost(stars))})</button>`
        : '';

      const face = c.variantWorld !== null ? WORLD_FACE[c.variantWorld] : '✍️';
      const skinTag = c.variantWorld !== null ? `<div class="cskin">${worldGenre(c.variantWorld)}</div>` : '';
      const accentStyle = c.variantWorld !== null ? ` style="border-color:${ZONES[c.variantWorld].accent}"` : '';
      const inElement = c.variantWorld !== null && c.variantWorld === zoneIndex;
      const affinityTag = inElement ? `<div class="caffinity">✨ In element</div>` : '';
      const worlds = unlockedWorldsFor(state, c.classId);
      let variantBtn = '';
      if (worlds.length > 0) {
        const cycle: (number | null)[] = [null, ...worlds];
        const idx = cycle.findIndex((w) => w === c.variantWorld);
        const next = cycle[(idx + 1) % cycle.length];
        variantBtn = `<button data-action="variant" data-id="${c.id}" data-next="${next === null ? 'base' : next}">🎭 Skin</button>`;
      }

      return `
      <div class="card"${accentStyle}>
        <div class="cemoji">${face}</div>
        <div class="cname">${c.name}</div>
        ${skinTag}
        ${affinityTag}
        ${starRow}
        <div class="clevel">Lv ${c.level} · pow ${fmt(effectiveCharacterPower(state, c))}</div>
        <button data-action="level" data-id="${c.id}" ${canLevel(state, c.id) ? '' : 'disabled'}>Develop (✒️${fmt(effectiveLevelCost(state, c.level))})</button>
        ${starBtn}
        ${variantBtn}
      </div>`;
    })
    .join('');
  const recruitable = CLASSES.filter((cl) => cl.id !== 'protagonist');
  const recruitCard =
    state.party.length < effectivePartyCap(state)
      ? `<div class="card recruit">
           <div class="cemoji">➕</div>
           ${recruitable
             .map((cl) =>
               `<button data-action="recruit" data-class="${cl.id}" ${canRecruit(state) ? '' : 'disabled'}>` +
               `${cl.name} (✒️${fmt(effectiveRecruitCost(state, state.party.length))})</button>`)
             .join('')}
         </div>`
      : '';
  el('party').innerHTML = cards + recruitCard;

  el('publish').style.display = state.bookComplete ? 'block' : 'none';

  const shopOpen = document.getElementById('shop-open');
  if (shopOpen) shopOpen.textContent = `📖 Publishing House · 💰 ${fmt(state.royalties)}`;
}
