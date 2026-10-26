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
 * document's fallback `data-fullscreen="true"` mode (#222).
 */
export function isBrowserFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return true;
  return document.documentElement.getAttribute('data-fullscreen') === 'true';
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
    root.removeAttribute('data-fullscreen');
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

  let enteredNative = false;
  try {
    if (typeof root.requestFullscreen === 'function') {
      await root.requestFullscreen({ navigationUI: 'hide' });
      enteredNative = Boolean(doc.fullscreenElement);
    } else if (typeof root.webkitRequestFullscreen === 'function') {
      await root.webkitRequestFullscreen();
      enteredNative = Boolean(doc.webkitFullscreenElement);
    }
  } catch {
    enteredNative = false;
  }

  root.setAttribute('data-fullscreen', 'true');
  if (!enteredNative) {
    window.dispatchEvent(new Event('yolo:fullscreenchange'));
  }
  return true;
}

export function useFullscreen(): {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
} {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => isBrowserFullscreen());

  useEffect(() => {
    function sync() {
      const doc = document as WebkitDocument;
      const nativeFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!nativeFull && document.documentElement.getAttribute('data-fullscreen') === 'native') {
        document.documentElement.removeAttribute('data-fullscreen');
      }
      setIsFullscreen(isBrowserFullscreen());
    }
    function onNativeChange() {
      const doc = document as WebkitDocument;
      const nativeFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (nativeFull) {
        document.documentElement.setAttribute('data-fullscreen', 'native');
      } else {
        document.documentElement.removeAttribute('data-fullscreen');
      }
      setIsFullscreen(isBrowserFullscreen());
    }
    document.addEventListener('fullscreenchange', onNativeChange);
    document.addEventListener('webkitfullscreenchange', onNativeChange);
    window.addEventListener('yolo:fullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', onNativeChange);
      document.removeEventListener('webkitfullscreenchange', onNativeChange);
      window.removeEventListener('yolo:fullscreenchange', sync);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    void toggleBrowserFullscreen();
  }, []);

  return { isFullscreen, toggleFullscreen };
}
