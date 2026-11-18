/**
 * Top 22 most spoken languages in the world for the arcade "Ready…" -> "Go!"
 * ("预备…" -> "齐！", etc.) start countdown (#262, #331, #333, #366).
 *
 * Weighting model (`1/N` Global Multilingual Fractional Person-Equivalents, #366):
 * - Raw `L1 + L2` speaker totals (`6,758M`) double- or triple-count multilingual speakers
 *   (e.g. a speaker of Marathi + Hindi + English, or Javanese + Indonesian, or Yoruba +
 *   Nigerian Pidgin + English).
 * - Instead, each speaker of `k` languages globally (including non-top-22 local languages
 *   such as Javanese, Punjabi, Pashto, regional Sinitic, and African L1s) contributes `1/k`
 *   person-equivalents toward each spoken language (`speakersMillions`, summing to `4,555M`).
 * - Selection probability is strictly linear in `speakersMillions / TOTAL_COUNTDOWN_SPEAKERS_MILLIONS`,
 *   and spoken audio is bundled in `public/audio/countdown-voices.m4a` at 1.5s sprite slots:
 *   - Ready clip: `(spriteIndex * 2) * 1.5s` (duration 1.4s)
 *   - Go! clip:   `(spriteIndex * 2 + 1) * 1.5s` (duration 1.4s)
 */

export type CountdownLanguageId =
  | 'en'
  | 'zh'
  | 'hi'
  | 'es'
  | 'fr'
  | 'ar'
  | 'bn'
  | 'pt'
  | 'ru'
  | 'ur'
  | 'id'
  | 'de'
  | 'ja'
  | 'pcm'
  | 'sw'
  | 'mr'
  | 'te'
  | 'tr'
  | 'ta'
  | 'yue'
  | 'vi'
  | 'ko';

export interface CountdownLanguage {
  /** ISO 639-1 / 639-3 language code. */
  id: CountdownLanguageId;
  /** English name of the language. */
  name: string;
  /** BCP-47 locale tag for Web Speech API fallback. */
  bcp47: string;
  /**
   * `1/N` multilingual-adjusted person-equivalent speakers in millions
   * (used as linear sampling probability weight, #366).
   */
  speakersMillions: number;
  /** Unadjusted Ethnologue L1 + L2 total speakers in millions (for reference). */
  rawTotalMillions: number;
  /** Ethnologue first-language (L1) speakers in millions. */
  l1Millions: number;
  /** Ethnologue second/additional-language (L2+) speakers in millions. */
  l2Millions: number;
  /** Flag emojis of the major countries where the language is spoken (#331, #333). */
  flags: string;
  /** On-screen text for the "Ready" phase. */
  readyText: string;
  /** On-screen text for the "Go!" phase. */
  goText: string;
  /** 0-based index into `public/audio/countdown-voices.m4a`. */
  spriteIndex: number;
}

export const COUNTDOWN_VOICE_SPRITE_SRC = 'audio/countdown-voices.m4a';
export const COUNTDOWN_VOICE_SLOT_SEC = 1.5;

