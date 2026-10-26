import { useCallback, useEffect, useState } from 'react';

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

/**
 * Returns true when the browser is in native Fullscreen API mode or the
 * document's default `data-fullscreen="true"` mode (#222, #228).
 * By default, the site starts in fullscreen mode (`data-fullscreen` is treated
 * as `'true'` unless explicitly set to `'false'`).
 */
export function isBrowserFullscreen(): boolean {
  if (typeof document === 'undefined') return true;
  const doc = document as WebkitDocument;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return true;
  return document.documentElement.getAttribute('data-fullscreen') !== 'false';
}

async function requestNativeFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  const root = document.documentElement as WebkitElement;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return true;
  try {
    if (typeof root.requestFullscreen === 'function') {
      await root.requestFullscreen({ navigationUI: 'hide' });
      return Boolean(doc.fullscreenElement);
    }
    if (typeof root.webkitRequestFullscreen === 'function') {
      await root.webkitRequestFullscreen();
      return Boolean(doc.webkitFullscreenElement);
    }
  } catch {
    // Browser may defer native fullscreen until a user gesture.
  }
  return false;
}

/**
 * Requests or exits browser full-screen mode (`requestFullscreen({ navigationUI: 'hide' })`
 * with `webkitRequestFullscreen` fallback). Must be called inside a user gesture
 * (`onClick`) so browsers like MS Edge, Chrome, Safari, and Firefox permit it.
 */
export async function toggleBrowserFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  const root = document.documentElement as WebkitElement;

  const currentlyFull = isBrowserFullscreen();
  if (currentlyFull) {
    root.setAttribute('data-fullscreen', 'false');
    try {
      if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
      } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // Ignore if browser already left fullscreen.
    }
    window.dispatchEvent(new Event('yolo:fullscreenchange'));
    return false;
  }

  root.setAttribute('data-fullscreen', 'true');
  const enteredNative = await requestNativeFullscreen();
  if (enteredNative) {
    root.setAttribute('data-fullscreen', 'native');
  }
  window.dispatchEvent(new Event('yolo:fullscreenchange'));
  return true;
}

export function useFullscreen(): {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
} {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document !== 'undefined' && !document.documentElement.hasAttribute('data-fullscreen')) {
      document.documentElement.setAttribute('data-fullscreen', 'true');
    }
    return isBrowserFullscreen();
  });

  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute('data-fullscreen')) {
      root.setAttribute('data-fullscreen', 'true');
    }
    if (isBrowserFullscreen()) {
      void requestNativeFullscreen().then((entered) => {
        if (entered) root.setAttribute('data-fullscreen', 'native');
      });
    }

    function sync() {
      setIsFullscreen(isBrowserFullscreen());
    }

    function onNativeChange() {
      const doc = document as WebkitDocument;
      const nativeFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (nativeFull) {
        root.setAttribute('data-fullscreen', 'native');
      } else if (root.getAttribute('data-fullscreen') === 'native') {
        root.setAttribute('data-fullscreen', 'false');
      }
      setIsFullscreen(isBrowserFullscreen());
    }

    // Upgrade to native browser fullscreen on the first user gesture while
    // default fullscreen is active (unless the gesture is on the fullscreen toggle itself).
    function onFirstGesture(event: Event) {
      if (!isBrowserFullscreen()) return;
      const target = event.target as Element | null;
      if (target?.closest?.('[data-testid="fullscreen-button"]')) return;
      const doc = document as WebkitDocument;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) return;
      void requestNativeFullscreen().then((entered) => {
        if (entered) root.setAttribute('data-fullscreen', 'native');
      });
    }

    document.addEventListener('fullscreenchange', onNativeChange);
    document.addEventListener('webkitfullscreenchange', onNativeChange);
    window.addEventListener('yolo:fullscreenchange', sync);
    window.addEventListener('pointerdown', onFirstGesture, { passive: true });
    return () => {
      document.removeEventListener('fullscreenchange', onNativeChange);
      document.removeEventListener('webkitfullscreenchange', onNativeChange);
      window.removeEventListener('yolo:fullscreenchange', sync);
      window.removeEventListener('pointerdown', onFirstGesture);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    void toggleBrowserFullscreen();
  }, []);

  return { isFullscreen, toggleFullscreen };
}
