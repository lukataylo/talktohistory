// ─────────────────────────────────────────────────────────────────────────────
// Resilient NearPast backend client. Every call degrades gracefully: on any
// non-2xx, error, or timeout it returns null so the UI can fall back to local
// demo content. No external deps.
// ─────────────────────────────────────────────────────────────────────────────

import {
  API_ROUTES,
  type StoryRequest,
  type StoryResponse,
  type TtsRequest,
} from "@tth/shared";

/** Base URL for the backend. Empty string = same-origin. */
export const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

const TIMEOUT_MS = 8000;

/** POST JSON with an AbortController timeout. Throws on timeout/network error. */
async function postWithTimeout(
  route: string,
  body: unknown,
  headers: Record<string, string> = { "Content-Type": "application/json" },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${route}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** POST /api/story → generated ghost story, or null on any failure. */
export async function fetchStory(
  req: StoryRequest,
): Promise<StoryResponse | null> {
  try {
    const res = await postWithTimeout(API_ROUTES.story, req);
    if (!res.ok) return null;
    return (await res.json()) as StoryResponse;
  } catch {
    return null;
  }
}

/**
 * POST /api/tts → narration audio (server returns audio/mpeg bytes).
 * Returns an object URL for the audio Blob, or null on any failure.
 */
export async function fetchNarrationUrl(
  req: TtsRequest,
): Promise<string | null> {
  try {
    const res = await postWithTimeout(API_ROUTES.tts, req);
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * POST /api/sticker → server returns JSON { stickerUrl }.
 * Returns the sticker URL, or null on any failure.
 */
export async function fetchSticker(
  imageBase64: string,
  mode?: "cutout" | "stylize",
): Promise<string | null> {
  try {
    const res = await postWithTimeout(API_ROUTES.sticker, { imageBase64, mode });
    if (!res.ok) return null;
    const data = (await res.json()) as { stickerUrl?: string };
    return data.stickerUrl ?? null;
  } catch {
    return null;
  }
}
