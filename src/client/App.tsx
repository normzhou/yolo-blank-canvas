import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type IssueSummary, type SessionInfo } from './api';
import {
  getSharedArcadeAudio,
  getSharedMusicOn,
  setSharedMusicOn,
  subscribeSharedAudio,
} from './audio/tetrisMusic';
import {
  getSharedGamePaused,
  setSharedGamePaused,
  subscribeSharedGamePause,
  toggleSharedGamePaused,
} from './gamePause';
import { mountHostedYoloMark } from './brand/yoloMark';
import { useFullscreen } from './fullscreen';
import { Panel, type PanelView } from './components/Panel';
import { ErrorNotice } from './components/ErrorNotice';
import { CanvasPalette } from './components/CanvasPalette';
import { CANVAS_APPS, canvasAppById } from './apps/registry';
import { getSharedNetplay, type NetplayState } from './netplay';
import { BACKGROUNDS } from '../shared/tetrisBackgrounds';
import {
  PUZZLE_BOBBLE_PLAYLIST,
  SELECTOR_PLAYLIST,
  TETRIS_PLAYLIST,
} from '../shared/tetrisMusic';
import { useVisible } from './usePolling';
import { appContextLine } from './feedback';
import {
  NEW_REQUEST_KEY,
  browserStore,
  clearDraft,
  feedbackKey,
  loadDraft,
  loadNewRequestDraft,
  replyKey,
  saveDraft,
  type DraftStore,
  type NewRequestDraft,
  type TextDraft,
} from './drafts';
import {
  createNewRequestDraft,
  draftHasUserContent,
  draftIsEmpty,
  type RequestIntent,
} from './requestTemplates';
import { readRoute, routeUrl, type RouteTarget } from './route';

const CLIENT_BUILD: string = typeof __CLIENT_BUILD__ === 'string' ? __CLIENT_BUILD__ : '';

const EMPTY_DRAFT: TextDraft = { title: '', body: '' };

/** A cold deep link names a location but has no list row behind it. */
function toPanelView(target: RouteTarget, issue: IssueSummary | null = null): PanelView {
  if (target.name === 'detail') return { name: 'detail', issue, number: target.number };
  return { name: target.name };
}

type ComposerState = { key: string; draft: NewRequestDraft };
type PanelOpener = 'start' | 'feedback' | 'requests';

/**
 * The composer draft for a location (#169). The home composer keeps the
 * generic draft; an app gets its own key and, when that draft does not exist,
 * a fresh visible context line. `fresh` deliberately ignores storage so a
 * confirmed create can start the next request cleanly.
 */
function composerFor(
  store: DraftStore | null,
  appId: string | null,
  { fresh = false, intent }: { fresh?: boolean; intent?: RequestIntent } = {},
): ComposerState {
  const app = canvasAppById(appId);
  const key = app ? feedbackKey(app.id) : NEW_REQUEST_KEY;
  const fallback = createNewRequestDraft({
    intent: intent ?? (app ? 'feedback' : 'change'),
    context: app ? appContextLine(app) : '',
  });
  const loaded = !fresh && store ? loadNewRequestDraft(store, key, fallback) : null;
  return { key, draft: loaded ?? fallback };
}

/**
 * Rich miniature vector preview for each game on the home slide deck (#196, #240),
 * with a delayed fade-in animated gameplay loop showing the game being played.
 */
