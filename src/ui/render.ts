import { GameState } from '../engine/state';
import { fmt, div, toNum } from '../engine/num';
import {
  ZONES, RECRUIT_CAP, TARGETS_PER_BOOK,
  isBossIndex, targetMaxHp, targetName, targetEmoji, targetRegen, targetsClearedInBook,
} from '../engine/content';
import { partyDps, characterPower, levelCost, recruitCost, canLevel, canRecruit } from '../engine/economy';

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function render(state: GameState): void {
  const { zoneIndex, encounterIndex } = state.zone;
  const zone = ZONES[zoneIndex];
  document.body.style.setProperty('--bg', zone.bg);
  document.body.style.setProperty('--accent', zone.accent);

  const maxHp = targetMaxHp(zoneIndex, encounterIndex);
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
    <div>💰 Royalties: ${fmt(state.royalties)} (×${fmt(state.prestigeMultiplier)})</div>
    <div>⚔️ Party DPS: ${fmt(partyDps(state))}</div>`;

  el('enemy').innerHTML = `
    <div class="enemy-emoji">${targetEmoji(zoneIndex, encounterIndex)}</div>
    <div class="enemy-name">${targetName(zoneIndex, encounterIndex)} ${isBoss ? '<span class="boss-tag">BOSS</span>' : ''}</div>
    <div class="hpbar"><div class="hpfill" style="width:${hpPct}%"></div></div>
    <div class="hptext">${fmt(state.currentHp)} / ${fmt(maxHp)} HP${isBoss ? ` · regen ${fmt(targetRegen(zoneIndex, encounterIndex))}/s` : ''}</div>`;

  const cards = state.party
    .map(
      (c) => `
      <div class="card">
        <div class="cemoji">✍️</div>
        <div class="cname">${c.name}</div>
        <div class="clevel">Lv ${c.level} · pow ${fmt(characterPower(c))}</div>
        <button data-action="level" data-id="${c.id}" ${canLevel(state, c.id) ? '' : 'disabled'}>Develop (✒️${fmt(levelCost(c.level))})</button>
      </div>`,
    )
    .join('');
  const recruitCard =
    state.party.length < RECRUIT_CAP
      ? `<div class="card recruit"><div class="cemoji">➕</div><button data-action="recruit" ${canRecruit(state) ? '' : 'disabled'}>Introduce character (✒️${fmt(recruitCost(state.party.length))})</button></div>`
      : '';
  el('party').innerHTML = cards + recruitCard;

  el('publish').style.display = state.bookComplete ? 'block' : 'none';
}
