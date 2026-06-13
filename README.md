# TalkToHistory

Location-based ghost stories for the 8X mobile hackathon: a soft white map, nearby haunted spots, AI-narrated story unlocks, lightweight real-world challenges, and a day-by-day memory sticker view.

## What is in this repo

- `apps/web` - Vite React PWA prototype with the map-style ghost hunting experience.
- `apps/mobile` - Expo Go app prototype with the same core loop and a map renderer boundary for future Mapbox/MapLibre work.
- `apps/server` - Hono API server that exposes spots, story generation, text-to-speech, stickers, and memories.
- `packages/shared` - shared domain types, seed locations, API contracts, story prompt, and proximity engine.
- `packages/ai` - mock/Gemini/ElevenLabs/sticker provider interfaces.
- `packages/db` - in-memory storage plus a Postgres storage seam for later.

## Product loop

1. Open the map and see nearby haunted pins.
2. Move within range, or use demo unlock for judging.
3. Unlock a short ghost story.
4. Complete a selfie or walk challenge.
5. Save the result into a daily memory/sticker view.

The app is designed to ship on hackathon day: the whole flow works with mock providers, then Gemini and ElevenLabs can be enabled by adding keys.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Fill in `.env.local` when using live AI:

```env
AI_STORY_PROVIDER=gemini
GEMINI_API_KEY=

AI_TTS_PROVIDER=eleven
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

Keep `AI_STICKER_PROVIDER=mock` unless the sticker provider is explicitly configured.

Optional Mapbox config for the PWA:

```env
VITE_MAPBOX_ACCESS_TOKEN=
VITE_MAPBOX_STYLE=mapbox://styles/mapbox/light-v11
```

If no Mapbox token is present, the web app falls back to the built-in map-style renderer so the demo still works.

## Run locally

Build shared packages:

```bash
pnpm build:packages
```

Run the API server:

```bash
pnpm dev:server
```

Run the PWA:

```bash
pnpm dev:web
```

Run Expo Go:

```bash
pnpm dev:mobile
```

Useful local URLs:

- Web app: `http://localhost:5173`
- API health: `http://localhost:8787/api/health`

## Deployment

Production target brand/domain: **NearPast** at `nearpast.com`.

Railway provisioning notes and next-agent domain instructions live in [RAILWAY_NEARPAST_HANDOFF.md](./RAILWAY_NEARPAST_HANDOFF.md).

## Validation

```bash
pnpm typecheck
pnpm --filter @tth/web build
pnpm --filter @tth/mobile typecheck
```

## Map engine direction

The shared package intentionally uses only portable data contracts such as `LatLng`, `GhostSpot`, `Fix`, and `Memory`. Map rendering is kept inside app-level components/adapters so the current map-style prototype can move between Mapbox and MapLibre without changing the game logic.

## Demo notes

- Use demo unlock/teleport flows when GPS is unreliable indoors.
- Keep the first judging path short: map, unlock, story, challenge, memory sticker.
- The PWA and Expo app are intentionally mock-friendly so they can still demo without external API failures.