function DeckPreviewGraphic({ appId }: { appId: string }) {
  if (appId === 'tetris') {
    return (
      <div
        className="deck-preview-stage is-live-preview"
        data-testid="deck-live-preview"
        data-preview-game="tetris"
      >
        <img className="deck-preview-bg" src={BACKGROUNDS[0].src} alt="" aria-hidden="true" />
        <svg
          className="deck-preview-svg"
          viewBox="0 0 220 180"
          aria-hidden="true"
        >
          {/* Miniature 10-column matrix frame */}
          <rect
            x="46"
            y="12"
            width="128"
            height="156"
            rx="6"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          {/* Dashed ghost landing piece */}
          <g fill="none" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 2">
            <rect x="98" y="108" width="12" height="12" rx="2" />
            <rect x="86" y="120" width="12" height="12" rx="2" />
            <rect x="98" y="120" width="12" height="12" rx="2" />
            <rect x="110" y="120" width="12" height="12" rx="2" />
          </g>
          {/* Animated falling T-piece (delayed fade-in gameplay preview #240) */}
          <g
            className="deck-tetris-falling-piece"
            fill="var(--tetromino-t)"
            stroke="var(--text)"
            strokeWidth="1"
          >
            <rect x="98" y="28" width="12" height="12" rx="2" />
            <rect x="86" y="40" width="12" height="12" rx="2" />
            <rect x="98" y="40" width="12" height="12" rx="2" />
            <rect x="110" y="40" width="12" height="12" rx="2" />
          </g>
          {/* Settled bottom stack (I, L, S, O, J blocks) */}
          <g stroke="var(--text)" strokeWidth="1">
            <rect x="50" y="152" width="12" height="12" rx="2" fill="var(--tetromino-i)" />
            <rect x="62" y="152" width="12" height="12" rx="2" fill="var(--tetromino-i)" />
            <rect x="74" y="152" width="12" height="12" rx="2" fill="var(--tetromino-i)" />
            <rect x="86" y="152" width="12" height="12" rx="2" fill="var(--tetromino-i)" />
            <rect x="110" y="152" width="12" height="12" rx="2" fill="var(--tetromino-o)" />
            <rect x="122" y="152" width="12" height="12" rx="2" fill="var(--tetromino-o)" />
            <rect x="110" y="140" width="12" height="12" rx="2" fill="var(--tetromino-o)" />
            <rect x="122" y="140" width="12" height="12" rx="2" fill="var(--tetromino-o)" />
            <rect x="134" y="152" width="12" height="12" rx="2" fill="var(--tetromino-l)" />
            <rect x="146" y="152" width="12" height="12" rx="2" fill="var(--tetromino-l)" />
            <rect x="158" y="152" width="12" height="12" rx="2" fill="var(--tetromino-l)" />
            <rect x="158" y="140" width="12" height="12" rx="2" fill="var(--tetromino-l)" />
            <rect x="50" y="140" width="12" height="12" rx="2" fill="var(--tetromino-s)" />
            <rect x="62" y="140" width="12" height="12" rx="2" fill="var(--tetromino-s)" />
            <rect x="62" y="128" width="12" height="12" rx="2" fill="var(--tetromino-s)" />
            <rect x="74" y="128" width="12" height="12" rx="2" fill="var(--tetromino-s)" />
          </g>
          {/* Line-clear pulse highlight */}
          <rect
            className="deck-tetris-line-flash"
            x="48"
            y="151"
            width="124"
            height="14"
            rx="2"
            fill="var(--tetromino-o)"
          />
        </svg>
        <div className="deck-preview-hud">
          <span>10×20 Matrix</span>
          <span>6 Scenes · 5 FM/Chip Tracks</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="deck-preview-stage is-live-preview"
      data-testid="deck-live-preview"
      data-preview-game="puzzle-bobble"
    >
      <img className="deck-preview-bg" src={BACKGROUNDS[1].src} alt="" aria-hidden="true" />
      <svg
        className="deck-preview-svg"
        viewBox="0 0 220 180"
        aria-hidden="true"
      >
        <rect
          x="26"
          y="12"
          width="168"
          height="156"
          rx="6"
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        {/* Hexagonal bubble wave with glossy arcade highlights */}
        <g stroke="var(--text)" strokeWidth="1.1">
          {[
            { cx: 52, cy: 30, fill: 'var(--tetromino-z)' },
            { cx: 72, cy: 30, fill: 'var(--tetromino-z)' },
            { cx: 92, cy: 30, fill: 'var(--tetromino-l)' },
            { cx: 112, cy: 30, fill: 'var(--tetromino-l)' },
            { cx: 132, cy: 30, fill: 'var(--tetromino-s)' },
            { cx: 152, cy: 30, fill: 'var(--tetromino-j)' },
            { cx: 172, cy: 30, fill: 'var(--tetromino-j)' },
            { cx: 62, cy: 48, fill: 'var(--tetromino-z)' },
            { cx: 82, cy: 48, fill: 'var(--tetromino-t)' },
            { cx: 102, cy: 48, fill: 'var(--tetromino-l)' },
            { cx: 122, cy: 48, fill: 'var(--tetromino-s)' },
            { cx: 142, cy: 48, fill: 'var(--tetromino-s)' },
            { cx: 162, cy: 48, fill: 'var(--tetromino-i)' },
            { cx: 92, cy: 66, fill: 'var(--tetromino-t)' },
            { cx: 132, cy: 66, fill: 'var(--tetromino-i)' },
          ].map((b, idx) => (
            <g key={idx}>
              <circle cx={b.cx} cy={b.cy} r="10" fill={b.fill} />
              <ellipse
                cx={b.cx - 3.2}
                cy={b.cy - 3.4}
                rx="2.8"
                ry="1.7"
                transform={`rotate(-28 ${b.cx - 3.2} ${b.cy - 3.4})`}
                fill="var(--on-accent)"
                stroke="none"
                opacity="0.85"
              />
            </g>
          ))}
        </g>
        {/* Wall-bounce sight line */}
        <polyline
          points="110,146 182,92 132,66"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.8"
          strokeDasharray="4 3"
        />
        {/* Animated flying bubble & cluster pop ring (#240) */}
        <circle
          className="deck-pb-flying-bubble"
          cx="132"
          cy="84"
          r="9.5"
          fill="var(--tetromino-i)"
          stroke="var(--text)"
          strokeWidth="1.1"
        />
        <circle
          className="deck-pb-pop-ring"
          cx="132"
          cy="66"
          r="14"
          fill="none"
          stroke="var(--tetromino-o)"
          strokeWidth="2"
        />
        {/* Launcher gear & animated pointer */}
        <circle cx="110" cy="146" r="14" fill="var(--field)" stroke="var(--text)" strokeWidth="1.2" />
        <g className="deck-pb-aim-sweep">
          <polygon points="110,122 105,134 115,134" fill="var(--warning-weak)" stroke="var(--text)" strokeWidth="1" />
        </g>
        <circle cx="110" cy="146" r="9" fill="var(--tetromino-i)" stroke="var(--text)" strokeWidth="1.1" />
        {/* Cute P1 Dragon & P2 Cat mascots flanking the launcher */}
        <g transform="translate(72, 149)" stroke="var(--text)" strokeWidth="0.9">
          <polygon points="-5,-9 -10,-12 -8,-6" fill="var(--tetromino-l)" />
          <polygon points="-6,-3 -11,-5 -9,0" fill="var(--tetromino-l)" />
          <polygon points="-5,3 -10,2 -7,6" fill="var(--tetromino-l)" />
          <ellipse cx="0" cy="2" rx="6.5" ry="7" fill="var(--tetromino-s)" />
          <ellipse cx="1.5" cy="3" rx="3.8" ry="4.5" fill="var(--on-accent)" stroke="none" opacity="0.88" />
          <circle cx="0" cy="-6" r="5.8" fill="var(--tetromino-s)" />
          <circle cx="-1" cy="-6.8" r="1.3" fill="var(--on-accent)" stroke="none" />
          <circle cx="-0.8" cy="-6.8" r="0.7" fill="var(--text)" stroke="none" />
          <circle cx="2.5" cy="-6.8" r="1.3" fill="var(--on-accent)" stroke="none" />
          <circle cx="2.7" cy="-6.8" r="0.7" fill="var(--text)" stroke="none" />
        </g>
        <g transform="translate(148, 149)" stroke="var(--text)" strokeWidth="0.9">
          <path d="M 6 4 Q 12 2 11 -4" fill="none" stroke="var(--tetromino-l)" strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="-4,-10 -2,-15 1,-10" fill="var(--tetromino-l)" />
          <polygon points="1,-10 4,-15 6,-10" fill="var(--tetromino-l)" />
          <ellipse cx="0" cy="2" rx="6.5" ry="7" fill="var(--tetromino-l)" />
          <ellipse cx="-1.2" cy="3" rx="3.8" ry="4.5" fill="var(--on-accent)" stroke="none" opacity="0.88" />
          <circle cx="0" cy="-6" r="5.8" fill="var(--tetromino-l)" />
          <circle cx="-2.4" cy="-6.8" r="1.3" fill="var(--on-accent)" stroke="none" />
          <circle cx="-2.6" cy="-6.8" r="0.7" fill="var(--text)" stroke="none" />
          <circle cx="1.1" cy="-6.8" r="1.3" fill="var(--on-accent)" stroke="none" />
          <circle cx="0.9" cy="-6.8" r="0.7" fill="var(--text)" stroke="none" />
        </g>
      </svg>
      <div className="deck-preview-hud">
        <span>1P Bub (ASDF) vs 2P Bob (Arrows)</span>
        <span>0.5° Aim · 60fps</span>
      </div>
    </div>
  );
}

/**
 * YouTube-video style Pause / Play icon (#237):
 * - When `isPaused` is false, renders two vertical pause bars.
 * - When `isPaused` is true, renders a play triangle.
 */
function PausePlayIcon({ isPaused }: { isPaused: boolean }) {
  return (
    <svg
      className="pause-play-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {isPaused ? (
        <polygon points="6 4 20 12 6 20 6 4" />
      ) : (
        <>
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </>
      )}
    </svg>
  );
}