export const COUNTDOWN_LANGUAGES: ReadonlyArray<CountdownLanguage> = [
  {
    id: 'en',
    name: 'English',
    bcp47: 'en-US',
    speakersMillions: 805,
    rawTotalMillions: 1515,
    l1Millions: 380,
    l2Millions: 1135,
    flags: '🇺🇸 🇬🇧 🇨🇦 🇦🇺',
    readyText: 'READY…',
    goText: 'GO!',
    spriteIndex: 0,
  },
  {
    id: 'zh',
    name: 'Mandarin Chinese',
    bcp47: 'zh-CN',
    speakersMillions: 955,
    rawTotalMillions: 1140,
    l1Millions: 940,
    l2Millions: 200,
    flags: '🇨🇳 🇸🇬',
    readyText: '预备…',
    goText: '齐！',
    spriteIndex: 1,
  },
  {
    id: 'hi',
    name: 'Hindi',
    bcp47: 'hi-IN',
    speakersMillions: 365,
    rawTotalMillions: 609,
    l1Millions: 345,
    l2Millions: 264,
    flags: '🇮🇳',
    readyText: 'तैयार…',
    goText: 'शुरू!',
    spriteIndex: 2,
  },
  {
    id: 'es',
    name: 'Spanish',
    bcp47: 'es-ES',
    speakersMillions: 470,
    rawTotalMillions: 560,
    l1Millions: 485,
    l2Millions: 75,
    flags: '🇪🇸 🇲🇽 🇦🇷 🇨🇴',
    readyText: '¡LISTOS…',
    goText: '¡YA!',
    spriteIndex: 3,
  },
  {
    id: 'fr',
    name: 'French',
    bcp47: 'fr-FR',
    speakersMillions: 155,
    rawTotalMillions: 312,
    l1Millions: 74,
    l2Millions: 238,
    flags: '🇫🇷 🇨🇦 🇧🇪 🇨🇭',
    readyText: 'PRÊTS…',
    goText: 'PARTEZ !',
    spriteIndex: 4,
  },
  {
    id: 'ar',
    name: 'Standard Arabic',
    bcp47: 'ar-SA',
    speakersMillions: 175,
    rawTotalMillions: 274,
    l1Millions: 0,
    l2Millions: 274,
    flags: '🇸🇦 🇪🇬 🇦🇪 🇲🇦',
    readyText: 'استعد…',
    goText: 'انطلق!',
    spriteIndex: 5,
  },
  {
    id: 'bn',
    name: 'Bengali',
    bcp47: 'bn-IN',
    speakersMillions: 220,
    rawTotalMillions: 272,
    l1Millions: 234,
    l2Millions: 38,
    flags: '🇧🇩 🇮🇳',
    readyText: 'প্রস্তুত…',
    goText: 'শুরু!',
    spriteIndex: 6,
  },
  {
    id: 'pt',
    name: 'Portuguese',
    bcp47: 'pt-BR',
    speakersMillions: 232,
    rawTotalMillions: 264,
    l1Millions: 236,
    l2Millions: 28,
    flags: '🇧🇷 🇵🇹',
    readyText: 'PRONTOS…',
    goText: 'JÁ!',
    spriteIndex: 7,
  },
  {
    id: 'ru',
    name: 'Russian',
    bcp47: 'ru-RU',
    speakersMillions: 180,
    rawTotalMillions: 255,
    l1Millions: 148,
    l2Millions: 107,
    flags: '🇷🇺 🇰🇿',
    readyText: 'НА СТАРТ…',
    goText: 'МАРШ!',
    spriteIndex: 8,
  },
  {
    id: 'ur',
    name: 'Urdu',
    bcp47: 'ur-PK',
    speakersMillions: 92,
    rawTotalMillions: 232,
    l1Millions: 78,
    l2Millions: 154,
    flags: '🇵🇰 🇮🇳',
    readyText: 'تیار…',
    goText: 'چلو!',
    spriteIndex: 9,
  },
  {
    id: 'id',
    name: 'Indonesian',
    bcp47: 'id-ID',
    speakersMillions: 112,
    rawTotalMillions: 200,
    l1Millions: 44,
    l2Millions: 156,
    flags: '🇮🇩',
    readyText: 'SIAP…',
    goText: 'MULAI!',
    spriteIndex: 10,
  },
  {
    id: 'de',
    name: 'German',
    bcp47: 'de-DE',
    speakersMillions: 88,
    rawTotalMillions: 134,
    l1Millions: 76,
    l2Millions: 58,
    flags: '🇩🇪 🇦🇹 🇨🇭',
    readyText: 'BEREIT…',
    goText: 'LOS!',
    spriteIndex: 11,
  },
  {
    id: 'ja',
    name: 'Japanese',
    bcp47: 'ja-JP',
    speakersMillions: 118,
    rawTotalMillions: 123,
    l1Millions: 122,
    l2Millions: 1,
    flags: '🇯🇵',
    readyText: '用意…',
    goText: '始め！',
    spriteIndex: 12,
  },
  {
    id: 'pcm',
    name: 'Nigerian Pidgin',
    bcp47: 'en-NG',
    speakersMillions: 46,
    rawTotalMillions: 121,
    l1Millions: 5,
    l2Millions: 116,
    flags: '🇳🇬',
    readyText: 'OYA SET…',
    goText: 'OYA MOVE!',
    spriteIndex: 13,
  },
  {
    id: 'sw',
    name: 'Swahili',
    bcp47: 'sw-TZ',
    speakersMillions: 48,
    rawTotalMillions: 121,
    l1Millions: 16,
    l2Millions: 105,
    flags: '🇹🇿 🇰🇪',
    readyText: 'TAYARI…',
    goText: 'TWENDE!',
    spriteIndex: 14,
  },
  {
    id: 'mr',
    name: 'Marathi',
    bcp47: 'mr-IN',
    speakersMillions: 68,
    rawTotalMillions: 99,
    l1Millions: 83,
    l2Millions: 16,
    flags: '🇮🇳',
    readyText: 'तयार…',
    goText: 'सुरू!',
    spriteIndex: 15,
  },
  {
    id: 'te',
    name: 'Telugu',
    bcp47: 'te-IN',
    speakersMillions: 72,
    rawTotalMillions: 96,
    l1Millions: 83,
    l2Millions: 13,
    flags: '🇮🇳',
    readyText: 'సిద్ధం…',
    goText: 'పద!',
    spriteIndex: 16,
  },
  {
    id: 'tr',
    name: 'Turkish',
    bcp47: 'tr-TR',
    speakersMillions: 80,
    rawTotalMillions: 90,
    l1Millions: 84,
    l2Millions: 6,
    flags: '🇹🇷',
    readyText: 'HAZIR…',
    goText: 'BAŞLA!',
    spriteIndex: 17,
  },
  {
    id: 'ta',
    name: 'Tamil',
    bcp47: 'ta-IN',
    speakersMillions: 68,
    rawTotalMillions: 87,
    l1Millions: 79,
    l2Millions: 8,
    flags: '🇮🇳 🇱🇰 🇸🇬',
    readyText: 'தயார்…',
    goText: 'போ!',
    spriteIndex: 18,
  },
  {
    id: 'yue',
    name: 'Yue Chinese (Cantonese)',
    bcp47: 'zh-HK',
    speakersMillions: 48,
    rawTotalMillions: 86,
    l1Millions: 85,
    l2Millions: 1,
    flags: '🇭🇰 🇲🇴 🇨🇳',
    readyText: '準備…',
    goText: '去啦！',
    spriteIndex: 19,
  },
  {
    id: 'vi',
    name: 'Vietnamese',
    bcp47: 'vi-VN',
    speakersMillions: 81,
    rawTotalMillions: 86,
    l1Millions: 85,
    l2Millions: 1,
    flags: '🇻🇳',
    readyText: 'SẴN SÀNG…',
    goText: 'BẮT ĐẦU!',
    spriteIndex: 20,
  },
  {
    id: 'ko',
    name: 'Korean',
    bcp47: 'ko-KR',
    speakersMillions: 77,
    rawTotalMillions: 82,
    l1Millions: 81,
    l2Millions: 1,
    flags: '🇰🇷',
    readyText: '준비…',
    goText: '시작!',
    spriteIndex: 21,
  },
];

