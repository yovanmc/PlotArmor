import { GameState } from '../engine/state';
import { step } from '../engine/loop';
import { TICK_SECONDS } from '../engine/content';

// Fixed-timestep accumulator decoupled from render. Big real-time gaps (tab
// backgrounded) are clamped here — long absences are handled by offline.applyOffline.
export function startLoop(
  getState: () => GameState,
  setState: (s: GameState) => void,
  onFrame: (s: GameState) => void,
): () => void {
  let last = performance.now();
  let acc = 0;
  let rafId = 0;

  const frame = (now: number) => {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 1) dt = 1; // clamp huge gaps
    acc += dt;

    let s = getState();
    while (acc >= TICK_SECONDS) {
      s = step(s, TICK_SECONDS).state;
      acc -= TICK_SECONDS;
    }
    setState(s);
    onFrame(s);
    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}