/**
 * Official `yolo-dev` Threefold symbol (`viewBox="0 0 96 96"`, `#d84b27`, three
 * 120° square-capped arms `<path d="M48 48v30" />`) with `mountHostedYoloMark`
 * hover/hold-to-spin radial density-disk motion and `https://yolo-dev.ai/feedback/v1.mjs`
 * live channel upgrade (#217, #282).
 */
function YoloRotatingLogo({
  testId,
  onActivate,
}: { testId?: string; onActivate?: () => void } = {}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const trigger = svg.closest('button') ?? svg;
    const controller = mountHostedYoloMark(svg, {
      trigger,
      onActivate: () => onActivateRef.current?.(),
    });
    return () => controller.destroy();
  }, []);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 96"
      className="yolo-mark yolo-logo-mark"
      data-testid={testId}
      aria-hidden="true"
    >
      <g
        className="yolo-mark__motion"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="square"
      >
        <path d="M48 48v30" />
        <path d="M48 48v30" transform="rotate(120 48 48)" />
        <path d="M48 48v30" transform="rotate(240 48 48)" />
      </g>
    </svg>
  );
}

/**
 * YouTube-video style speaker / sound icon (#234):
 * - When `isMuted` is true, renders speaker cone with a diagonal mute slash.
 * - When `isMuted` is false, renders speaker cone with dual radiating sound waves.
 */
