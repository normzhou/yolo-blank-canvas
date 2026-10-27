/**
 * Shared game pause coordinator (#237, #242) so the universal YouTube-style
 * bottom-right pause/resume icon (`button.pause-launcher`) in `App.tsx` and
 * the in-game Pause Menu overlay in `TetrisView` / `PuzzleBobbleView` stay
 * synchronized.
 */

type PauseListener = (paused: boolean) => void;

let sharedPaused = false;
const listeners = new Set<PauseListener>();

export function getSharedGamePaused(): boolean {
  return sharedPaused;
}

export function setSharedGamePaused(next: boolean): void {
  if (sharedPaused === next) return;
  sharedPaused = next;
  for (const listener of listeners) {
    listener(sharedPaused);
  }
}

export function toggleSharedGamePaused(): boolean {
  setSharedGamePaused(!sharedPaused);
  return sharedPaused;
}

export function subscribeSharedGamePause(listener: PauseListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
