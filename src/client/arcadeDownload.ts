/**
 * Environment-aware YOLO Arcade installer detection (#311).
 *
 * - Detects whether the user is on macOS (`osx`), Windows (`win`), or Android (`android`)
 *   and returns the matching direct installer download link from GitHub Releases.
 * - Returns `null` when the app is already running inside the installed Tauri shell
 *   (`__TAURI_INTERNALS__`, `__TAURI__`, `?shell=tauri`, or stored shell marker) or
 *   as an installed standalone PWA (`display-mode: standalone` / `navigator.standalone`).
 */

export type ArcadePlatform = 'macos' | 'windows' | 'android';

export interface ArcadeDownloadInfo {
  platform: ArcadePlatform;
  label: string;
  shortLabel: string;
  fileName: string;
  href: string;
}

export const ARCADE_RELEASE_DOWNLOAD_BASE =
  'https://github.com/normzhou/yolo-blank-canvas/releases/latest/download';

export const TAURI_SHELL_STORAGE_KEY = 'yolo:arcade-shell:v1';

/**
 * macOS System Settings deep link that opens Privacy & Security directly so
 * users can click "Open Anyway" after launching the unsigned .dmg app once (#321).
 */
export const MACOS_PRIVACY_SECURITY_DEEP_LINK =
  'x-apple.systempreferences:com.apple.preference.security?General';

/**
 * 1-command macOS Terminal quarantine bypass for `/Applications/yolo-arcade.app` (#321).
 */
export const MACOS_XATTR_BYPASS_COMMAND = 'xattr -cr /Applications/yolo-arcade.app';

export interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
  userAgentData?: {
    platform?: string;
  };
}

export interface WindowLike {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
  location?: {
    search?: string;
    protocol?: string;
    hostname?: string;
  };
  navigator?: NavigatorLike;
  matchMedia?: (query: string) => { matches: boolean } | null | undefined;
  sessionStorage?: {
    getItem?: (key: string) => string | null;
    setItem?: (key: string, value: string) => void;
  };
  localStorage?: {
    getItem?: (key: string) => string | null;
    setItem?: (key: string, value: string) => void;
  };
}

export function isInstalledArcadeApp(
  win: WindowLike | undefined = typeof window !== 'undefined' ? (window as unknown as WindowLike) : undefined,
): boolean {
  if (!win) return false;

  if (Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__)) {
    return true;
  }

  const protocol = win.location?.protocol ?? '';
  const hostname = win.location?.hostname ?? '';
  if (protocol === 'tauri:' || hostname === 'tauri.localhost') {
    return true;
  }

  const search = win.location?.search ?? '';
  if (search) {
    try {
      const params = new URLSearchParams(search);
      if (params.get('shell') === 'tauri') {
        try {
          win.sessionStorage?.setItem?.(TAURI_SHELL_STORAGE_KEY, 'tauri');
        } catch {
          // Ignore storage write errors
        }
        try {
          win.localStorage?.setItem?.(TAURI_SHELL_STORAGE_KEY, 'tauri');
        } catch {
          // Ignore storage write errors
        }
        return true;
      }
    } catch {
      // Ignore malformed query string
    }
  }

  try {
    if (win.sessionStorage?.getItem?.(TAURI_SHELL_STORAGE_KEY) === 'tauri') {
      return true;
    }
  } catch {
    // Ignore storage read errors
  }

  try {
    if (win.localStorage?.getItem?.(TAURI_SHELL_STORAGE_KEY) === 'tauri') {
      return true;
    }
  } catch {
    // Ignore storage read errors
  }

  const ua = win.navigator?.userAgent ?? '';
  if (/\bTauri\b|\byolo-arcade\b/i.test(ua)) {
    return true;
  }

  if (win.navigator?.standalone === true) {
    return true;
  }

  try {
    if (win.matchMedia?.('(display-mode: standalone)')?.matches === true) {
      return true;
    }
  } catch {
    // Ignore matchMedia errors
  }

  return false;
}

export function detectArcadePlatform(nav?: NavigatorLike): ArcadePlatform | null {
  if (!nav) return null;
  const ua = nav.userAgent ?? '';
  const platform = nav.userAgentData?.platform || nav.platform || '';

  if (/android/i.test(ua) || /android/i.test(platform)) {
    return 'android';
  }

  if (/iphone|ipad|ipod/i.test(ua) || /iphone|ipad|ipod/i.test(platform)) {
    return null;
  }

  // iPadOS 13+ desktop-class UA reports MacIntel with multi-touch
  if (/mac/i.test(platform) && (nav.maxTouchPoints ?? 0) > 2 && /mobile|safari/i.test(ua) && !/chrome|firefox/i.test(ua)) {
    return null;
  }

  if (/win/i.test(platform) || /windows|win64|win32|wow64/i.test(ua)) {
    return 'windows';
  }

  if (/mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) {
    return 'macos';
  }

  return null;
}

export function detectArcadeDownload(
  win: WindowLike | undefined = typeof window !== 'undefined' ? (window as unknown as WindowLike) : undefined,
): ArcadeDownloadInfo | null {
  if (!win || isInstalledArcadeApp(win)) {
    return null;
  }

  const platform = detectArcadePlatform(win.navigator);
  if (platform === 'macos') {
    return {
      platform: 'macos',
      label: 'Download YOLO Arcade for macOS (.dmg)',
      shortLabel: 'Download for macOS',
      fileName: 'yolo-arcade-macos.dmg',
      href: `${ARCADE_RELEASE_DOWNLOAD_BASE}/yolo-arcade-macos.dmg`,
    };
  }
  if (platform === 'windows') {
    return {
      platform: 'windows',
      label: 'Download YOLO Arcade for Windows (.exe)',
      shortLabel: 'Download for Windows',
      fileName: 'yolo-arcade-windows-setup.exe',
      href: `${ARCADE_RELEASE_DOWNLOAD_BASE}/yolo-arcade-windows-setup.exe`,
    };
  }
  if (platform === 'android') {
    return {
      platform: 'android',
      label: 'Download YOLO Arcade for Android (.apk)',
      shortLabel: 'Download for Android',
      fileName: 'yolo-arcade-android.apk',
      href: `${ARCADE_RELEASE_DOWNLOAD_BASE}/yolo-arcade-android.apk`,
    };
  }

  return null;
}
