// ─────────────────────────────────────────────────────────────────────────────
// Backend (T2). Thin orchestration: wires @tth/ai providers + @tth/db storage
// behind the @tth/shared API contract. Runs fully on mocks with no keys/db.
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createProviders } from "@tth/ai";
import { createStorage } from "@tth/db";
import {
  API_ROUTES,
  type CreateMemoryRequest,
  type StickerRequest,
  type StoryRequest,
  type StoryResponse,
  type TtsRequest,
} from "@tth/shared";

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
  const req = (await c.req.json()) as StoryRequest;
  const cached = await db.getCachedStory(req.spotId);
  if (cached) return c.json(toStoryResponse(cached));
  const story = await ai.story.generate(req);
  await db.putCachedStory({ ...story });
  return c.json(story);
});

// POST /api/tts — returns audio/mpeg bytes (client makes a Blob)
app.post(API_ROUTES.tts, async (c) => {
  const req = (await c.req.json()) as TtsRequest;
  const { audio, contentType } = await ai.tts.synthesize(req);
  return c.body(audio as unknown as ArrayBuffer, 200, { "content-type": contentType });
});

// POST /api/sticker — returns transparent PNG bytes
app.post(API_ROUTES.sticker, async (c) => {
  const req = (await c.req.json()) as StickerRequest;
  const { png } = await ai.sticker.cutout(req);
  return c.body(png as unknown as ArrayBuffer, 200, { "content-type": "image/png" });
});

// Memories (optional server persistence; client also stores locally)
app.get(API_ROUTES.memories, async (c) => c.json({ memories: await db.listMemories() }));
app.post(API_ROUTES.memories, async (c) => {
  const body = (await c.req.json()) as CreateMemoryRequest;
  const memory = await db.createMemory({
    ...body,
    id: `mem_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
    createdAt: Date.now(),
  });
  return c.json({ memory });
});

// TODO(frontend integration): serve the built PWA from apps/web/dist at "/" in prod.
// app.use("/*", serveStatic({ root: "../web/dist" }));

const port = Number(env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`[server] http://localhost:${port}  providers: story=${ai.story.name} tts=${ai.tts.name} sticker=${ai.sticker.name} db=${db.name}`);

function toStoryResponse(s: { spotId: string; title: string; narration: string; challenge: any }): StoryResponse {
  return { spotId: s.spotId, title: s.title, narration: s.narration, challenge: s.challenge };
}
