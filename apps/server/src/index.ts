// ─────────────────────────────────────────────────────────────────────────────
// Backend (T2). Thin orchestration: wires @tth/ai providers + @tth/db storage
// behind the @tth/shared API contract. Runs fully on mocks with no keys/db.
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { createProviders } from "@tth/ai";
import { createStorage } from "@tth/db";
import {
  API_ROUTES,
  type ApiError,
  type CreateMemoryRequest,
  type StickerRequest,
  type StickerResponse,
  type StoryRequest,
  type StoryResponse,
  type TtsRequest,
} from "@tth/shared";

// Local dev convenience: load root .env.local if present (Railway injects real
// env vars in production, where this file won't exist and the call no-ops).
try {
  (process as { loadEnvFile?: (p: string) => void }).loadEnvFile?.("../../.env.local");
} catch {
  /* no .env.local — rely on the platform's injected env */
}

const env = process.env;
const ai = createProviders(env);
const db = createStorage(env);
await db.init();

const app = new Hono();
app.use("*", cors());

app.get(API_ROUTES.health, (c) =>
  c.json({
    ok: true,
    providers: { story: ai.story.name, tts: ai.tts.name, sticker: ai.sticker.name, db: db.name },
  })
);

app.get(API_ROUTES.spots, async (c) => c.json({ spots: await db.listSpots() }));

// POST /api/story — cache by spotId to protect free-tier limits (RESEARCH.md §4)
app.post(API_ROUTES.story, async (c) => {
  try {
    const req = validateStoryRequest(await parseJsonBody(c));
    const cached = await db.getCachedStory(req.spotId);
    if (cached) return c.json(toStoryResponse(cached));
    const story = await ai.story.generate(req);
    await db.putCachedStory({ ...story });
    return c.json(story);
  } catch (err) {
    return routeError(c, err, "story");
  }
});

// POST /api/tts — returns audio/mpeg bytes (client makes a Blob)
app.post(API_ROUTES.tts, async (c) => {
  try {
    const req = validateTtsRequest(await parseJsonBody(c));
    const { audio, contentType } = await ai.tts.synthesize(req);
    return c.body(audio as unknown as ArrayBuffer, 200, { "content-type": contentType });
  } catch (err) {
    return routeError(c, err, "tts");
  }
});

// POST /api/sticker — returns transparent PNG as a data URL
app.post(API_ROUTES.sticker, async (c) => {
  try {
    const req = validateStickerRequest(await parseJsonBody(c));
    const { png } = await ai.sticker.cutout(req);
    const body: StickerResponse = { stickerUrl: pngDataUrl(png) };
    return c.json(body);
  } catch (err) {
    return routeError(c, err, "sticker");
  }
});

// Memories (optional server persistence; client also stores locally)
app.get(API_ROUTES.memories, async (c) => {
  try {
    return c.json({ memories: await db.listMemories() });
  } catch (err) {
    return routeError(c, err, "memories");
  }
});
app.post(API_ROUTES.memories, async (c) => {
  try {
    const body = validateCreateMemoryRequest(await parseJsonBody(c));
    const memory = await db.createMemory({
      ...body,
      id: `mem_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
      createdAt: Date.now(),
    });
    return c.json({ memory });
  } catch (err) {
    return routeError(c, err, "memories");
  }
});

// TODO(frontend integration): serve the built PWA from apps/web/dist at "/" in prod.
// app.use("/*", serveStatic({ root: "../web/dist" }));

const port = Number(env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`[server] http://localhost:${port}  providers: story=${ai.story.name} tts=${ai.tts.name} sticker=${ai.sticker.name} db=${db.name}`);

function toStoryResponse(s: { spotId: string; title: string; narration: string; challenge: any }): StoryResponse {
  return { spotId: s.spotId, title: s.title, narration: s.narration, challenge: s.challenge };
}

class BadRequestError extends Error {}

async function parseJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }
}

function routeError(c: Context, err: unknown, label: string) {
  if (err instanceof BadRequestError) {
    return c.json<ApiError>({ error: err.message }, 400);
  }
  console.error(`[server] ${label} failed`, err);
  return c.json<ApiError>(
    { error: "Provider or storage failure", detail: err instanceof Error ? err.message : String(err) },
    502
  );
}

function validateStoryRequest(body: unknown): StoryRequest {
  const o = objectBody(body);
  const req: StoryRequest = {
    spotId: nonEmptyString(o.spotId, "spotId"),
    lat: finiteNumber(o.lat, "lat"),
    lng: finiteNumber(o.lng, "lng"),
    timeOfDay: timeOfDay(o.timeOfDay),
  };
  if (o.placeName !== undefined) req.placeName = nonEmptyString(o.placeName, "placeName");
  if (o.seed !== undefined) req.seed = nonEmptyString(o.seed, "seed");
  return req;
}

function validateTtsRequest(body: unknown): TtsRequest {
  const o = objectBody(body);
  const req: TtsRequest = { text: nonEmptyString(o.text, "text") };
  if (o.voiceId !== undefined) req.voiceId = nonEmptyString(o.voiceId, "voiceId");
  if (o.spotId !== undefined) req.spotId = nonEmptyString(o.spotId, "spotId");
  return req;
}

function validateStickerRequest(body: unknown): StickerRequest {
  const o = objectBody(body);
  const imageBase64 = nonEmptyString(o.imageBase64, "imageBase64");
  if (!isPlausibleBase64Image(imageBase64)) {
    throw new BadRequestError("imageBase64 must be base64 image data or a data URL");
  }
  const req: StickerRequest = { imageBase64 };
  if (o.mode !== undefined) {
    if (o.mode !== "cutout" && o.mode !== "stylize") throw new BadRequestError("mode must be cutout or stylize");
    req.mode = o.mode;
  }
  return req;
}

function validateCreateMemoryRequest(body: unknown): CreateMemoryRequest {
  const o = objectBody(body);
  const req: CreateMemoryRequest = {
    day: nonEmptyString(o.day, "day"),
    spotId: nonEmptyString(o.spotId, "spotId"),
    photoUrl: nonEmptyString(o.photoUrl, "photoUrl"),
    stickerUrl: nonEmptyString(o.stickerUrl, "stickerUrl"),
    lat: finiteNumber(o.lat, "lat"),
    lng: finiteNumber(o.lng, "lng"),
  };
  if (o.caption !== undefined) req.caption = nonEmptyString(o.caption, "caption");
  return req;
}

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("JSON body must be an object");
  }
  return body as Record<string, unknown>;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestError(`${field} must be a non-empty string`);
  }
  return value;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BadRequestError(`${field} must be a finite number`);
  }
  return value;
}

function timeOfDay(value: unknown): StoryRequest["timeOfDay"] {
  if (value === "morning" || value === "afternoon" || value === "evening" || value === "night") {
    return value;
  }
  throw new BadRequestError("timeOfDay must be morning, afternoon, evening, or night");
}

function isPlausibleBase64Image(input: string): boolean {
  const base64 = input.startsWith("data:") ? input.split(",", 2)[1] ?? "" : input;
  return base64.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(base64) && base64.length % 4 === 0;
}

function pngDataUrl(png: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}
