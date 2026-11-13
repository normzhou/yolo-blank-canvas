/**
 * Shared game pause & YOLO overlay coordinator (#237, #242, #296, #352) so the
 * universal YouTube-style bottom-right pause/resume icon (`button.pause-launcher`)
 * in `App.tsx`, the in-game Pause Menu overlay in `PrismStackView` / `StarlightBurstView`,
 * and the YOLO feedback overlay (`<yolo-feedback-v1>` / `<Panel>`) stay synchronized.
 */

type PauseListener = (paused: boolean) => void;
type OverlayListener = (open: boolean) => void;

let sharedPaused = false;
let sharedOverlayOpen = false;
const listeners = new Set<PauseListener>();
const overlayListeners = new Set<OverlayListener>();

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

export function getSharedOverlayOpen(): boolean {
  return sharedOverlayOpen;
}

export function setSharedOverlayOpen(next: boolean): void {
  if (next) {
    setSharedGamePaused(true);
  }
  if (sharedOverlayOpen === next) return;
  sharedOverlayOpen = next;
  for (const listener of overlayListeners) {
    listener(sharedOverlayOpen);
  }
}

export function subscribeSharedOverlayOpen(listener: OverlayListener): () => void {
  overlayListeners.add(listener);
  return () => {
    overlayListeners.delete(listener);
  };
}
