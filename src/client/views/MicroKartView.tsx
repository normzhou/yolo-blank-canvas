import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  getSharedArcadeAudio,
  getSharedMusicOn,
  getSharedSfxOn,
  setSharedMusicOn,
  setSharedSfxOn,
  subscribeSharedAudio,
} from '../audio/arcadeAudio';
import {
  getSharedGamePaused,
  getSharedOverlayOpen,
  setSharedGamePaused,
  subscribeSharedGamePause,
  subscribeSharedOverlayOpen,
  toggleSharedGamePaused,
} from '../gamePause';
import {
  getSharedNetplay,
  INVITE_TIMEOUT_MS,
  type NetplayState,
} from '../netplay';
import {
  pickCountdownLanguage,
  type CountdownLanguage,
} from '../../shared/countdownLanguages';
import { MICRO_KART_PLAYLIST } from '../../shared/arcadeMusic';
import {
  applyRemoteKartSnapshot,
  CIRCUIT_LIST,
  CIRCUITS,
  createRaceState,
  formatRaceClock,
  getKartDriverSpec,
  getRecommendedSpeedAtS,
  KART_DRIVERS,
  MAX_STRAIGHT_SPEED,
  ordinalPlace,
  speedToColorHex,
  stepRaceState,
  toKartNetSnapshot,
  TOTAL_LAPS,
  type CircuitId,
  type DriverCharacterId,
  type KartNetSnapshot,
  type KartRaceMode,
  type KartRaceState,
  type ThrusterInput,
} from '../../shared/microKart';
import {
  createChaseCamera,
  renderKartViewport,
  updateChaseCamera,
  type ChaseCamera,
} from '../../games/micro-kart/renderer3d';
import { MicroKartWebGL2Renderer } from '../../games/micro-kart/rendererWebGL2';
import { MicroKartSynth } from '../../games/micro-kart/kartAudio';

const COUNTDOWN_READY_MS =
  typeof navigator !== 'undefined' && navigator.webdriver ? 180 : 950;
const COUNTDOWN_GO_MS =
  typeof navigator !== 'undefined' && navigator.webdriver ? 140 : 600;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

interface HudTelemetry {
  driverName: string;
  place: number;
  lap: number;
  kmh: number;
  speedMps: number;
  recommendedSpeedMps: number;
  yawRate: number;
  driftCharge: number;
  boostTimer: number;
  boostKind: string;
  leftPct: number;
  rightPct: number;
  turnLeftOn: boolean;
  turnRightOn: boolean;
  brakeOn: boolean;
  bestLapMs: number | null;
  finishMs: number | null;
}

function arcSegmentPath(cx: number, cy: number, r: number, frac0: number, frac1: number): string {
  const a0 = Math.PI * (1 - frac0);
  const a1 = Math.PI * (1 - frac1);
  const x0 = cx + Math.cos(a0) * r;
  const y0 = cy - Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy - Math.sin(a1) * r;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

const SPEEDO_BANDS: ReadonlyArray<{ readonly f0: number; readonly f1: number; readonly color: string }> = [
  { f0: 0, f1: 0.55, color: '#38e8ff' },
  { f0: 0.55, f1: 0.72, color: '#34d399' },
  { f0: 0.72, f1: 0.86, color: '#facc15' },
  { f0: 0.86, f1: 0.94, color: '#fb923c' },
  { f0: 0.94, f1: 1.0, color: '#ff5666' },
];

const F1Speedometer = memo(function F1Speedometer({
  speedMps,
  recommendedSpeedMps,
  kmh,
}: {
  speedMps: number;
  recommendedSpeedMps: number;
  kmh: number;
}) {
  const frac = Math.max(0, Math.min(1, speedMps / MAX_STRAIGHT_SPEED));
  const recFrac = Math.max(0, Math.min(1, recommendedSpeedMps / MAX_STRAIGHT_SPEED));
  const curColor = speedToColorHex(speedMps);
  const recColor = speedToColorHex(recommendedSpeedMps);

  const cx = 68;
  const cy = 64;
  const r = 50;
  const needleAng = Math.PI * (1 - frac);
  const nx = cx + Math.cos(needleAng) * (r - 8);
  const ny = cy - Math.sin(needleAng) * (r - 8);

  const recAng = Math.PI * (1 - recFrac);
  const tx = cx + Math.cos(recAng) * r;
  const ty = cy - Math.sin(recAng) * r;

  return (
    <div
      className="kart-speedometer"
      data-testid="kart-p1-speedometer"
      data-speed-color={curColor}
      data-target-kmh={Math.round(recommendedSpeedMps * 3.6)}
      aria-label={`Speed ${kmh} kilometers per hour, corner target ${Math.round(recommendedSpeedMps * 3.6)}`}
    >
      <svg viewBox="0 0 136 76" width="136" height="76" aria-hidden="true">
        {SPEEDO_BANDS.map((b) => (
          <path
            key={b.f0}
            d={arcSegmentPath(cx, cy, r, b.f0, b.f1)}
            fill="none"
            stroke={b.color}
            strokeWidth="8"
            strokeLinecap="butt"
            opacity="0.32"
          />
        ))}
        {frac > 0.01 ? (
          <path
            d={arcSegmentPath(cx, cy, r, 0, frac)}
            fill="none"
            stroke={curColor}
            strokeWidth="8"
            strokeLinecap="round"
          />
        ) : null}
        <circle cx={tx} cy={ty} r="5.5" fill={recColor} stroke="#0f172a" strokeWidth="2" />
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={curColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill={curColor} />
        <text
          x={cx}
          y={cy - 14}
          textAnchor="middle"
          fill={curColor}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="18"
          fontWeight="800"
        >
          {kmh}
        </text>
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fill="#94a3b8"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="8.5"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          KM/H
        </text>
      </svg>
    </div>
  );
});

const F1SteeringYoke = memo(function F1SteeringYoke({
  yawRate,
  speedMps,
  leftPct,
  rightPct,
  braking,
}: {
  yawRate: number;
  speedMps: number;
  leftPct: number;
  rightPct: number;
  braking: boolean;
}) {
  // Rotate F1 butterfly yoke smoothly up to ±52 deg proportional to live turn rate (`yawRate`)
  const turnNorm = Math.max(-1, Math.min(1, yawRate / 2.05));
  const deg = Math.round(turnNorm * 52 * 10) / 10;
  const speedColor = speedToColorHex(speedMps);
  const litLeds = Math.round(Math.max(0, Math.min(1, speedMps / MAX_STRAIGHT_SPEED)) * 5);

  return (
    <div
      className="kart-f1-yoke"
      data-testid="kart-p1-f1-yoke"
      data-turn-deg={deg}
      aria-label={`F1 steering yoke turn rate ${Math.round(deg)} degrees`}
    >
      <svg
        viewBox="0 0 120 74"
        width="116"
        height="72"
        style={{ transform: `rotate(${deg}deg)` }}
        className="kart-f1-yoke-svg"
        aria-hidden="true"
      >
        {/* Sculpted rectangular/butterfly F1 steering yoke silhouette (NOT a round wheel!) */}
        <path
          d="M 16 14 L 104 14 Q 114 14 114 26 L 112 52 Q 111 62 98 62 L 88 62 Q 84 62 82 54 L 78 48 L 42 48 L 38 54 Q 36 62 32 62 L 22 62 Q 9 62 8 52 L 6 26 Q 6 14 16 14 Z"
          fill="#182032"
        />
        {/* Sculpted cutout thumb holes */}
        <rect x="20" y="27" width="14" height="18" rx="5" fill="#0b1120" />
        <rect x="86" y="27" width="14" height="18" rx="5" fill="#0b1120" />
        {/* Ergonomic side grip wraps */}
        <rect x="7" y="22" width="10" height="32" rx="4" fill="#334155" />
        <rect x="103" y="22" width="10" height="32" rx="4" fill="#334155" />
        {/* Top F1 RPM / speed shift LEDs */}
        {[0, 1, 2, 3, 4].map((idx) => (
          <circle
            key={idx}
            cx={44 + idx * 8}
            cy={19}
            r="2.4"
            fill={idx < litLeds ? speedColor : '#334155'}
          />
        ))}
        {/* Center cockpit micro-display showing L / R rocket balance */}
        <rect x="41" y="25" width="38" height="17" rx="3.5" fill="#0b1120" />
        <rect
          x="45"
          y={28 + (1 - leftPct / 100) * 11}
          width="6"
          height={Math.max(1.5, (leftPct / 100) * 11)}
          rx="1.5"
          fill={braking ? '#ef4444' : '#fb923c'}
        />
        <rect
          x="69"
          y={28 + (1 - rightPct / 100) * 11}
          width="6"
          height={Math.max(1.5, (rightPct / 100) * 11)}
          rx="1.5"
          fill={braking ? '#ef4444' : '#fb923c'}
        />
        <line x1="60" y1="27" x2="60" y2="40" stroke="#475569" strokeWidth="1.5" />
      </svg>
    </div>
  );
});

const CircuitMiniMap = memo(function CircuitMiniMap({
  circuitId,
  dots,
}: {
  circuitId: CircuitId;
  dots: ReadonlyArray<{ x: number; z: number; color: string; isFocus: boolean }>;
}) {
  const circuit = CIRCUITS[circuitId];
  const { pathD, startPt, scalePoint } = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const n of circuit.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.z < minZ) minZ = n.z;
      if (n.z > maxZ) maxZ = n.z;
    }
    const span = Math.max(maxX - minX, maxZ - minZ, 1);
    const pad = 10;
    const size = 96 - pad * 2;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const toSvg = (wx: number, wz: number) => ({
      sx: 48 + ((wx - cx) / span) * size,
      sy: 48 - ((wz - cz) / span) * size,
    });
    const d =
      circuit.nodes
        .map((n, idx) => {
          const p = toSvg(n.x, n.z);
          return `${idx === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`;
        })
        .join(' ') + ' Z';
    const n0 = circuit.nodes[0]!;
    return {
      pathD: d,
      startPt: toSvg(n0.x, n0.z),
      scalePoint: toSvg,
    };
  }, [circuit]);

  return (
    <svg
      className="kart-minimap"
      viewBox="0 0 96 96"
      aria-label={`${circuit.name} circuit map`}
      data-testid="kart-minimap"
    >
      <path d={pathD} fill="none" stroke="var(--stage-well)" strokeWidth="6.5" opacity="0.78" />
      <path d={pathD} fill="none" stroke="var(--on-accent)" strokeWidth="2.4" opacity="0.58" />
      <circle cx={startPt.sx} cy={startPt.sy} r="3.4" fill="var(--prism-4)" />
      {dots.map((dot, idx) => {
        const pt = scalePoint(dot.x, dot.z);
        return (
          <circle
            key={idx}
            cx={pt.sx}
            cy={pt.sy}
            r={dot.isFocus ? 4.2 : 3.0}
            fill={dot.color}
            stroke="var(--stage-well)"
            strokeWidth={dot.isFocus ? 1.4 : 1.0}
          />
        );
      })}
    </svg>
  );
});

