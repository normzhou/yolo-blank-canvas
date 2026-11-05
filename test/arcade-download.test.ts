import { describe, expect, it } from 'vitest';
import {
  ARCADE_RELEASE_DOWNLOAD_BASE,
  detectArcadeDownload,
  detectArcadePlatform,
  isInstalledArcadeApp,
} from '../src/client/arcadeDownload';

describe('Environment-aware YOLO Arcade download detection (#311)', () => {
  it('detects macOS, Windows, and Android platforms from user-agent / platform', () => {
    expect(
      detectArcadePlatform({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        platform: 'MacIntel',
      }),
    ).toBe('macos');

    expect(
      detectArcadePlatform({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        platform: 'Win32',
      }),
    ).toBe('windows');

    expect(
      detectArcadePlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
        platform: 'Linux armv81',
      }),
    ).toBe('android');
  });

  it('returns the matching macOS .dmg, Windows .exe, and Android .apk download info when running in a browser', () => {
    const mac = detectArcadeDownload({
      navigator: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)',
        platform: 'MacIntel',
      },
    });
    expect(mac).toEqual({
      platform: 'macos',
      label: 'Download YOLO Arcade for macOS (.dmg)',
      shortLabel: 'Download for macOS',
      fileName: 'yolo-arcade-macos.dmg',
      href: `${ARCADE_RELEASE_DOWNLOAD_BASE}/yolo-arcade-macos.dmg`,
    });

    const win = detectArcadeDownload({
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        platform: 'Win32',
      },
    });
    expect(win).toEqual({
      platform: 'windows',
      label: 'Download YOLO Arcade for Windows (.exe)',
      shortLabel: 'Download for Windows',
      fileName: 'yolo-arcade-windows-setup.exe',
      href: `${ARCADE_RELEASE_DOWNLOAD_BASE}/yolo-arcade-windows-setup.exe`,
    });

    const android = detectArcadeDownload({
      navigator: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
        platform: 'Linux armv81',
      },
    });
    expect(android).toEqual({
      platform: 'android',
      label: 'Download YOLO Arcade for Android (.apk)',
      shortLabel: 'Download for Android',
      fileName: 'yolo-arcade-android.apk',
      href: `${ARCADE_RELEASE_DOWNLOAD_BASE}/yolo-arcade-android.apk`,
    });
  });

  it('returns null (hiding the download link) when already running inside Tauri or an installed standalone PWA', () => {
    // 1. Tauri runtime global
    expect(
      isInstalledArcadeApp({
        __TAURI_INTERNALS__: {},
        navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)', platform: 'MacIntel' },
      }),
    ).toBe(true);
    expect(
      detectArcadeDownload({
        __TAURI_INTERNALS__: {},
        navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)', platform: 'MacIntel' },
      }),
    ).toBeNull();

    // 2. ?shell=tauri query parameter (persisted across session)
    const store = new Map<string, string>();
    const sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    };
    expect(
      detectArcadeDownload({
        location: { search: '?shell=tauri' },
        sessionStorage,
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' },
      }),
    ).toBeNull();
    // Subsequent page load without query param still remembers Tauri shell from storage
    expect(
      detectArcadeDownload({
        location: { search: '' },
        sessionStorage,
        navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' },
      }),
    ).toBeNull();

    // 3. Standalone PWA display-mode
    expect(
      detectArcadeDownload({
        matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }),
        navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux armv81' },
      }),
    ).toBeNull();
  });
});
