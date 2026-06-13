// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs voice assignments for NearPast historical guides.
// Voice IDs come from GET /v1/voices on this account (listed 2026-06-13).
//
// Voice name → guide mapping:
//   Alice (British Female, young, calm)         → ada-lovelace
//   Daniel (Steady Broadcaster, British, formal) → winston-churchill, sherlock-holmes
//   Brian (Deep, Resonant and Comforting)        → karl-marx
//   George (Warm, Captivating Storyteller, British) → charles-dickens, john-logie-baird, christopher-wren
//   Lily (Velvety Actress, British)              → virginia-woolf
//   Bill (Wise, Mature, Balanced, old)           → samuel-johnson
//   Alice (Clear, Engaging Educator, British)    → mary-seacole
//   Will (Relaxed Optimist, American)            → jimi-hendrix
//   Grace (25-35 Year Old British Female)        → emmeline-pankhurst
// ─────────────────────────────────────────────────────────────────────────────

/** Maps each NearPast guide/character ID to an ElevenLabs voice ID. */
export const VOICE_BY_GUIDE: Record<string, string> = {
  // Science
  "ada-lovelace": "9rh371MqHF5jaDZ7VPvk",     // Alice - British Female (young, calm, british)
  "john-logie-baird": "JBFqnCBsd6RMkjVDRZzb",  // George - Warm, Captivating Storyteller (british)

  // Politics
  "winston-churchill": "onwK4e9ZLuTAKqWW03F9",  // Daniel - Steady Broadcaster (british, formal)
  "karl-marx": "nPczCjzI2devNBz1zQrb",           // Brian - Deep, Resonant and Comforting
  "emmeline-pankhurst": "LZAcK8Cx5QjdQhfBsJQZ", // Grace - 25-35 Year Old British Female

  // Literature
  "charles-dickens": "JBFqnCBsd6RMkjVDRZzb",   // George - Warm, Captivating Storyteller (british)
  "virginia-woolf": "pFZP5JQG7iQjIQuC4Bku",     // Lily - Velvety Actress (british, confident)
  "samuel-johnson": "pqHfZKP75CvOlQylNhV4",     // Bill - Wise, Mature, Balanced (old, crisp)

  // History
  "mary-seacole": "Xb7hH8MSUJpSbSDYk0k2",       // Alice - Clear, Engaging Educator (british, professional)
  "sherlock-holmes": "onwK4e9ZLuTAKqWW03F9",     // Daniel - Steady Broadcaster (british, crisp)

  // Music
  "jimi-hendrix": "bIHbv24MWmeRgasZH58o",        // Will - Relaxed Optimist (american, chill)

  // Architecture / Science
  "christopher-wren": "JBFqnCBsd6RMkjVDRZzb",   // George - Warm, Captivating Storyteller (british, mature)
};

/**
 * Fallback voice used when a guide ID is not found in VOICE_BY_GUIDE.
 * George: Warm, Captivating Storyteller — British, mature, narrative.
 */
export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