function detectInitialRendererBackend(): 'webgl2' | 'canvas2d' {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'canvas2d';
  const param = new URLSearchParams(window.location.search).get('renderer');
  if (param === '2d' || param === 'canvas2d') return 'canvas2d';
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    return gl ? 'webgl2' : 'canvas2d';
  } catch {
    return 'canvas2d';
  }
}

export interface MicroKartViewProps {
  onExit: () => void;
}

export function MicroKartView({ onExit }: MicroKartViewProps) {
  const [rendererBackend, setRendererBackend] = useState<'webgl2' | 'canvas2d'>(() =>
    detectInitialRendererBackend(),
  );
  const [circuitId, setCircuitId] = useState<CircuitId>('sunset-loop');
  const [p1Character, setP1Character] = useState<DriverCharacterId>('fox');
  const [localMode, setLocalMode] = useState<'1p' | '2p-local'>('1p');
  const [netplay, setNetplay] = useState<NetplayState>(() => getSharedNetplay().getState());
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState(20);
  const [paused, setPaused] = useState<boolean>(() => getSharedGamePaused());
  const [overlayOpen, setOverlayOpen] = useState<boolean>(() => getSharedOverlayOpen());
  const [musicOn, setMusicOn] = useState<boolean>(() => getSharedMusicOn());
  const [sfxOn, setSfxOn] = useState<boolean>(() => getSharedSfxOn());
  const [countdown, setCountdown] = useState<number>(2);
  const [countdownKey, setCountdownKey] = useState<number>(0);
  const [countdownLang, setCountdownLang] = useState<CountdownLanguage>(() =>
    pickCountdownLanguage(),
  );
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [raceStatus, setRaceStatus] = useState<'racing' | 'finished'>('racing');
  const [winnerSlot, setWinnerSlot] = useState<number | null>(null);
  const [elapsedHudMs, setElapsedHudMs] = useState(0);
  const [p1Hud, setP1Hud] = useState<HudTelemetry>({
    driverName: 'Ren',
    place: 1,
    lap: 1,
    kmh: 0,
    speedMps: 0,
    recommendedSpeedMps: MAX_STRAIGHT_SPEED,
    yawRate: 0,
    driftCharge: 0,
    boostTimer: 0,
    boostKind: 'none',
    leftPct: 100,
    rightPct: 100,
    turnLeftOn: false,
    turnRightOn: false,
    brakeOn: false,
    bestLapMs: null,
    finishMs: null,
  });
  const [p2Hud, setP2Hud] = useState<HudTelemetry>({
    driverName: 'Mochi',
    place: 2,
    lap: 1,
    kmh: 0,
    speedMps: 0,
    recommendedSpeedMps: MAX_STRAIGHT_SPEED,
    yawRate: 0,
    driftCharge: 0,
    boostTimer: 0,
    boostKind: 'none',
    leftPct: 100,
    rightPct: 100,
    turnLeftOn: false,
    turnRightOn: false,
    brakeOn: false,
    bestLapMs: null,
    finishMs: null,
  });
  const [analogSteerUi, setAnalogSteerUi] = useState<number>(0);
  const [mapDots, setMapDots] = useState<
    Array<{ x: number; z: number; color: string; isFocus: boolean }>
  >([]);

  const activeKartRoom =
    netplay.activeRoom && netplay.activeRoom.gameId === 'micro-kart'
      ? netplay.activeRoom
      : null;
  const isOnline2P = activeKartRoom !== null;
  const isReadyCheck = activeKartRoom?.status === 'ready_check';
  const isNetworkPaused = activeKartRoom?.syncStatus === 'paused';
  const isInviting = netplay.myPendingInvite?.gameId === 'micro-kart';
  const effectiveMode: KartRaceMode = isOnline2P ? '2p-online' : localMode;
  const isSplit2P = effectiveMode === '2p-local';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglRendererRef = useRef<MicroKartWebGL2Renderer | null>(null);
  const pauseMenuRef = useRef<HTMLDivElement | null>(null);
  const raceRef = useRef<KartRaceState>(createRaceState('sunset-loop', '1p', 1));
  const cam1Ref = useRef<ChaseCamera>(createChaseCamera());
  const cam2Ref = useRef<ChaseCamera>(createChaseCamera());
  const synthRef = useRef<MicroKartSynth | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const activePointersRef = useRef<
    Map<number, { player: 0 | 1; zone: 'left' | 'right' | 'brake' }>
  >(new Map());
  const analogSteerRef = useRef<number | null>(null);
  const analogPointerIdRef = useRef<number | null>(null);
  const countdownRef = useRef(countdown);
  countdownRef.current = countdown;
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomStartedRef = useRef<string | null>(null);
  const finishAwardedRef = useRef(false);

  const syncHudFromRace = useCallback((race: KartRaceState, focusLocalSlot = 0) => {
    const circuit = CIRCUITS[race.circuitId];
    const k0 = race.karts[focusLocalSlot] ?? race.karts[0]!;
    const k1 = race.karts[1];
    setElapsedHudMs(Math.round(race.elapsedMs));
    setRaceStatus(race.status);
    setWinnerSlot(race.winnerSlot);
    setP1Hud({
      driverName: getKartDriverSpec(k0.character).driverName,
      place: k0.place,
      lap: Math.min(TOTAL_LAPS, k0.lap),
      kmh: Math.round(k0.speed * 3.6),
      speedMps: k0.speed,
      recommendedSpeedMps: getRecommendedSpeedAtS(circuit, k0.s),
      yawRate: k0.yawRate,
      driftCharge: k0.driftCharge,
      boostTimer: k0.boostTimer,
      boostKind: k0.boostKind,
      leftPct: Math.round(k0.leftThrottle * 100),
      rightPct: Math.round(k0.rightThrottle * 100),
      turnLeftOn: k0.driftDir === -1 || k0.leftThrottle < k0.rightThrottle - 0.08,
      turnRightOn: k0.driftDir === 1 || k0.rightThrottle < k0.leftThrottle - 0.08,
      brakeOn: k0.braking,
      bestLapMs: k0.bestLapMs,
      finishMs: k0.finishMs,
    });
    if (k1) {
      setP2Hud({
        driverName: getKartDriverSpec(k1.character).driverName,
        place: k1.place,
        lap: Math.min(TOTAL_LAPS, k1.lap),
        kmh: Math.round(k1.speed * 3.6),
        speedMps: k1.speed,
        recommendedSpeedMps: getRecommendedSpeedAtS(circuit, k1.s),
        yawRate: k1.yawRate,
        driftCharge: k1.driftCharge,
        boostTimer: k1.boostTimer,
        boostKind: k1.boostKind,
        leftPct: Math.round(k1.leftThrottle * 100),
        rightPct: Math.round(k1.rightThrottle * 100),
        turnLeftOn: k1.driftDir === -1 || k1.leftThrottle < k1.rightThrottle - 0.08,
        turnRightOn: k1.driftDir === 1 || k1.rightThrottle < k1.leftThrottle - 0.08,
        brakeOn: k1.braking,
        bestLapMs: k1.bestLapMs,
        finishMs: k1.finishMs,
      });
    }
    setMapDots(
      race.karts.map((k) => ({
        x: k.x,
        z: k.z,
        color: getKartDriverSpec(k.character).mapGlow,
        isFocus: k.slot === focusLocalSlot,
      })),
    );
  }, []);

  const triggerFreshCountdown = useCallback(
    (lang: CountdownLanguage = pickCountdownLanguage()) => {
      countdownRef.current = 2;
      setCountdownLang(lang);
      setCountdown(2);
      setCountdownKey((k) => k + 1);
    },
    [],
  );

  const resetRace = useCallback(
    (
      nextCircuit: CircuitId,
      nextMode: KartRaceMode,
      seed = Math.floor(Math.random() * 1_000_000) + 1,
      names?: { p1?: string; p2?: string },
      lang?: CountdownLanguage,
      overrideP1Char?: DriverCharacterId,
    ) => {
      const chosenChar = overrideP1Char ?? p1Character;
      const fresh = createRaceState(nextCircuit, nextMode, seed, {
        ...names,
        p1Character: chosenChar,
      });
      // In 2P Online, mark our assigned slot as local human and opponent slot as remote!
      if (nextMode === '2p-online' && activeKartRoom) {
        const mySlot = activeKartRoom.mySlot;
        const oppSlot = mySlot === 0 ? 1 : 0;
        const myKart = fresh.karts[mySlot]!;
        const oppKart = fresh.karts[oppSlot]!;
        (myKart as { isHuman: boolean; isRemote: boolean }).isHuman = true;
        (myKart as { isHuman: boolean; isRemote: boolean }).isRemote = false;
        (oppKart as { isHuman: boolean; isRemote: boolean }).isHuman = false;
        (oppKart as { isHuman: boolean; isRemote: boolean }).isRemote = true;
      }
      raceRef.current = fresh;
      cam1Ref.current = createChaseCamera();
      cam2Ref.current = createChaseCamera();
      const focusSlot = nextMode === '2p-online' && activeKartRoom ? activeKartRoom.mySlot : 0;
      updateChaseCamera(cam1Ref.current, fresh.karts[focusSlot]!, 1);
      if (fresh.karts[1]) {
        updateChaseCamera(cam2Ref.current, fresh.karts[1], 1);
      }
      finishAwardedRef.current = false;
      pressedKeysRef.current.clear();
      activePointersRef.current.clear();
      syncHudFromRace(fresh, focusSlot);
      setSharedGamePaused(false);
      triggerFreshCountdown(lang);
      getSharedArcadeAudio().startNewGameTrack();
    },
    [activeKartRoom, p1Character, syncHudFromRace, triggerFreshCountdown],
  );

  // Audio & shared pause subscriptions
  useEffect(() => {
    const audio = getSharedArcadeAudio();
    audio.setPlaylist(MICRO_KART_PLAYLIST);
    if (getSharedMusicOn()) {
      audio.setActive(true);
    }
    const synth = new MicroKartSynth();
    synthRef.current = synth;
    const unsubAudio = subscribeSharedAudio((mOn, _now, sOn) => {
      setMusicOn(mOn);
      setSfxOn(sOn);
    });
    const unsubPause = subscribeSharedGamePause(setPaused);
    const unsubOverlay = subscribeSharedOverlayOpen(setOverlayOpen);

    // Initialize camera & HUD on mount
    updateChaseCamera(cam1Ref.current, raceRef.current.karts[0]!, 1);
    syncHudFromRace(raceRef.current, 0);

    return () => {
      unsubAudio();
      unsubPause();
      unsubOverlay();
      synth.dispose();
      synthRef.current = null;
    };
  }, [syncHudFromRace]);

  // Netplay presence & room lifecycle
  useEffect(() => {
    const client = getSharedNetplay();
    client.setCurrentApp('micro-kart');
    const unsubState = client.subscribe((nextState) => {
      setNetplay(nextState);
      const room =
        nextState.activeRoom && nextState.activeRoom.gameId === 'micro-kart'
          ? nextState.activeRoom
          : null;
      if (room && activeRoomIdRef.current !== room.id) {
        activeRoomIdRef.current = room.id;
        if (room.status === 'playing') {
          activeRoomStartedRef.current = room.id;
          const p0Name = room.players[0]?.name ?? 'P1';
          const p1Name = room.players[1]?.name ?? 'P2';
          resetRace(
            circuitId,
            '2p-online',
            room.seed,
            { p1: p0Name, p2: p1Name },
            pickCountdownLanguage(mulberry32((room.seed ^ 0x5a5a5a5a) >>> 0)),
          );
          setWins([0, 0]);
        }
      } else if (
        room &&
        room.status === 'playing' &&
        activeRoomStartedRef.current !== room.id
      ) {
        activeRoomStartedRef.current = room.id;
        const p0Name = room.players[0]?.name ?? 'P1';
        const p1Name = room.players[1]?.name ?? 'P2';
        resetRace(
          circuitId,
          '2p-online',
          room.seed,
          { p1: p0Name, p2: p1Name },
          pickCountdownLanguage(mulberry32((room.seed ^ 0x5a5a5a5a) >>> 0)),
        );
      } else if (!room && activeRoomIdRef.current !== null) {
        activeRoomIdRef.current = null;
        activeRoomStartedRef.current = null;
        resetRace(circuitId, localMode, 1);
      }
    });

    const unsubEvents = client.onRoomEvent((event) => {
      if (event.kind === 'match_start') {
        const payload = event.payload as { gameId?: string; seed?: number; id?: string; roomId?: string } | null;
        if (payload && payload.gameId === 'micro-kart') {
          const rid = payload.id ?? payload.roomId ?? null;
          if (rid && activeRoomStartedRef.current !== rid) {
            activeRoomIdRef.current = rid;
            activeRoomStartedRef.current = rid;
            resetRace(
              circuitId,
              '2p-online',
              payload.seed ?? 1337,
              undefined,
              pickCountdownLanguage(mulberry32(((payload.seed ?? 1337) ^ 0x5a5a5a5a) >>> 0)),
            );
          }
        }
        return;
      }
      if (event.kind === 'sync_resumed') {
        triggerFreshCountdown();
        return;
      }
      if (event.kind === 'sync_timeout') {
        void getSharedNetplay().leaveRoom();
        onExit();
        return;
      }
      if (event.senderId === client.getState().clientId) return;
      if (event.kind === 'kart_state') {
        const payload = event.payload as { slot?: number; snap?: KartNetSnapshot } | null;
        if (payload && payload.snap && typeof payload.slot === 'number') {
          const target = raceRef.current.karts[payload.slot];
          if (target && target.isRemote) {
            applyRemoteKartSnapshot(target, payload.snap);
            if (payload.snap.finishMs !== null && raceRef.current.status === 'racing') {
              raceRef.current.status = 'finished';
              raceRef.current.winnerSlot = payload.slot;
              syncHudFromRace(raceRef.current, activeKartRoom?.mySlot ?? 0);
            }
          }
        }
      }
    });

    return () => {
      unsubState();
      unsubEvents();
    };
  }, [activeKartRoom?.mySlot, circuitId, localMode, onExit, resetRace, syncHudFromRace, triggerFreshCountdown]);

  // Invite countdown timer
  useEffect(() => {
    const invite = netplay.myPendingInvite;
    if (!invite || invite.gameId !== 'micro-kart') {
      setInviteSecondsLeft(20);
      return;
    }
    const tickInvite = () => {
      const remaining = Math.max(
        0,
        Math.ceil((INVITE_TIMEOUT_MS - (Date.now() - invite.createdAt)) / 1000),
      );
      setInviteSecondsLeft(remaining);
      if (remaining <= 0) {
        void getSharedNetplay().cancelInvite();
      }
    };
    tickInvite();
    const id = window.setInterval(tickInvite, 250);
    return () => window.clearInterval(id);
  }, [netplay.myPendingInvite]);

  // 22-language neural TTS "Ready… / Go!" countdown
  useEffect(() => {
    if (countdown <= 0 || paused || isReadyCheck || isInviting || isNetworkPaused) return;
    const phase = countdown >= 2 ? 'ready' : 'go';
    getSharedArcadeAudio().playCountdownPhrase(countdownLang, phase);
    const beatMs = phase === 'ready' ? COUNTDOWN_READY_MS : COUNTDOWN_GO_MS;
    const id = window.setTimeout(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, beatMs);
    return () => window.clearTimeout(id);
  }, [countdown, countdownKey, countdownLang, paused, isReadyCheck, isInviting, isNetworkPaused]);

  // Live 25Hz netplay kart state broadcast in Online 2P
  useEffect(() => {
    if (!isOnline2P || !activeKartRoom || isReadyCheck || isNetworkPaused || countdown > 0) return;
    const mySlot = activeKartRoom.mySlot;
    const pushState = () => {
      const myKart = raceRef.current.karts[mySlot];
      if (!myKart) return;
      void getSharedNetplay().sendRoomEvent('kart_state', {
        slot: mySlot,
        snap: toKartNetSnapshot(myKart),
      });
    };
    const id = window.setInterval(pushState, 45);
    return () => window.clearInterval(id);
  }, [activeKartRoom, countdown, isNetworkPaused, isOnline2P, isReadyCheck]);

  // Keyboard listeners + deterministic E2E test hook (`yolo:kart:step`)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (overlayOpen || isEditableElement(e.target)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        toggleSharedGamePaused();
        return;
      }
      if (paused) return;
      if (raceRef.current.status === 'finished' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        if (isOnline2P && activeKartRoom) {
          resetRace(circuitId, '2p-online', activeKartRoom.seed + 1);
        } else {
          resetRace(circuitId, localMode);
        }
        return;
      }
      const code = e.code || e.key;
      if (
        code === 'KeyA' ||
        code === 'KeyD' ||
        code === 'KeyS' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'ArrowDown' ||
        e.key === 'a' ||
        e.key === 'A' ||
        e.key === 'd' ||
        e.key === 'D' ||
        e.key === 's' ||
        e.key === 'S'
      ) {
        e.preventDefault();
        pressedKeysRef.current.add(code);
        if (e.key === 'a' || e.key === 'A') pressedKeysRef.current.add('KeyA');
        if (e.key === 'd' || e.key === 'D') pressedKeysRef.current.add('KeyD');
        if (e.key === 's' || e.key === 'S') pressedKeysRef.current.add('KeyS');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code || e.key;
      pressedKeysRef.current.delete(code);
      if (e.key === 'a' || e.key === 'A') pressedKeysRef.current.delete('KeyA');
      if (e.key === 'd' || e.key === 'D') pressedKeysRef.current.delete('KeyD');
      if (e.key === 's' || e.key === 'S') pressedKeysRef.current.delete('KeyS');
    };
    const onBlur = () => {
      pressedKeysRef.current.clear();
      activePointersRef.current.clear();
    };
    const onDeterministicStep = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        steps?: number;
        dtMs?: number;
        p1?: ThrusterInput;
        p2?: ThrusterInput;
      }>).detail;
      const steps = Math.max(1, Math.min(600, detail?.steps ?? 1));
      const dtMs = detail?.dtMs ?? 16.67;
      for (let i = 0; i < steps; i += 1) {
        stepRaceState(
          raceRef.current,
          {
            0: detail?.p1 ?? { left: false, right: false },
            1: detail?.p2 ?? { left: false, right: false },
          },
          dtMs,
        );
        updateChaseCamera(cam1Ref.current, raceRef.current.karts[0]!, dtMs / 1000);
        if (raceRef.current.karts[1]) {
          updateChaseCamera(cam2Ref.current, raceRef.current.karts[1], dtMs / 1000);
        }
      }
      syncHudFromRace(raceRef.current, activeKartRoom?.mySlot ?? 0);
    };

    const onCameraOrbit = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        orbitYawOffset?: number | null;
        orbitDist?: number;
        orbitHeight?: number;
      }>).detail;
      if (detail?.orbitYawOffset === null || detail?.orbitYawOffset === undefined) {
        cam1Ref.current.orbitYawOffset = undefined;
      } else {
        cam1Ref.current.orbitYawOffset = detail.orbitYawOffset;
        cam1Ref.current.orbitDist = detail.orbitDist;
        cam1Ref.current.orbitHeight = detail.orbitHeight;
      }
      updateChaseCamera(cam1Ref.current, raceRef.current.karts[0]!, 1);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('yolo:kart:step', onDeterministicStep as EventListener);
    window.addEventListener('yolo:kart:camera', onCameraOrbit as EventListener);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('yolo:kart:step', onDeterministicStep as EventListener);
      window.removeEventListener('yolo:kart:camera', onCameraOrbit as EventListener);
    };
  }, [activeKartRoom, circuitId, isOnline2P, localMode, overlayOpen, paused, resetRace, syncHudFromRace]);

  const readCurrentHumanInputs = useCallback((): Record<number, ThrusterInput> => {
    const keys = pressedKeysRef.current;
    let p1Left = keys.has('KeyA') || (!isSplit2P && keys.has('ArrowLeft'));
    let p1Right = keys.has('KeyD') || (!isSplit2P && keys.has('ArrowRight'));
    let p1Brake = keys.has('KeyS') || (!isSplit2P && keys.has('ArrowDown'));

    let p2Left = isSplit2P && keys.has('ArrowLeft');
    let p2Right = isSplit2P && keys.has('ArrowRight');
    let p2Brake = isSplit2P && keys.has('ArrowDown');

    let p1TouchL = false;
    let p1TouchR = false;
    let p2TouchL = false;
    let p2TouchR = false;

    for (const ptr of activePointersRef.current.values()) {
      if (ptr.player === 0) {
        if (ptr.zone === 'brake') p1Brake = true;
        else if (ptr.zone === 'left') p1TouchL = true;
        else p1TouchR = true;
      } else {
        if (ptr.zone === 'brake') p2Brake = true;
        else if (ptr.zone === 'left') p2TouchL = true;
        else p2TouchR = true;
      }
    }

    // Holding both left & right touch halves simultaneously also triggers Brake on mobile!
    if (p1TouchL && p1TouchR) p1Brake = true;
    else {
      if (p1TouchL) p1Left = true;
      if (p1TouchR) p1Right = true;
    }
    if (p2TouchL && p2TouchR) p2Brake = true;
    else {
      if (p2TouchL) p2Left = true;
      if (p2TouchR) p2Right = true;
    }

    const p1Analog = analogSteerRef.current;
    const p1Input: ThrusterInput =
      p1Analog !== null
        ? { left: p1Analog < -0.1, right: p1Analog > 0.1, brake: p1Brake, steerAnalog: p1Analog }
        : { left: p1Left, right: p1Right, brake: p1Brake };

    const myOnlineSlot = isOnline2P && activeKartRoom ? activeKartRoom.mySlot : 0;
    if (isOnline2P) {
      return { [myOnlineSlot]: p1Input };
    }
    return {
      0: p1Input,
      1: { left: p2Left, right: p2Right, brake: p2Brake },
    };
  }, [activeKartRoom, isOnline2P, isSplit2P]);

  // WebGL2 renderer lifecycle (with automatic fallback to 2D canvas if unavailable or unrecoverable)
  useEffect(() => {
    if (rendererBackend !== 'webgl2') {
      webglRendererRef.current?.dispose();
      webglRendererRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    let fellBack = false;
    const glRenderer = new MicroKartWebGL2Renderer(canvas, () => {
      fellBack = true;
      setRendererBackend('canvas2d');
    });
    if (!fellBack && glRenderer.isReady) {
      webglRendererRef.current = glRenderer;
    } else if (!fellBack) {
      glRenderer.dispose();
      setRendererBackend('canvas2d');
    }
    return () => {
      glRenderer.dispose();
      if (webglRendererRef.current === glRenderer) {
        webglRendererRef.current = null;
      }
    };
  }, [rendererBackend]);

  // Main 60fps 3D simulation & canvas render loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudThrottleMs = 0;

    const frame = (now: number) => {
      const rawDt = now - lastTime;
      lastTime = now;
      const dtMs = Math.min(40, Math.max(0, rawDt));

      const race = raceRef.current;
      const focusSlot = isOnline2P && activeKartRoom ? activeKartRoom.mySlot : 0;
      const canAdvance =
        !paused && !overlayOpen && !isReadyCheck && !isInviting && !isNetworkPaused && countdown <= 0;

      if (canAdvance) {
        const inputs = readCurrentHumanInputs();
        stepRaceState(race, inputs, dtMs);

        // Trigger procedural Web Audio events
        const synth = synthRef.current;
        if (synth) {
          for (const b of race.lastEvents.boostTriggered) {
            if (b.slot === focusSlot || (isSplit2P && b.slot === 1)) {
              synth.playBoost(b.kind);
            }
          }
          for (const l of race.lastEvents.lapCompleted) {
            if (l.slot === focusSlot || (isSplit2P && l.slot === 1)) {
              synth.playLap(l.finished);
            }
          }
          if (race.lastEvents.bumped) {
            synth.playBump();
          }
          const fk = race.karts[focusSlot]!;
          synth.updateEngine(
            fk.speed,
            fk.boostTimer > 0,
            fk.driftCharge > 0.08,
            race.status === 'racing',
          );
        }

        if (race.status === 'finished' && !finishAwardedRef.current) {
          finishAwardedRef.current = true;
          if ((isSplit2P || isOnline2P) && (race.winnerSlot === 0 || race.winnerSlot === 1)) {
            const winIdx = race.winnerSlot;
            setWins((prev) => (winIdx === 0 ? [prev[0] + 1, prev[1]] : [prev[0], prev[1] + 1]));
          }
          syncHudFromRace(race, focusSlot);
        }
      } else {
        synthRef.current?.updateEngine(0, false, false, false);
      }

      updateChaseCamera(cam1Ref.current, race.karts[focusSlot]!, Math.max(0.008, dtMs / 1000));
      if (isSplit2P && race.karts[1]) {
        updateChaseCamera(cam2Ref.current, race.karts[1], Math.max(0.008, dtMs / 1000));
      }

      // Render 3D viewport(s) onto Hi-DPI canvas (WebGL2 primary, automatic 2D fallback)
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const cssW = Math.max(320, Math.round(rect.width));
        const cssH = Math.max(220, Math.round(rect.height));
        const dpr = Math.min(2.5, window.devicePixelRatio || 1);
        const targetW = Math.round(cssW * dpr);
        const targetH = Math.round(cssH * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const glRenderer = rendererBackend === 'webgl2' ? webglRendererRef.current : null;
        if (glRenderer && glRenderer.isReady) {
          if (isSplit2P) {
            const halfPx = Math.floor(targetH / 2);
            glRenderer.renderViewport(race, 0, cam1Ref.current, 0, 0, targetW, halfPx - 1, now);
            glRenderer.renderViewport(
              race,
              1,
              cam2Ref.current,
              0,
              halfPx + 1,
              targetW,
              targetH - halfPx - 1,
              now,
            );
          } else {
            glRenderer.renderViewport(race, focusSlot, cam1Ref.current, 0, 0, targetW, targetH, now);
          }
        } else if (rendererBackend === 'canvas2d') {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.scale(dpr, dpr);
            if (isSplit2P) {
              const halfH = Math.floor(cssH / 2);
              renderKartViewport(ctx, race, 0, cam1Ref.current, 0, 0, cssW, halfH - 1, now);
              renderKartViewport(
                ctx,
                race,
                1,
                cam2Ref.current,
                0,
                halfH + 1,
                cssW,
                cssH - halfH - 1,
                now,
              );
              ctx.fillStyle = '#070a10';
              ctx.fillRect(0, halfH - 1, cssW, 2);
            } else {
              renderKartViewport(ctx, race, focusSlot, cam1Ref.current, 0, 0, cssW, cssH, now);
            }
            ctx.restore();
          }
        }
      }

      hudThrottleMs += dtMs;
      if (hudThrottleMs >= 65) {
        hudThrottleMs = 0;
        syncHudFromRace(race, focusSlot);
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    activeKartRoom,
    countdown,
    isInviting,
    isNetworkPaused,
    isOnline2P,
    isReadyCheck,
    isSplit2P,
    overlayOpen,
    paused,
    readCurrentHumanInputs,
    rendererBackend,
    syncHudFromRace,
  ]);

  const classifyTouchZone = (
    relX: number,
    relY: number,
    w: number,
    h: number,
    split: boolean,
  ): { player: 0 | 1; zone: 'left' | 'right' | 'brake' } => {
    const player: 0 | 1 = split && relY > h / 2 ? 1 : 0;
    const vpH = split ? h / 2 : h;
    const localY = split && player === 1 ? relY - h / 2 : relY;
    const nx = relX / Math.max(1, w);
    const ny = localY / Math.max(1, vpH);
    const zone: 'left' | 'right' | 'brake' =
      nx >= 0.37 && nx <= 0.63 && ny >= 0.65 ? 'brake' : nx < 0.5 ? 'left' : 'right';
    return { player, zone };
  };

  const handleStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (paused || overlayOpen || raceStatus === 'finished') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = classifyTouchZone(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
      isSplit2P,
    );
    activePointersRef.current.set(e.pointerId, hit);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events in tests may omit active pointer registration
    }
  };

  const handleStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const existing = activePointersRef.current.get(e.pointerId);
    if (!existing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = classifyTouchZone(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
      isSplit2P,
    );
    existing.zone = hit.zone;
  };

  const handleStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
  };

  const updateAnalogSliderFromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const norm = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const clamped = Math.max(-1, Math.min(1, norm));
    // Gentle center deadzone so releasing near center feels crisp
    const val = Math.abs(clamped) < 0.05 ? 0 : clamped;
    analogSteerRef.current = val;
    setAnalogSteerUi(val);
  };

  const handleSliderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (paused || overlayOpen || raceStatus === 'finished') return;
    analogPointerIdRef.current = e.pointerId;
    updateAnalogSliderFromPointer(e);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events in tests may omit active pointer registration
    }
  };

  const handleSliderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (analogPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateAnalogSliderFromPointer(e);
  };

  const handleSliderPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (analogPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    analogPointerIdRef.current = null;
    analogSteerRef.current = null;
    setAnalogSteerUi(0);
  };

  const canSelectOnline2P =
    isOnline2P || isInviting || netplay.onlineCount >= 2;
  const activeCircuit = CIRCUITS[circuitId];
  const p1SpeedColor = speedToColorHex(p1Hud.speedMps);
  const p2SpeedColor = speedToColorHex(p2Hud.speedMps);

  return (
    <div
      className="kart-stage"
      data-testid="micro-kart-stage"
      data-mode={effectiveMode}
      data-circuit={circuitId}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
    >
      <canvas
        key={rendererBackend}
        ref={canvasRef}
        className="kart-canvas"
        data-testid="kart-canvas"
        data-renderer={rendererBackend}
        role="img"
        aria-label={`Micro Kart 3D circuit ${activeCircuit.name}, mode ${effectiveMode}`}
      />

      {/* Top header strip matching sibling games */}
      <header className="kart-header">
        <div className="row">
          <h2 className="stack-title">Micro Kart</h2>
          <span className="kart-circuit-pill" data-testid="kart-circuit-label">
            {activeCircuit.name}
          </span>
          {isSplit2P || isOnline2P ? (
            <span className="sb-tally" aria-live="polite">
              P1 {wins[0]} — {wins[1]} P2
            </span>
          ) : null}
        </div>
      </header>

      {/* Primary Viewport HUD (Full screen in 1P / Online 2P, Top half in 2P Split-Screen) */}
      <div className={isSplit2P ? 'kart-hud-layer is-top-half' : 'kart-hud-layer'}>
        <div className="kart-hud-top-right">
          <div className="kart-telemetry-card" data-testid="kart-p1-telemetry">
            <span
              className={p1Hud.place === 1 ? 'kart-place-badge is-first' : 'kart-place-badge'}
              data-testid="kart-p1-place"
            >
              {ordinalPlace(p1Hud.place)}
            </span>
            <div className="kart-telemetry-item">
              <span className="stack-label">Driver</span>
              <span className="kart-telemetry-val" data-testid="kart-p1-driver">
                {p1Hud.driverName}
              </span>
            </div>
            <div className="kart-telemetry-item">
              <span className="stack-label">Lap</span>
              <span className="kart-telemetry-val" data-testid="kart-p1-lap">
                {p1Hud.lap}/{TOTAL_LAPS}
              </span>
            </div>
            <div className="kart-telemetry-item">
              <span className="stack-label">Speed</span>
              <span
                className="kart-telemetry-val"
                data-testid="kart-p1-speed"
                style={{ color: p1SpeedColor }}
              >
                {p1Hud.kmh} <small>km/h</small>
              </span>
            </div>
            <div className="kart-telemetry-item">
              <span className="stack-label">Time</span>
              <span className="kart-telemetry-val">{formatRaceClock(elapsedHudMs)}</span>
            </div>
          </div>
          {!isSplit2P ? <CircuitMiniMap circuitId={circuitId} dots={mapDots} /> : null}
        </div>

        <div className="kart-controls-dock">
          {!isSplit2P ? (
            <div className="kart-cockpit-cluster">
              <F1Speedometer
                speedMps={p1Hud.speedMps}
                recommendedSpeedMps={p1Hud.recommendedSpeedMps}
                kmh={p1Hud.kmh}
              />
              <F1SteeringYoke
                yawRate={p1Hud.yawRate}
                speedMps={p1Hud.speedMps}
                leftPct={p1Hud.leftPct}
                rightPct={p1Hud.rightPct}
                braking={p1Hud.brakeOn}
              />
            </div>
          ) : null}

          {!isSplit2P ? (
            <div
              className="kart-steer-slider"
              data-testid="kart-p1-steer-slider"
              role="slider"
              aria-label="Analog differential thruster steering"
              aria-valuemin={-100}
              aria-valuemax={100}
              aria-valuenow={Math.round(analogSteerUi * 100)}
              onPointerDown={handleSliderPointerDown}
              onPointerMove={handleSliderPointerMove}
              onPointerUp={handleSliderPointerUp}
              onPointerCancel={handleSliderPointerUp}
            >
              <div className="kart-steer-slider-track">
                <div className="kart-steer-slider-center" />
                <div
                  className="kart-steer-slider-thumb"
                  style={{ left: `${((analogSteerUi + 1) * 50).toFixed(1)}%` }}
                />
              </div>
              <span className="kart-steer-slider-label">DRAG STEER</span>
            </div>
          ) : null}

          <div className="kart-thruster-row">
            <span
              className={p1Hud.turnLeftOn ? 'kart-thruster-pill is-firing' : 'kart-thruster-pill'}
              data-testid="kart-p1-turn-left"
              data-throttle={p1Hud.leftPct}
            >
              <span className="kart-thruster-fill" style={{ width: `${p1Hud.leftPct}%` }} />
              <span className="kart-thruster-text">
                ◀ L {p1Hud.leftPct}% · {isSplit2P ? 'A' : 'A / ←'}
              </span>
            </span>
            <span
              className={p1Hud.brakeOn ? 'kart-thruster-pill is-braking' : 'kart-thruster-pill'}
              data-testid="kart-p1-brake"
            >
              <span className="kart-thruster-text">▼ BRAKE · {isSplit2P ? 'S' : 'S / ↓'}</span>
            </span>
            <span
              className={p1Hud.turnRightOn ? 'kart-thruster-pill is-firing' : 'kart-thruster-pill'}
              data-testid="kart-p1-turn-right"
              data-throttle={p1Hud.rightPct}
            >
              <span className="kart-thruster-fill" style={{ width: `${p1Hud.rightPct}%` }} />
              <span className="kart-thruster-text">
                {isSplit2P ? 'D' : 'D / →'} · R {p1Hud.rightPct}% ▶
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Viewport HUD in 2P Local Split-Screen */}
      {isSplit2P ? (
        <div className="kart-hud-layer is-bottom-half" data-testid="kart-p2-hud">
          <div className="kart-hud-top-right">
            <div className="kart-telemetry-card" data-testid="kart-p2-telemetry">
              <span
                className={p2Hud.place === 1 ? 'kart-place-badge is-first' : 'kart-place-badge'}
                data-testid="kart-p2-place"
              >
                {ordinalPlace(p2Hud.place)}
              </span>
              <div className="kart-telemetry-item">
                <span className="stack-label">Driver</span>
                <span className="kart-telemetry-val" data-testid="kart-p2-driver">
                  {p2Hud.driverName}
                </span>
              </div>
              <div className="kart-telemetry-item">
                <span className="stack-label">Lap</span>
                <span className="kart-telemetry-val" data-testid="kart-p2-lap">
                  {p2Hud.lap}/{TOTAL_LAPS}
                </span>
              </div>
              <div className="kart-telemetry-item">
                <span className="stack-label">Speed</span>
                <span
                  className="kart-telemetry-val"
                  data-testid="kart-p2-speed"
                  style={{ color: p2SpeedColor }}
                >
                  {p2Hud.kmh} <small>km/h</small>
                </span>
              </div>
            </div>
          </div>
          <div className="kart-thruster-row">
            <span className={p2Hud.turnLeftOn ? 'kart-thruster-pill is-firing' : 'kart-thruster-pill'}>
              ◀ P2 TURN L · ←
            </span>
            <span className={p2Hud.brakeOn ? 'kart-thruster-pill is-braking' : 'kart-thruster-pill'}>
              ▼ BRAKE · ↓
            </span>
            <span className={p2Hud.turnRightOn ? 'kart-thruster-pill is-firing' : 'kart-thruster-pill'}>
              → · P2 TURN R ▶
            </span>
          </div>
        </div>
      ) : null}

      {/* 22-language neural TTS "Ready… / Go!" countdown */}
      {!paused && !isReadyCheck && !isInviting && countdown > 0 ? (
        <div
          className="arcade-countdown-backdrop"
          data-testid="arcade-countdown"
          data-lang={countdownLang.id}
          data-phase={countdown >= 2 ? 'ready' : 'go'}
          role="status"
          aria-live="polite"
        >
          <span className="arcade-countdown-flags" data-testid="arcade-countdown-flags" aria-hidden="true">
            {countdownLang.flags}
          </span>
          <span className="arcade-countdown-digit">
            {countdown >= 2 ? countdownLang.readyText : countdownLang.goText}
          </span>
        </div>
      ) : null}

      {/* Finish Podium Card */}
      {!paused && raceStatus === 'finished' ? (
        <div
          className="stack-over"
          role="status"
          aria-live="polite"
          data-testid="kart-finish-card"
        >
          <div>
            {isSplit2P || isOnline2P
              ? winnerSlot === (isOnline2P && activeKartRoom ? activeKartRoom.mySlot : 0)
                ? '1st Place Victory!'
                : `${raceRef.current.karts[winnerSlot ?? 0]?.name ?? 'Rival'} Wins!`
              : `${ordinalPlace(p1Hud.place)} Place · ${formatRaceClock(p1Hud.finishMs ?? elapsedHudMs)}`}
          </div>
          {p1Hud.bestLapMs !== null ? (
            <div className="muted">Best Lap · {formatRaceClock(p1Hud.bestLapMs)}</div>
          ) : null}
          <button
            type="button"
            className="primary"
            data-testid="kart-race-again-btn"
            onClick={() => {
              if (isOnline2P && activeKartRoom) {
                resetRace(circuitId, '2p-online', activeKartRoom.seed + 1);
              } else {
                resetRace(circuitId, localMode);
              }
            }}
          >
            Race again
          </button>
        </div>
      ) : null}

      {/* 2P Online Matchmaking Waiting Card */}
      {isInviting ? (
        <div className="game-pause-backdrop">
          <div className="game-pause-menu" role="status" aria-live="polite" data-testid="kart-invite-waiting">
            <span className="game-pause-kicker">2P Online Circuit</span>
            <h3 className="game-pause-title">Waiting for racer…</h3>
            <p className="game-pause-copy">
              Invite broadcast to online players ({inviteSecondsLeft}s remaining).
            </p>
            <div className="game-pause-actions">
              <button
                type="button"
                onClick={() => {
                  void getSharedNetplay().cancelInvite();
                }}
              >
                Cancel invite
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2P Online Ready Check */}
      {isReadyCheck && activeKartRoom ? (
        <div className="game-pause-backdrop">
          <div className="game-pause-menu" role="dialog" aria-modal="true" aria-label="2P Ready Check">
            <span className="game-pause-kicker">2P Online Micro Kart</span>
            <h3 className="game-pause-title">vs. {activeKartRoom.opponent.name}</h3>
            <div className="game-pause-actions">
              <button
                type="button"
                className="primary"
                data-testid="kart-ready-btn"
                disabled={Boolean(activeKartRoom.players[activeKartRoom.mySlot]?.ready)}
                onClick={() => {
                  void getSharedNetplay().setReady();
                }}
              >
                {activeKartRoom.players[activeKartRoom.mySlot]?.ready ? 'Waiting for rival…' : 'Ready to Race!'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void getSharedNetplay().leaveRoom();
                }}
              >
                Leave room
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Pause Menu */}
      {paused ? (
        <div className="game-pause-backdrop">
          <div
            className="game-pause-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Game paused"
            data-testid="game-pause-menu"
            ref={pauseMenuRef}
          >
            <span className="game-pause-kicker">Micro Kart</span>
            <h3 className="game-pause-title">Paused</h3>

            <div className="game-pause-section">
              <span className="stack-label">Race Mode</span>
              <div className="filter-group" role="group" aria-label="Micro Kart player mode">
                <button
                  type="button"
                  data-testid="kart-1p-btn"
                  aria-pressed={!isSplit2P && !isOnline2P && !isInviting}
                  onClick={() => {
                    if (isOnline2P) void getSharedNetplay().leaveRoom();
                    setLocalMode('1p');
                    resetRace(circuitId, '1p');
                  }}
                >
                  1P Grand Prix
                </button>
                <button
                  type="button"
                  data-testid="kart-2p-local-btn"
                  aria-pressed={isSplit2P}
                  onClick={() => {
                    if (isOnline2P) void getSharedNetplay().leaveRoom();
                    setLocalMode('2p-local');
                    resetRace(circuitId, '2p-local');
                  }}
                >
                  2P Split-Screen
                </button>
                <button
                  type="button"
                  data-testid="kart-2p-online-btn"
                  aria-pressed={isOnline2P || isInviting}
                  disabled={!canSelectOnline2P}
                  onClick={() => {
                    if (isOnline2P) {
                      void getSharedNetplay().leaveRoom();
                    } else if (isInviting) {
                      void getSharedNetplay().cancelInvite();
                    } else if (canSelectOnline2P) {
                      setLocalMode('1p');
                      setSharedGamePaused(false);
                      void getSharedNetplay().sendInvite('micro-kart');
                    }
                  }}
                >
                  {isOnline2P && activeKartRoom
                    ? `2P online (${activeKartRoom.opponent.name})`
                    : isInviting
                      ? `Waiting 2P… (${inviteSecondsLeft}s)`
                      : '2P online'}
                </button>
              </div>
            </div>

            <div className="game-pause-section">
              <span className="stack-label">Driver</span>
              <div className="filter-group" role="group" aria-label="Driver selection">
                {KART_DRIVERS.map((drv) => (
                  <button
                    key={drv.id}
                    type="button"
                    data-testid={`kart-driver-${drv.id}`}
                    aria-pressed={p1Character === drv.id}
                    onClick={() => {
                      setP1Character(drv.id);
                      resetRace(circuitId, effectiveMode, undefined, undefined, undefined, drv.id);
                    }}
                  >
                    {drv.driverName} · {drv.speciesLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="game-pause-section">
              <span className="stack-label">Circuit</span>
              <div className="filter-group" role="group" aria-label="Circuit selection">
                {CIRCUIT_LIST.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`kart-circuit-${c.id}`}
                    aria-pressed={circuitId === c.id}
                    onClick={() => {
                      setCircuitId(c.id);
                      resetRace(c.id, effectiveMode);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="game-pause-section">
              <span className="stack-label">Audio</span>
              <div className="filter-group" role="group" aria-label="Audio controls">
                <button
                  type="button"
                  data-testid="pause-menu-sfx-btn"
                  aria-pressed={sfxOn}
                  onClick={() => setSharedSfxOn(!sfxOn)}
                >
                  {sfxOn ? 'Sound: On' : 'Sound: Off'}
                </button>
                <button
                  type="button"
                  data-testid="pause-menu-music-btn"
                  aria-pressed={musicOn}
                  onClick={() => {
                    getSharedArcadeAudio().setPlaylist(MICRO_KART_PLAYLIST);
                    setSharedMusicOn(!musicOn, true);
                  }}
                >
                  {musicOn ? 'Music: On' : 'Music: Off'}
                </button>
              </div>
            </div>

            <div className="game-pause-actions">
              <button
                type="button"
                className="primary"
                data-testid="pause-menu-resume"
                aria-label="Continue game"
                onClick={() => {
                  if (getSharedMusicOn()) {
                    getSharedArcadeAudio().ensureContext();
                  }
                  if (countdown > 0) {
                    triggerFreshCountdown();
                  }
                  setSharedGamePaused(false);
                }}
              >
                Continue
              </button>
              <button
                type="button"
                data-testid="pause-menu-restart"
                onClick={() => resetRace(circuitId, effectiveMode)}
              >
                Restart race
              </button>
              <button
                type="button"
                data-testid="pause-menu-exit"
                onClick={() => {
                  if (isOnline2P) void getSharedNetplay().leaveRoom();
                  setSharedGamePaused(false);
                  onExit();
                }}
              >
                Exit to Home
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
