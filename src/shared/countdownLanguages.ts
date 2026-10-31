/**
 * Top 10 most spoken languages in the world (by total speakers, Ethnologue ~2025/2026)
 * for the arcade "Ready…" -> "Go!" ("预备…" -> "齐！", etc.) start countdown (#262).
 *
 * Each language's selection probability is proportional to its total speaker count
 * (`speakersMillions / TOTAL_COUNTDOWN_SPEAKERS_MILLIONS`), and its spoken audio
 * is bundled in `public/tetris/countdown-voices.m4a` at 1.5s sprite slots:
 * - Ready clip: `(spriteIndex * 2) * 1.5s` (duration 1.4s)
 * - Go! clip:   `(spriteIndex * 2 + 1) * 1.5s` (duration 1.4s)
 */

export interface CountdownLanguage {
  /** ISO 639-1 language code. */
  id: 'en' | 'zh' | 'hi' | 'es' | 'fr' | 'ar' | 'bn' | 'pt' | 'ru' | 'ur';
  /** English name of the language. */
  name: string;
  /** BCP-47 locale tag for Web Speech API fallback. */
  bcp47: string;
  /** Total speakers in millions (used as sampling probability weight). */
  speakersMillions: number;
  /** On-screen text for the "Ready" phase. */
  readyText: string;
  /** On-screen text for the "Go!" phase. */
  goText: string;
  /** 0-based index into `public/tetris/countdown-voices.m4a`. */
  spriteIndex: number;
}

export const COUNTDOWN_VOICE_SPRITE_SRC = 'tetris/countdown-voices.m4a';
export const COUNTDOWN_VOICE_SLOT_SEC = 1.5;

export const COUNTDOWN_LANGUAGES: ReadonlyArray<CountdownLanguage> = [
  {
    id: 'en',
    name: 'English',
    bcp47: 'en-US',
    speakersMillions: 1515,
    readyText: 'READY…',
    goText: 'GO!',
    spriteIndex: 0,
  },
  {
    id: 'zh',
    name: 'Mandarin Chinese',
    bcp47: 'zh-CN',
    speakersMillions: 1140,
    readyText: '预备…',
    goText: '齐！',
    spriteIndex: 1,
  },
  {
    id: 'hi',
    name: 'Hindi',
    bcp47: 'hi-IN',
    speakersMillions: 609,
    readyText: 'तैयार…',
    goText: 'शुरू!',
    spriteIndex: 2,
  },
  {
    id: 'es',
    name: 'Spanish',
    bcp47: 'es-ES',
    speakersMillions: 560,
    readyText: '¡LISTOS…',
    goText: '¡YA!',
    spriteIndex: 3,
  },
  {
    id: 'fr',
    name: 'French',
    bcp47: 'fr-FR',
    speakersMillions: 312,
    readyText: 'PRÊTS…',
    goText: 'PARTEZ !',
    spriteIndex: 4,
  },
  {
    id: 'ar',
    name: 'Standard Arabic',
    bcp47: 'ar-SA',
    speakersMillions: 274,
    readyText: 'استعد…',
    goText: 'انطلق!',
    spriteIndex: 5,
  },
  {
    id: 'bn',
    name: 'Bengali',
    bcp47: 'bn-IN',
    speakersMillions: 272,
    readyText: 'প্রস্তুত…',
    goText: 'শুরু!',
    spriteIndex: 6,
  },
  {
    id: 'pt',
    name: 'Portuguese',
    bcp47: 'pt-BR',
    speakersMillions: 264,
    readyText: 'PRONTOS…',
    goText: 'JÁ!',
    spriteIndex: 7,
  },
  {
    id: 'ru',
    name: 'Russian',
    bcp47: 'ru-RU',
    speakersMillions: 255,
    readyText: 'НА СТАРТ…',
    goText: 'МАРШ!',
    spriteIndex: 8,
  },
  {
    id: 'ur',
    name: 'Urdu',
    bcp47: 'ur-PK',
    speakersMillions: 232,
    readyText: 'تیار…',
    goText: 'چلو!',
    spriteIndex: 9,
  },
];

export const TOTAL_COUNTDOWN_SPEAKERS_MILLIONS: number = COUNTDOWN_LANGUAGES.reduce(
  (sum, lang) => sum + lang.speakersMillions,
  0,
);

let sessionTotalPicks = 0;
let lastPickedId: CountdownLanguage['id'] | null = null;
const sessionPickCounts: Record<CountdownLanguage['id'], number> = {
  en: 0,
  zh: 0,
  hi: 0,
  es: 0,
  fr: 0,
  ar: 0,
  bn: 0,
  pt: 0,
  ru: 0,
  ur: 0,
};

/**
 * Selects one of the 10 most spoken languages with probability strictly
 * proportional to its total speaker population (`speakersMillions / 5433`).
 *
 * - When a custom deterministic `rng` is supplied (unit tests, 2P Online seeds),
 *   uses direct quantile lookup against `TOTAL_COUNTDOWN_SPEAKERS_MILLIONS`.
 * - In interactive play (`rng === Math.random`), uses speaker-weighted quota
 *   sampling with back-to-back anti-repeat so all 10 languages (including
 *   Mandarin Chinese at 21.0%, Hindi at 11.2%, Spanish at 10.3%, etc.) appear
 *   in proportion to their speaker counts without random droughts (#276).
 */
export function pickCountdownLanguage(
  rng: () => number = Math.random,
): CountdownLanguage {
  if (rng !== Math.random) {
    const r = Math.max(0, Math.min(0.999999999, rng())) * TOTAL_COUNTDOWN_SPEAKERS_MILLIONS;
    let acc = 0;
    for (const lang of COUNTDOWN_LANGUAGES) {
      acc += lang.speakersMillions;
      if (r < acc) {
        return lang;
      }
    }
    return COUNTDOWN_LANGUAGES[0];
  }

  const nextTotal = sessionTotalPicks + 1;
  const candidates = COUNTDOWN_LANGUAGES.filter((l) => l.id !== lastPickedId);
  const weights = candidates.map((lang) => {
    const share = lang.speakersMillions / TOTAL_COUNTDOWN_SPEAKERS_MILLIONS;
    const expected = nextTotal * share;
    const actual = sessionPickCounts[lang.id] ?? 0;
    const deficit = Math.max(0.04, expected - actual);
    return deficit * lang.speakersMillions;
  });

  const weightSum = weights.reduce((a, b) => a + b, 0);
  let threshold = Math.random() * weightSum;
  let chosen = candidates[0] ?? COUNTDOWN_LANGUAGES[0];
  for (let i = 0; i < candidates.length; i += 1) {
    threshold -= weights[i];
    if (threshold <= 0) {
      chosen = candidates[i];
      break;
    }
  }

  sessionTotalPicks = nextTotal;
  sessionPickCounts[chosen.id] = (sessionPickCounts[chosen.id] ?? 0) + 1;
  lastPickedId = chosen.id;
  return chosen;
}
