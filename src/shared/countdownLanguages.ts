/**
 * Top 22 most spoken languages in the world (by total speakers, Ethnologue ~2025/2026)
 * for the arcade "Ready…" -> "Go!" ("预备…" -> "齐！", etc.) start countdown (#262, #331, #333).
 *
 * Each language's selection probability is strictly linear in its total speaker count
 * (`speakersMillions / TOTAL_COUNTDOWN_SPEAKERS_MILLIONS`), and its spoken audio
 * is bundled in `public/audio/countdown-voices.m4a` at 1.5s sprite slots:
 * - Ready clip: `(spriteIndex * 2) * 1.5s` (duration 1.4s)
 * - Go! clip:   `(spriteIndex * 2 + 1) * 1.5s` (duration 1.4s)
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
  /** Total speakers in millions (used as linear sampling probability weight). */
  speakersMillions: number;
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
    speakersMillions: 1515,
    flags: '🇺🇸 🇬🇧 🇨🇦 🇦🇺',
    readyText: 'READY…',
    goText: 'GO!',
    spriteIndex: 0,
  },
  {
    id: 'zh',
    name: 'Mandarin Chinese',
    bcp47: 'zh-CN',
    speakersMillions: 1140,
    flags: '🇨🇳 🇸🇬',
    readyText: '预备…',
    goText: '齐！',
    spriteIndex: 1,
  },
  {
    id: 'hi',
    name: 'Hindi',
    bcp47: 'hi-IN',
    speakersMillions: 609,
    flags: '🇮🇳',
    readyText: 'तैयार…',
    goText: 'शुरू!',
    spriteIndex: 2,
  },
  {
    id: 'es',
    name: 'Spanish',
    bcp47: 'es-ES',
    speakersMillions: 560,
    flags: '🇪🇸 🇲🇽 🇦🇷 🇨🇴',
    readyText: '¡LISTOS…',
    goText: '¡YA!',
    spriteIndex: 3,
  },
  {
    id: 'fr',
    name: 'French',
    bcp47: 'fr-FR',
    speakersMillions: 312,
    flags: '🇫🇷 🇨🇦 🇧🇪 🇨🇭',
    readyText: 'PRÊTS…',
    goText: 'PARTEZ !',
    spriteIndex: 4,
  },
  {
    id: 'ar',
    name: 'Standard Arabic',
    bcp47: 'ar-SA',
    speakersMillions: 274,
    flags: '🇸🇦 🇪🇬 🇦🇪 🇲🇦',
    readyText: 'استعد…',
    goText: 'انطلق!',
    spriteIndex: 5,
  },
  {
    id: 'bn',
    name: 'Bengali',
    bcp47: 'bn-IN',
    speakersMillions: 272,
    flags: '🇧🇩 🇮🇳',
    readyText: 'প্রস্তুত…',
    goText: 'শুরু!',
    spriteIndex: 6,
  },
  {
    id: 'pt',
    name: 'Portuguese',
    bcp47: 'pt-BR',
    speakersMillions: 264,
    flags: '🇧🇷 🇵🇹',
    readyText: 'PRONTOS…',
    goText: 'JÁ!',
    spriteIndex: 7,
  },
  {
    id: 'ru',
    name: 'Russian',
    bcp47: 'ru-RU',
    speakersMillions: 255,
    flags: '🇷🇺 🇰🇿',
    readyText: 'НА СТАРТ…',
    goText: 'МАРШ!',
    spriteIndex: 8,
  },
  {
    id: 'ur',
    name: 'Urdu',
    bcp47: 'ur-PK',
    speakersMillions: 232,
    flags: '🇵🇰 🇮🇳',
    readyText: 'تیار…',
    goText: 'چلو!',
    spriteIndex: 9,
  },
  {
    id: 'id',
    name: 'Indonesian',
    bcp47: 'id-ID',
    speakersMillions: 200,
    flags: '🇮🇩',
    readyText: 'SIAP…',
    goText: 'MULAI!',
    spriteIndex: 10,
  },
  {
    id: 'de',
    name: 'German',
    bcp47: 'de-DE',
    speakersMillions: 134,
    flags: '🇩🇪 🇦🇹 🇨🇭',
    readyText: 'BEREIT…',
    goText: 'LOS!',
    spriteIndex: 11,
  },
  {
    id: 'ja',
    name: 'Japanese',
    bcp47: 'ja-JP',
    speakersMillions: 123,
    flags: '🇯🇵',
    readyText: '用意…',
    goText: '始め！',
    spriteIndex: 12,
  },
  {
    id: 'pcm',
    name: 'Nigerian Pidgin',
    bcp47: 'en-NG',
    speakersMillions: 121,
    flags: '🇳🇬',
    readyText: 'OYA SET…',
    goText: 'OYA MOVE!',
    spriteIndex: 13,
  },
  {
    id: 'sw',
    name: 'Swahili',
    bcp47: 'sw-TZ',
    speakersMillions: 121,
    flags: '🇹🇿 🇰🇪',
    readyText: 'TAYARI…',
    goText: 'TWENDE!',
    spriteIndex: 14,
  },
  {
    id: 'mr',
    name: 'Marathi',
    bcp47: 'mr-IN',
    speakersMillions: 99,
    flags: '🇮🇳',
    readyText: 'तयार…',
    goText: 'सुरू!',
    spriteIndex: 15,
  },
  {
    id: 'te',
    name: 'Telugu',
    bcp47: 'te-IN',
    speakersMillions: 96,
    flags: '🇮🇳',
    readyText: 'సిద్ధం…',
    goText: 'పద!',
    spriteIndex: 16,
  },
  {
    id: 'tr',
    name: 'Turkish',
    bcp47: 'tr-TR',
    speakersMillions: 90,
    flags: '🇹🇷',
    readyText: 'HAZIR…',
    goText: 'BAŞLA!',
    spriteIndex: 17,
  },
  {
    id: 'ta',
    name: 'Tamil',
    bcp47: 'ta-IN',
    speakersMillions: 87,
    flags: '🇮🇳 🇱🇰 🇸🇬',
    readyText: 'தயார்…',
    goText: 'போ!',
    spriteIndex: 18,
  },
  {
    id: 'yue',
    name: 'Yue Chinese (Cantonese)',
    bcp47: 'zh-HK',
    speakersMillions: 86,
    flags: '🇭🇰 🇲🇴 🇨🇳',
    readyText: '準備…',
    goText: '去啦！',
    spriteIndex: 19,
  },
  {
    id: 'vi',
    name: 'Vietnamese',
    bcp47: 'vi-VN',
    speakersMillions: 86,
    flags: '🇻🇳',
    readyText: 'SẴN SÀNG…',
    goText: 'BẮT ĐẦU!',
    spriteIndex: 20,
  },
  {
    id: 'ko',
    name: 'Korean',
    bcp47: 'ko-KR',
    speakersMillions: 82,
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
 * linear in its total speaker population (`speakersMillions / 6758`, #262, #331, #333).
 *
 * - When a custom deterministic `rng` is supplied (unit tests, 2P Online seeds),
 *   uses direct linear quantile lookup against `TOTAL_COUNTDOWN_SPEAKERS_MILLIONS`.
 * - In interactive play (`rng === Math.random`), uses direct linear speaker-count
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
