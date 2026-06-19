import { GameState } from '../engine/state';
import { levelUp, recruit } from '../engine/economy';
import { publish } from '../engine/progression';
import { exportSave, importSave } from '../engine/save';

export function wireInput(getState: () => GameState, setState: (s: GameState) => void): void {
  el('party').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'level') {
      const id = btn.getAttribute('data-id');
      if (id) setState(levelUp(getState(), id));
    } else if (action === 'recruit') {
      setState(recruit(getState()));
    }
  });

  el('publish').addEventListener('click', () => setState(publish(getState())));

  el('export').addEventListener('click', () => {
    const code = exportSave(getState());
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    window.prompt('Your save code (copy it somewhere safe):', code);
  });

  el('import').addEventListener('click', () => {
    const code = window.prompt('Paste a save code:');
    if (!code) return;
    try {
      setState(importSave(code.trim(), Date.now()));
    } catch {
      window.alert('That save code could not be read.');
    }
  });
}

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}
