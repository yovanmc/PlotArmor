// src/ui/render.ts
import { GameState } from '../engine/state';
import { fmt, div, toNum } from '../engine/num';
import {
  ZONES, TARGETS_PER_BOOK,
  isBossIndex, targetName, targetEmoji, targetsClearedInBook, CLASSES, MAX_STAR, starUpCost,
} from '../engine/content';
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

  el('hud').innerHTML = `
    <div>Book #${state.bookNumber} — <strong>${zone.genre}</strong></div>
    <div>📜 Manuscript: ${progress}%</div>
    <div>✒️ Inspiration: <strong>${fmt(state.inspiration)}</strong></div>
    <div>📖 Words: ${fmt(state.words)}</div>
    <div>💰 Royalties: ${fmt(state.royalties)}</div>
    <div>✏️ Edits: ${fmt(state.edits)}</div>
    <div>⚔️ Party DPS: ${fmt(effectivePartyDps(state))}</div>`;

  el('enemy').innerHTML = `
    <div class="enemy-emoji">${targetEmoji(zoneIndex, encounterIndex)}</div>
    <div class="enemy-name">${targetName(zoneIndex, encounterIndex)} ${isBoss ? '<span class="boss-tag">BOSS</span>' : ''}</div>
    <div class="hpbar"><div class="hpfill" style="width:${hpPct}%"></div></div>
    <div class="hptext">${fmt(state.currentHp)} / ${fmt(maxHp)} HP${isBoss ? ` · regen ${fmt(effectiveBossRegen(state, zoneIndex, encounterIndex))}/s` : ''}</div>`;

  const cards = state.party
    .map((c) => {
      const stars = state.stars[c.classId];
      const isProtagonist = c.classId === 'protagonist';
      const starRow = isProtagonist
        ? '<div class="cstars">—</div>'
        : `<div class="cstars">${'★'.repeat(stars)}${'☆'.repeat(MAX_STAR - stars)}</div>`;
      const starBtn = (!isProtagonist && stars < MAX_STAR)
        ? `<button data-action="starup" data-class="${c.classId}" ${canStarUp(state, c.classId) ? '' : 'disabled'}>★ Up (✏️${fmt(starUpCost(stars))})</button>`
        : '';
      return `
      <div class="card">
        <div class="cemoji">✍️</div>
        <div class="cname">${c.name}</div>
        ${starRow}
        <div class="clevel">Lv ${c.level} · pow ${fmt(effectiveCharacterPower(state, c))}</div>
        <button data-action="level" data-id="${c.id}" ${canLevel(state, c.id) ? '' : 'disabled'}>Develop (✒️${fmt(effectiveLevelCost(state, c.level))})</button>
        ${starBtn}
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