export const TOTAL_COUNTDOWN_SPEAKERS_MILLIONS: number = COUNTDOWN_LANGUAGES.reduce(
  (sum, lang) => sum + lang.speakersMillions,
  0,
);

let lastPickedId: CountdownLanguage['id'] | null = null;

/**
 * Selects one of the 22 most spoken languages with probability strictly
 * linear in its `1/N` multilingual-adjusted person-equivalent weight
 * (`speakersMillions / 4555`, #262, #331, #333, #366).
 *
 * - When a custom deterministic `rng` is supplied (unit tests, 2P Online seeds),
 *   uses direct linear quantile lookup against `TOTAL_COUNTDOWN_SPEAKERS_MILLIONS`.
 * - In interactive play (`rng === Math.random`), uses direct linear weight
 *   sampling with back-to-back anti-repeat (`l.id !== lastPickedId`).
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

  const candidates = COUNTDOWN_LANGUAGES.filter((l) => l.id !== lastPickedId);
  const weightSum = candidates.reduce((sum, lang) => sum + lang.speakersMillions, 0);
  let threshold = Math.random() * weightSum;
  let chosen = candidates[0] ?? COUNTDOWN_LANGUAGES[0];
  for (let i = 0; i < candidates.length; i += 1) {
    threshold -= candidates[i].speakersMillions;
    if (threshold <= 0) {
      chosen = candidates[i];
      break;
    }
  }

  lastPickedId = chosen.id;
  return chosen;
}
