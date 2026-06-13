// ─────────────────────────────────────────────────────────────────────────────
// API contract — the integration seam between Frontend (T1), Backend (T2),
// AI (T3) and DB (T4). Route paths + request/response shapes live here ONLY.
// ─────────────────────────────────────────────────────────────────────────────

import type { Challenge, Memory, Story, TimeOfDay } from "./types.js";

export const API_ROUTES = {
  health: "/api/health",
  spots: "/api/spots",
  story: "/api/story",
  tts: "/api/tts",
  sticker: "/api/sticker",
  memories: "/api/memories",
  voiceToken: "/api/voice-token",
} as const;

// ── POST /api/story ─────────────────────────────────────────────────────────
export type StoryRequest = {
  spotId: string;
  lat: number;
  lng: number;
  placeName?: string;
  timeOfDay: TimeOfDay;
  seed?: string;
};
export type StoryResponse = {
  spotId: string;
  title: string;
  narration: string;
  challenge: Challenge;
};

// ── POST /api/tts ─────────────────────────────────────────────────────────────
// Returns audio. Default transport = audio/mpeg bytes; { url } when the server
// caches to storage. Frontend handles both (Blob or url).
export type TtsRequest = {
  text: string;
  voiceId?: string;
  /** echoed back so the client can cache by spot */
  spotId?: string;
};
export type TtsJsonResponse = { url: string };

// ── POST /api/sticker ──────────────────────────────────────────────────────────
export type StickerRequest = {
  /** base64 (no data: prefix) or full data URL; server normalises */
  imageBase64: string;
  /** "cutout" = bg removal + white outline; "stylize" = AI sticker (Nano Banana) */
  mode?: "cutout" | "stylize";
};
export type StickerResponse = {
  /** transparent PNG, data URL or hosted url */
  stickerUrl: string;
};

// ── GET/POST /api/memories ─────────────────────────────────────────────────────
// Optional server-side persistence (DB track). Client also persists locally,
// so these are no-ops in the default client-only mode.
export type MemoriesResponse = { memories: Memory[] };
export type CreateMemoryRequest = Omit<Memory, "id" | "createdAt">;
export type CreateMemoryResponse = { memory: Memory };

// ── POST /api/voice-token ──────────────────────────────────────────────────────
// Mints a short-lived ElevenLabs Conversational-AI session token. The token
// embeds a signed WebSocket URL that the client uses to open a conversation.
export type VoiceTokenRequest = {
  /** Optional: inject a character-specific override (system prompt / voice). */
  guideId?: string;
};
export type VoiceTokenResponse = {
  /** JWT returned by ElevenLabs /v1/convai/conversation/token */
  conversationToken: string;
};

export type ApiError = { error: string; detail?: string };

/** Re-export Story so a client can build the full object from StoryResponse + TTS. */
export type { Story };
