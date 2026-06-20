// src/main.ts
import './styles.css';
import { initialState, GameState } from './engine/state';
import { load, save } from './engine/save';
import { applyOffline } from './engine/offline';
import { AUTOSAVE_INTERVAL_MS } from './engine/content';
import { fmt } from './engine/num';
import { render } from './ui/render';
import { wireInput } from './ui/input';
import { wireShop } from './ui/shop';
import { wireGallery } from './ui/gallery';
import { startLoop } from './ui/rafLoop';

let state: GameState = load(Date.now()) ?? initialState(Date.now());

// Offline catch-up (also runs on a fresh save where elapsed == 0).
const { state: caughtUp, summary } = applyOffline(state, Date.now());
state = caughtUp;

const getState = (): GameState => state;
const setState = (s: GameState): void => {
  state = s;
  render(state);
};

render(state);
wireInput(getState, setState);
wireShop(getState, setState);
wireGallery(getState, setState);
startLoop(getState, setState, () => {});

// "While you were writing…" summary.
if (summary.seconds > 1) {
  const modal = document.getElementById('offline-modal')!;
  document.getElementById('offline-body')!.innerHTML =
    `While you were writing for ${Math.round(summary.seconds / 60)} min:<br>` +
    `✒️ +${fmt(summary.inspirationGained)} Inspiration<br>` +
    `📖 +${fmt(summary.wordsGained)} Words<br>` +
    `⚔️ ${summary.clears} encounters cleared`;
  modal.style.display = 'flex';
  document.getElementById('offline-close')!.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

// Persistence.
setInterval(() => save(state), AUTOSAVE_INTERVAL_MS);
window.addEventListener('beforeunload', () => save(state));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save(state);
});