function SoundSpeakerIcon({ isMuted }: { isMuted: boolean }) {
  return (
    <svg
      className="sound-speaker-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="currentColor" />
      {isMuted ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : (
        <>
          <path d="M 15.54 8.46 a 5 5 0 0 1 0 7.07" />
          <path d="M 19.07 4.93 a 10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}

/**
 * YouTube-video style 4-corner bracket fullscreen icon (#228):
 * - When `isFullscreen` is true, renders 4 inward-pointing corner brackets (exit full screen).
 * - When `isFullscreen` is false, renders 4 outward-pointing corner brackets (enter full screen).
 */
function FullscreenCornerIcon({ isFullscreen }: { isFullscreen: boolean }) {
  return (
    <svg
      className="fullscreen-corner-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {isFullscreen ? (
        <>
          <path d="M 3 8 H 8 V 3" />
          <path d="M 16 3 V 8 H 21" />
          <path d="M 21 16 H 16 V 21" />
          <path d="M 8 21 V 16 H 3" />
        </>
      ) : (
        <>
          <path d="M 3 9 V 3 H 9" />
          <path d="M 15 3 H 21 V 9" />
          <path d="M 21 15 V 21 H 15" />
          <path d="M 9 21 H 3 V 15" />
        </>
      )}
    </svg>
  );
}

/**
 * Subtle dynamic background visual effects (#198): ambient architectural grid
 * lines, soft drifting aura rings, and floating arcade geometry using only
 * theme tokens so Slate, Sand, and Dusk all paint it naturally.
 */
function CanvasAmbientEffects() {
  return (
    <svg
      className="canvas-ambient"
      data-testid="canvas-ambient"
      viewBox="0 0 1200 720"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Subtle architectural grid lines & crosshairs */}
      <g stroke="var(--border)" strokeWidth="1" opacity="0.32">
        <line x1="0" y1="140" x2="1200" y2="140" strokeDasharray="4 8" />
        <line x1="0" y1="360" x2="1200" y2="360" strokeDasharray="4 8" />
        <line x1="0" y1="580" x2="1200" y2="580" strokeDasharray="4 8" />
        <line x1="220" y1="0" x2="220" y2="720" strokeDasharray="4 8" />
        <line x1="600" y1="0" x2="600" y2="720" strokeDasharray="4 8" />
        <line x1="980" y1="0" x2="980" y2="720" strokeDasharray="4 8" />
      </g>

      {/* Soft drifting ambient aura orbs & rings */}
      <g className="ambient-orb ambient-orb-1">
        <circle cx="210" cy="190" r="145" fill="var(--accent-weak)" opacity="0.38" />
        <circle
          cx="210"
          cy="190"
          r="185"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="6 6"
          opacity="0.55"
        />
        {/* Subtle floating tetromino motif */}
        <g fill="var(--tetromino-t)" opacity="0.22" transform="translate(150, 130)">
          <rect x="0" y="16" width="14" height="14" rx="3" />
          <rect x="16" y="16" width="14" height="14" rx="3" />
          <rect x="32" y="16" width="14" height="14" rx="3" />
          <rect x="16" y="0" width="14" height="14" rx="3" />
        </g>
      </g>

      <g className="ambient-orb ambient-orb-2">
        <circle cx="990" cy="520" r="165" fill="var(--accent-weak)" opacity="0.34" />
        <circle
          cx="990"
          cy="520"
          r="210"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="8 6"
          opacity="0.5"
        />
        {/* Subtle floating bubble-cluster motif */}
        <g fill="var(--tetromino-i)" opacity="0.22" transform="translate(1015, 455)">
          <circle cx="0" cy="0" r="9" />
          <circle cx="19" cy="0" r="9" />
          <circle cx="9.5" cy="16.5" r="9" />
        </g>
      </g>

      <g className="ambient-orb ambient-orb-3">
        <circle cx="940" cy="155" r="90" fill="var(--neutral-weak)" opacity="0.55" />
        <circle cx="250" cy="555" r="105" fill="var(--neutral-weak)" opacity="0.55" />
      </g>
    </svg>
  );
}

export function App() {
  const storeRef = useRef<DraftStore | null>(null);
  if (storeRef.current === null) storeRef.current = browserStore();
  const store = storeRef.current;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionError, setSessionError] = useState<ApiError | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => readRoute(window.location.search).open);
  const [appId, setAppId] = useState<string | null>(() => readRoute(window.location.search).app);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [view, setView] = useState<PanelView>(() => toPanelView(readRoute(window.location.search).target));
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(() => composerFor(storeRef.current, appId));
  // Requests created in this session, kept until GitHub's list confirms them.
  const [createdIssues, setCreatedIssues] = useState<IssueSummary[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, TextDraft>>({});
  const [serverClientBuild, setServerClientBuild] = useState<string | null>(null);
  const [reloadPromptDismissed, setReloadPromptDismissed] = useState(false);
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [musicOn, setMusicOn] = useState<boolean>(() => getSharedMusicOn());
  const [nowPlaying, setNowPlaying] = useState<string | null>(
    () => getSharedArcadeAudio().getCurrentTrack()?.title ?? null,
  );
  const [gamePaused, setGamePaused] = useState<boolean>(() => getSharedGamePaused());
  const [netplay, setNetplay] = useState<NetplayState>(() => getSharedNetplay().getState());
  const [deckDragOffsetX, setDeckDragOffsetX] = useState<number>(0);

  useEffect(() => {
    return subscribeSharedAudio((nextOn, nextTitle) => {
      setMusicOn(nextOn);
      setNowPlaying(nextTitle);
    });
  }, []);

  useEffect(() => {
    return subscribeSharedGamePause((nextPaused) => {
      setGamePaused(nextPaused);
    });
  }, []);

  useEffect(() => {
    const client = getSharedNetplay();
    return client.subscribe((nextState) => {
      setNetplay(nextState);
    });
  }, []);

  useEffect(() => {
    setSharedGamePaused(Boolean(appId && !getSharedNetplay().getState().activeRoom));
    getSharedNetplay().setCurrentApp(appId);
  }, [appId]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const feedbackTriggerRef = useRef<HTMLButtonElement>(null);
  const deckNavRef = useRef<HTMLElement>(null);
  const appRegionRef = useRef<HTMLElement>(null);
  const panelOpenerRef = useRef<PanelOpener | null>(null);
  const deckSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const deckDidSwipeRef = useRef(false);

  const activeApp = canvasAppById(appId);
  const [slideIndex, setSlideIndex] = useState<number>(() => {
    const idx = CANVAS_APPS.findIndex((a) => a.id === appId);
    return idx >= 0 ? idx : 0;
  });
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [slideTick, setSlideTick] = useState(0);

  useEffect(() => {
    if (!appId) return;
    const idx = CANVAS_APPS.findIndex((a) => a.id === appId);
    if (idx >= 0) setSlideIndex(idx);
  }, [appId]);

  const deckLen = CANVAS_APPS.length;
  const currentSlide = CANVAS_APPS[slideIndex] ?? CANVAS_APPS[0];
  const nextSlideIndex = deckLen > 0 ? (slideIndex + 1) % deckLen : 0;
  const prevSlideIndex = deckLen > 0 ? (((slideIndex - 1) % deckLen) + deckLen) % deckLen : 0;
  const nextSlide = CANVAS_APPS[nextSlideIndex] ?? currentSlide;
  const prevSlide = CANVAS_APPS[prevSlideIndex] ?? currentSlide;

  // #234, #240: Crossfade into the active or selected game's own soundtrack
  // (Tetris vs Puzzle Bobble) both inside the game and on the selection menu!
  const activeMusicGameId = appId ?? currentSlide.id;
  useEffect(() => {
    const audio = getSharedArcadeAudio();
    const targetPlaylist =
      activeMusicGameId === 'puzzle-bobble'
        ? PUZZLE_BOBBLE_PLAYLIST
        : activeMusicGameId === 'tetris'
          ? TETRIS_PLAYLIST
          : SELECTOR_PLAYLIST;
    audio.setPlaylist(targetPlaylist);
    if (appId === null) {
      audio.setActive(getSharedMusicOn());
    }
    setNowPlaying(audio.getCurrentTrack()?.title ?? null);
  }, [activeMusicGameId, appId]);

  const stepSlide = useCallback(
    (delta: number) => {
      const len = CANVAS_APPS.length;
      if (len === 0) return;
      const nextIdx = (((slideIndex + delta) % len) + len) % len;
      setSlideDirection(delta >= 0 ? 'next' : 'prev');
      setSlideTick((t) => t + 1);
      setSlideIndex(nextIdx);
      if (appId !== null) {
        const nextApp = CANVAS_APPS[nextIdx];
        if (nextApp) {
          window.history.pushState(null, '', routeUrl(null, window.location.pathname, nextApp.id));
          setPanelOpen(false);
          setView({ name: 'list' });
          setAppId(nextApp.id);
        }
      }
    },
    [appId, slideIndex],
  );

  const refreshToken = useVisible(panelOpen);

  const connect = useCallback(async () => {
    setConnecting(true);
    setSessionError(null);
    try {
      const info = await api.connect();
      setSession(info);
      return info;
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : new ApiError(0, { kind: 'server_error', message: 'Unexpected error.' });
      setSessionError(error);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    void connect();
    void api
      .version()
      .then((info) => setServerClientBuild(info.clientBuild))
      .catch(() => setServerClientBuild(null));
  }, [connect]);

  useEffect(() => {
    if (!store) return;
    if (draftIsEmpty(composer.draft)) clearDraft(store, composer.key);
    else saveDraft(store, composer.key, composer.draft);
  }, [composer, store]);

  const draftFor = useCallback(
    (issueNumber: number) => {
      if (replyDrafts[issueNumber]) return replyDrafts[issueNumber];
      const loaded = store ? loadDraft(store, replyKey(issueNumber)) : null;
      return loaded ?? EMPTY_DRAFT;
    },
    [replyDrafts, store],
  );

  const setReplyDraft = useCallback(
    (issueNumber: number, next: { title: string; body: string }) => {
      setReplyDrafts((previous) => ({ ...previous, [issueNumber]: next }));
      if (store) {
        if (next.body.trim() === '' && next.title.trim() === '') clearDraft(store, replyKey(issueNumber));
        else saveDraft(store, replyKey(issueNumber), next);
      }
    },
    [store],
  );

  const setNewDraft = useCallback((next: NewRequestDraft) => {
    setComposer((previous) => ({ ...previous, draft: next }));
  }, []);

  const navigate = useCallback(
    (target: RouteTarget | null, issue: IssueSummary | null = null) => {
      window.history.pushState(null, '', routeUrl(target, window.location.pathname, appId));
      if (target === null) {
        setPanelOpen(false);
        setView({ name: 'list' });
        return;
      }
      setPanelOpen(true);
      setView(toPanelView(target, issue));
    },
    [appId],
  );

  const openApp = useCallback((id: string | null) => {
    window.history.pushState(null, '', routeUrl(null, window.location.pathname, id));
    setPanelOpen(false);
    setView({ name: 'list' });
    if (id && !getSharedNetplay().getState().activeRoom) {
      setSharedGamePaused(true);
    }
    setAppId(id);
  }, []);

  const exitApp = useCallback(() => {
    void getSharedNetplay().leaveRoom();
    void getSharedNetplay().cancelInvite();
    openApp(null);
  }, [openApp]);

  const lastOpenedRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    const room = netplay.activeRoom;
    if (!room) {
      lastOpenedRoomIdRef.current = null;
      return;
    }
    if (lastOpenedRoomIdRef.current !== room.id) {
      lastOpenedRoomIdRef.current = room.id;
      if (appId !== room.gameId) {
        openApp(room.gameId);
      }
    }
  }, [netplay.activeRoom, appId, openApp]);

  useEffect(() => {
    const onPopState = () => {
      const route = readRoute(window.location.search);
      setAppId(route.app);
      setPaletteOpen(false);
      if (!route.open) {
        setPanelOpen(false);
        setView({ name: 'list' });
        return;
      }
      if (route.target.name === 'new') {
        setComposer((current) => {
          const next = composerFor(store, route.app);
          return current.key === next.key && !draftIsEmpty(current.draft) ? current : next;
        });
      }
      setPanelOpen(true);
      setView(toPanelView(route.target));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [store]);

  const enterRequests = useCallback(
    async (destination: RouteTarget, issue: IssueSummary | null = null) => {
      if (!session) {
        if (sessionError?.kind === 'static_demo') {
          navigate(destination, issue);
          return;
        }
        const info = await connect();
        if (!info) return;
      }
      navigate(destination, issue);
    },
    [connect, navigate, session, sessionError?.kind],
  );

  const openPanel = useCallback(() => {
    void enterRequests({ name: 'list' });
  }, [enterRequests]);

  const openNewRequest = useCallback(
    (intent?: RequestIntent) => {
      setComposer((current) => {
        const next = composerFor(store, appId, { intent });
        if (current.key !== next.key) return next;
        if (intent && !draftHasUserContent(current.draft) && current.draft.intent !== intent) {
          return { key: current.key, draft: { ...current.draft, intent } };
        }
        return current;
      });
      void enterRequests({ name: 'new' });
    },
    [appId, enterRequests, store],
  );

  const closePanel = useCallback(() => {
    const opener = panelOpenerRef.current;
    panelOpenerRef.current = null;
    navigate(null);
    window.requestAnimationFrame(() => {
      const byOpener =
        opener === 'start'
          ? triggerRef.current
          : opener === 'feedback'
            ? feedbackTriggerRef.current
            : null;
      const fallback = activeApp ? feedbackTriggerRef.current : triggerRef.current;
      (byOpener ?? fallback)?.focus();
    });
  }, [activeApp, navigate]);

  const openPalette = useCallback(() => {
    if (panelOpen) {
      panelOpenerRef.current = null;
      window.history.pushState(null, '', routeUrl(null, window.location.pathname, appId));
      setPanelOpen(false);
      setView({ name: 'list' });
    }
    setPaletteOpen(true);
  }, [appId, panelOpen]);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    const activePill = deckNavRef.current?.querySelector<HTMLButtonElement>('button.deck-pill.is-active');
    (activePill ?? triggerRef.current ?? feedbackTriggerRef.current)?.focus();
  }, []);

  const selectApp = useCallback(
    (id: string | null) => {
      setPaletteOpen(false);
      if (id !== appId) openApp(id);
      window.requestAnimationFrame(() => {
        (id ? appRegionRef.current : triggerRef.current)?.focus();
      });
    },
    [appId, openApp],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable),
      );
      const modified = event.metaKey || event.ctrlKey;
      const paletteShortcut = modified && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
      const tildeShortcut = !modified && !event.altKey && event.key === '~' && !editing;
      if (!paletteShortcut && !tildeShortcut) return;
      event.preventDefault();
      if (paletteOpen) closePalette();
      else openPalette();
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [closePalette, openPalette, paletteOpen]);

  // #198: Keyboard-driven slide deck navigation on the home canvas:
  // ArrowLeft / ArrowRight flip between slides, and Enter / Space launch the
  // active slide's game when focus is not inside a text field, overlay, or
  // another action button.
  useEffect(() => {
    if (activeApp !== null || panelOpen || paletteOpen) return;
    function onDeckKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const editing = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable),
      );
      if (editing) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepSlide(1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepSlide(-1);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        const interactive = target?.closest('button, a, [role="button"]');
        if (interactive && !interactive.classList.contains('deck-play-button')) {
          return;
        }
        event.preventDefault();
        openApp(currentSlide.id);
      }
    }
    window.addEventListener('keydown', onDeckKeyDown);
    return () => window.removeEventListener('keydown', onDeckKeyDown);
  }, [activeApp, currentSlide.id, openApp, paletteOpen, panelOpen, stepSlide]);

  async function disconnect() {
    try {
      await api.disconnect();
    } catch {
      // The local session ends even if the request failed.
    }
    setSession(null);
    setPanelOpen(false);
  }

  const currentDraft = view.name === 'detail' ? draftFor(view.number) : EMPTY_DRAFT;
  const serverSuggestsReload =
    Boolean(CLIENT_BUILD) &&
    Boolean(serverClientBuild) &&
    serverClientBuild !== 'unknown' &&
    serverClientBuild !== CLIENT_BUILD;

  const isStaticDemo = sessionError?.kind === 'static_demo';
  const showSessionError = Boolean(sessionError && !isStaticDemo);
  const showPanel = panelOpen && Boolean(session || isStaticDemo);
  const canvasClass = [
    'canvas',
    showPanel ? 'panel-open' : '',
    activeApp ? 'is-playing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={canvasClass}>
      {!activeApp ? <h1 className="sr-only canvas-title">Blank canvas</h1> : null}

      {/* #220, #228, #230, #234: No top bar — bare wiggling YOLO Threefold symbol
          in the top-right corner to open the full YOLO feedback & requests overlay,
          plus YouTube-style transparent sound on/off and fullscreen icons in the
          bottom-right corner. */}
      {!showPanel ? (
        <>
          <button
            type="button"
            className="yolo-launcher yolo-fab-button"
            data-testid="yolo-feedback-fab"
            ref={activeApp ? feedbackTriggerRef : triggerRef}
            aria-label={activeApp ? `Feedback on ${activeApp.title}` : 'Open requests'}
            title={activeApp ? `Give feedback on ${activeApp.title}` : 'YOLO feedback & requests'}
            disabled={connecting}
          >
            <YoloRotatingLogo
              testId="yolo-rotating-logo"
              onActivate={() => {
                if (activeApp) {
                  panelOpenerRef.current = 'feedback';
                  openNewRequest('feedback');
                } else {
                  panelOpenerRef.current = 'start';
                  openPanel();
                }
              }}
            />
          </button>
          <div
            className="online-presence-pill"
            data-testid="online-presence-pill"
            role="status"
            aria-label={`${netplay.onlineCount} ${netplay.onlineCount === 1 ? 'player' : 'players'} online`}
            title={`Online players (${netplay.onlineCount}): ${netplay.players.map((p) => p.name).join(', ')}`}
          >
            <span className="netplay-online-dot" aria-hidden="true" />
            <span className="online-presence-count">{netplay.onlineCount} online</span>
          </div>
          {activeApp ? (
            <button
              type="button"
              className="pause-launcher"
              data-testid="pause-button"
              aria-pressed={gamePaused}
              aria-label={gamePaused ? 'Resume' : 'Pause'}
              title={gamePaused ? 'Resume game (Esc)' : 'Pause game (Esc)'}
              onClick={() => {
                toggleSharedGamePaused();
              }}
            >
              <PausePlayIcon isPaused={gamePaused} />
              <span className="sr-only">{gamePaused ? 'Resume' : 'Pause'}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="sound-launcher"
            data-testid="sound-button"
            aria-pressed={musicOn}
            aria-label={musicOn ? 'Music on' : 'Music off'}
            title={
              musicOn
                ? `Sound on${nowPlaying ? ` · ${nowPlaying}` : ''} (click to mute)`
                : 'Sound off (click to unmute)'
            }
            onClick={() => {
              const targetPlaylist =
                activeMusicGameId === 'puzzle-bobble'
                  ? PUZZLE_BOBBLE_PLAYLIST
                  : activeMusicGameId === 'tetris'
                    ? TETRIS_PLAYLIST
                    : SELECTOR_PLAYLIST;
              getSharedArcadeAudio().setPlaylist(targetPlaylist);
              setSharedMusicOn(!musicOn, true);
            }}
          >
            <SoundSpeakerIcon isMuted={!musicOn} />
            <span className="sr-only">{musicOn ? 'Music on' : 'Music off'}</span>
          </button>
          <button
            type="button"
            className="fullscreen-launcher"
            data-testid="fullscreen-button"
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={toggleFullscreen}
          >
            <FullscreenCornerIcon isFullscreen={isFullscreen} />
            <span className="sr-only">{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        </>
      ) : null}

      {/* #236: Non-obtrusive corner invite notification toast so players can keep
          playing solo or browsing and accept or dismiss a 2P Online match at will. */}
      {!netplay.activeRoom && netplay.openInvites.length > 0 ? (
        <aside
          className="netplay-toast-stack"
          aria-label="Online 2P game invitations"
          data-testid="netplay-invite-toast"
        >
          {netplay.openInvites.slice(0, 2).map((invite) => {
            const gameTitle = invite.gameId === 'puzzle-bobble' ? 'Puzzle Bobble' : 'Tetris';
            return (
              <div key={invite.id} className="netplay-toast" role="status">
                <div className="netplay-toast-copy">
                  <span className="netplay-toast-kicker">
                    <span className="netplay-online-dot" aria-hidden="true" />
                    2P Online Challenge
                  </span>
                  <span className="netplay-toast-title">
                    <strong>{invite.hostName}</strong> wants to play <strong>{gameTitle}</strong>
                  </span>
                </div>
                <div className="netplay-toast-actions">
                  <button
                    type="button"
                    className="primary netplay-toast-accept"
                    data-testid="netplay-accept-invite"
                    onClick={async () => {
                      const room = await getSharedNetplay().acceptInvite(invite);
                      if (room) {
                        openApp(room.gameId);
                      }
                    }}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="netplay-toast-dismiss"
                    data-testid="netplay-dismiss-invite"
                    aria-label="Ignore invite"
                    onClick={() => void getSharedNetplay().dismissInvite(invite.id)}
                  >
                    Ignore
                  </button>
                </div>
              </div>
            );
          })}
        </aside>
      ) : null}

      {serverSuggestsReload && !reloadPromptDismissed ? (
        <div className="banner warning" role="status">
          <span>
            App version changed — reload to use the version this server is running.
            {serverClientBuild ? (
              <span className="build-id">
                server {serverClientBuild.slice(0, 7)} · page {CLIENT_BUILD.slice(0, 7)}
              </span>
            ) : null}
          </span>
          <span className="row">
            <button
              type="button"
              className="primary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload
            </button>
            <button type="button" onClick={() => setReloadPromptDismissed(true)}>
              Not now
            </button>
          </span>
        </div>
      ) : null}

      {showSessionError ? (
        <ErrorNotice error={sessionError} onRetry={() => void connect()} retryLabel="Retry connection" />
      ) : null}

      <main className="canvas-deck" aria-label="Game slide deck">
        <CanvasAmbientEffects />
        {activeApp ? (
          <section className="canvas-app" aria-label={activeApp.title} tabIndex={-1} ref={appRegionRef}>
            <activeApp.element onExit={exitApp} />
          </section>
        ) : (
          <div className="deck-stack" data-testid="deck-stack">
            <section
              key={`${currentSlide.id}-${slideTick}`}
              className={
                slideDirection === 'next'
                  ? 'deck-slide-card is-sliding-next'
                  : slideDirection === 'prev'
                    ? 'deck-slide-card is-sliding-prev'
                    : 'deck-slide-card'
              }
              style={
                deckDragOffsetX !== 0
                  ? {
                      transform: `translateX(${deckDragOffsetX}px) rotate(${(
                        deckDragOffsetX * 0.035
                      ).toFixed(2)}deg)`,
                    }
                  : undefined
              }
              data-testid="deck-slide-card"
              data-slide-id={currentSlide.id}
              data-slide-dir={slideDirection ?? 'none'}
              role="button"
              tabIndex={0}
              aria-label={`Play ${currentSlide.title}`}
              onClick={(event) => {
                if (deckDidSwipeRef.current) {
                  deckDidSwipeRef.current = false;
                  return;
                }
                if ((event.target as HTMLElement | null)?.closest('.deck-nav')) {
                  return;
                }
                openApp(currentSlide.id);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openApp(currentSlide.id);
                }
              }}
              onPointerDown={(event) => {
                deckDidSwipeRef.current = false;
                deckSwipeStartRef.current = { x: event.clientX, y: event.clientY };
                setDeckDragOffsetX(0);
              }}
              onPointerMove={(event) => {
                const start = deckSwipeStartRef.current;
                if (!start) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                  setDeckDragOffsetX(Math.max(-120, Math.min(120, Math.round(dx * 0.55))));
                }
              }}
              onPointerUp={(event) => {
                const start = deckSwipeStartRef.current;
                deckSwipeStartRef.current = null;
                setDeckDragOffsetX(0);
                if (!start) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.1) {
                  deckDidSwipeRef.current = true;
                  stepSlide(dx < 0 ? 1 : -1);
                }
              }}
              onPointerCancel={() => {
                deckSwipeStartRef.current = null;
                setDeckDragOffsetX(0);
              }}
              onTouchStart={(event) => {
                const t = event.touches[0];
                if (!t) return;
                deckDidSwipeRef.current = false;
                deckSwipeStartRef.current = { x: t.clientX, y: t.clientY };
                setDeckDragOffsetX(0);
              }}
              onTouchMove={(event) => {
                const start = deckSwipeStartRef.current;
                const t = event.touches[0];
                if (!start || !t) return;
                const dx = t.clientX - start.x;
                const dy = t.clientY - start.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                  setDeckDragOffsetX(Math.max(-120, Math.min(120, Math.round(dx * 0.55))));
                }
              }}
              onTouchEnd={(event) => {
                const start = deckSwipeStartRef.current;
                deckSwipeStartRef.current = null;
                setDeckDragOffsetX(0);
                const t = event.changedTouches[0];
                if (!start || !t) return;
                const dx = t.clientX - start.x;
                const dy = t.clientY - start.y;
                if (Math.abs(dx) >= 36 && Math.abs(dx) > Math.abs(dy) * 1.1) {
                  deckDidSwipeRef.current = true;
                  stepSlide(dx < 0 ? 1 : -1);
                }
              }}
            >
              <DeckPreviewGraphic appId={currentSlide.id} />

              <div className="deck-slide-info">
                <div className="deck-slide-meta">
                  <span className="deck-slide-badge">
                    0{slideIndex + 1} / 0{CANVAS_APPS.length} ·{' '}
                    {currentSlide.id === 'tetris' ? '1P & 2P Online' : '2P Online, Versus & Solo'}
                  </span>
                  <span className="deck-slide-tag" data-testid="deck-online-count">
                    <span className="netplay-online-dot" aria-hidden="true" />
                    {netplay.onlineCount} Online
                  </span>
                </div>

                <div className="deck-slide-title">{currentSlide.title}</div>
                <p className="deck-slide-summary">{currentSlide.summary}</p>

                {currentSlide.id === 'tetris' ? (
                  <div className="deck-controls-grid" aria-label="Tetris controls">
                    <div className="deck-control-item">
                      <span className="deck-key-group">
                        <kbd>←</kbd>
                        <kbd>→</kbd>
                      </span>
                      <span className="deck-control-label">Move</span>
                    </div>
                    <div className="deck-control-item">
                      <span className="deck-key-group">
                        <kbd>↑</kbd>
                      </span>
                      <span className="deck-control-label">Rotate</span>
                    </div>
                    <div className="deck-control-item">
                      <span className="deck-key-group">
                        <kbd>↓</kbd>
                      </span>
                      <span className="deck-control-label">Soft drop</span>
                    </div>
                    <div className="deck-control-item">
                      <span className="deck-key-group">
                        <kbd>Space</kbd>
                      </span>
                      <span className="deck-control-label">Hard drop</span>
                    </div>
                  </div>
                ) : (
                  <div className="deck-controls-grid" aria-label="Puzzle Bobble controls">
                    <div className="deck-control-item">
                      <span className="deck-key-group">
                        <kbd>A</kbd>
                        <kbd>D</kbd>
                        <kbd>S</kbd>
                        <kbd>F</kbd>
                      </span>
                      <span className="deck-control-label">1P Bub · Aim & Shoot</span>
                    </div>
                    <div className="deck-control-item">
                      <span className="deck-key-group">
                        <kbd>←</kbd>
                        <kbd>→</kbd>
                        <kbd>↑</kbd>
                        <kbd>↓</kbd>
                      </span>
                      <span className="deck-control-label">2P Bob · Aim & Shoot</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* #264: Standard horizontal carousel indicator dots at the bottom for mouse-driven navigation */}
            <nav
              className="canvas-gallery carousel-dots"
              aria-label="Canvas gallery"
              data-testid="carousel-dots"
              ref={deckNavRef}
            >
              {CANVAS_APPS.map((app, index) => (
                <button
                  key={app.id}
                  type="button"
                  className={slideIndex === index ? 'carousel-dot is-active' : 'carousel-dot'}
                  data-testid={`carousel-dot-${app.id}`}
                  aria-label={app.title}
                  aria-current={slideIndex === index ? 'true' : undefined}
                  title={app.title}
                  onClick={() => {
                    if (index !== slideIndex) {
                      setSlideDirection(index > slideIndex ? 'next' : 'prev');
                      setSlideTick((t) => t + 1);
                      setSlideIndex(index);
                    }
                  }}
                >
                  <span className="sr-only">{app.title}</span>
                </button>
              ))}
            </nav>
          </div>
        )}
      </main>

      {paletteOpen ? (
        <CanvasPalette
          apps={CANVAS_APPS}
          activeAppId={activeApp?.id ?? null}
          onSelect={selectApp}
          onClose={closePalette}
        />
      ) : null}

      {showPanel ? (
        <Panel
          session={session}
          sessionError={isStaticDemo ? sessionError : null}
          onRetrySession={() => void connect()}
          view={view}
          filter={filter}
          onFilterChange={setFilter}
          onClose={closePanel}
          onSelect={(issue: IssueSummary) => navigate({ name: 'detail', number: issue.number }, issue)}
          onSelectIssueNumber={(number: number) => navigate({ name: 'detail', number }, null)}
          onCreated={(issue) => {
            setCreatedIssues((previous) => [...previous.filter((item) => item.number !== issue.number), issue]);
            setComposer(composerFor(store, appId, { fresh: true }));
          }}
          onNew={() => openNewRequest('change')}
          onCancelNew={() => navigate({ name: 'list' })}
          onBack={() => navigate({ name: 'list' })}
          newDraft={composer.draft}
          onNewDraftChange={setNewDraft}
          clientBuild={CLIENT_BUILD}
          createdIssues={createdIssues}
          replyDraft={currentDraft}
          onReplyDraftChange={(next) => {
            if (view.name === 'detail') setReplyDraft(view.number, next);
          }}
          refreshToken={refreshToken}
          lastRefreshedAt={lastRefreshedAt}
          stale={stale}
          onRefreshed={setLastRefreshedAt}
          onStale={setStale}
          onDisconnect={() => void disconnect()}
        />
      ) : null}
    </div>
  );
}
