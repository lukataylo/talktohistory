<!-- Banner: swap in a wider hero image by placing it at docs/banner.png and changing the src below -->
![NearPast](apps/web/public/logo.svg)

# NearPast

> **Talk to history where it happened.**

Step onto a London street and the people who shaped the world step out to meet you — in their own voice, in their own words, right where they lived.

[![Live demo](https://img.shields.io/badge/Try%20it-nearpast.com-4f46e5?style=for-the-badge)](https://nearpast.com)
[![PWA](https://img.shields.io/badge/PWA-installable-22c55e?style=for-the-badge)](#quickstart)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

---

## 60-second demo walkthrough

| Step | What you do | What happens |
|------|-------------|--------------|
| 1 | Open [nearpast.com](https://nearpast.com) or install the PWA | A soft-white Mapbox map of London loads; glowing pins mark historical figures nearby |
| 2 | Walk toward a pin — or tap **Demo Unlock** indoors | The pin pulses. You're in range of Karl Marx, Ada Lovelace, Charles Dickens… |
| 3 | Tap the pin | A historically-grounded AI story plays **in the figure's own British voice** via ElevenLabs |
| 4 | Tap **Talk to me** | A live voice conversation begins — ask anything; gpt-4o-mini responds in character |
| 5 | Complete the photo challenge | Your photo is cut out and rendered as a collectible **sticker** via gpt-image-1 |
| 6 | Open **My Scrapbook** | Every encounter is logged in a day-by-day memory book with your stickers |
| 7 | Join a **Guided Tour** | Ten curated multi-stop walks link figures, places, and partner venues across the city |

---

## Features

- 📍 **Location-aware history** — Mapbox pins placed at the exact addresses where figures lived, worked, and died
- 🗣️ **AI-authored stories** — Gemini writes place-specific, historically-grounded narratives in the figure's voice
- 🎙️ **Live voice conversation** — real-time back-and-forth spoken dialogue powered by gpt-4o-mini + ElevenLabs
- 📸 **Photo challenges** — complete a real-world challenge at the location, capture a photo
- 🏷️ **Collectible stickers** — OpenAI gpt-image-1 renders your photo into a period-appropriate sticker
- 📖 **Memory scrapbook** — every encounter saved, grouped by day, beautifully laid out
- 🗺️ **10 guided walking tours** — multi-stop thematic routes (Victorian London, Suffragettes, WWII…)
- 🏪 **Partner stops** — cafés, bookshops, and museums integrated into tour routes
- 📲 **Installable PWA** — works offline, adds to home screen, no App Store required
- 🍎 **Native iOS app** — Expo wrapper with native GPS, camera, and audio for maximum reliability

---

## How it works

```
┌─────────────────────────────────┐
│  User device (PWA / iOS app)    │
│                                 │
│  Mapbox map ──► pin tap         │
│         │                       │
│         ▼                       │
│  Proximity engine               │  GPS fix → accuracy gate → Kalman
│  (packages/shared)              │  smooth → hysteresis unlock
│         │                       │
│         ▼                       │
│  Voice UI (ElevenLabs SDK)      │  streams narration audio
│  Conversation UI (gpt-4o-mini)  │  live back-and-forth voice
│  Camera / photo challenge       │
└───────────┬─────────────────────┘
            │  HTTPS / JSON
            ▼
┌─────────────────────────────────┐
│  Hono API  (Railway)            │
│                                 │
│  POST /api/story  → Gemini      │  historically-grounded narrative
│  POST /api/tts    → ElevenLabs  │  British character voice
│  POST /api/converse→ gpt-4o-mini│  in-character dialogue
│  POST /api/sticker→ gpt-image-1 │  collectible sticker art
│  GET  /*          → PWA static  │
└───────────┬─────────────────────┘
            │
   ┌────────┴────────┐
   │  Third-party AI │
   │  Gemini 2.5     │
   │  ElevenLabs     │
   │  OpenAI         │
   └─────────────────┘
```

**All API keys live only on the backend.** The client never touches a secret.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite 6, TypeScript, PWA (Workbox) |
| Map | Mapbox GL JS |
| Native shell | Expo SDK 53 (iOS) — WebView + native GPS/camera/audio bridges |
| API server | Hono on Railway |
| Monorepo | pnpm workspaces (`@tth/shared`, `@tth/ai`, `@tth/db`) |
| Story AI | Google Gemini 2.5 Flash (structured output) |
| Voice AI | ElevenLabs Flash v2.5 — narration + live conversation |
| Dialogue AI | OpenAI gpt-4o-mini (in-character back-and-forth) |
| Sticker AI | OpenAI gpt-image-1 |
| Auth | Magic-link (email, no password) |
| Storage | Railway Postgres + client IndexedDB |

---

## Quickstart

```bash
# Prerequisites: Node ≥ 20, pnpm ≥ 10
git clone https://github.com/your-org/nearpast && cd nearpast

pnpm install

# Copy env template and fill in your keys
cp apps/server/.env.example apps/server/.env

# Start everything (builds shared packages first, then runs all apps in parallel)
pnpm dev
```

**Local URLs after `pnpm dev`:**

| Service | URL |
|---------|-----|
| PWA | http://localhost:5173 |
| API server | http://localhost:8787 |
| API health | http://localhost:8787/api/health |

### Environment variables (server)

```env
# AI providers
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# OpenAI (conversation + stickers)
OPENAI_API_KEY=

# Mapbox (client-side, safe to expose)
VITE_MAPBOX_ACCESS_TOKEN=
```

The PWA falls back to a built-in map renderer when no Mapbox token is present, so you can demo the full AI loop without a Mapbox account.

### Other useful commands

```bash
pnpm typecheck            # full type-check across monorepo
pnpm build:packages       # build shared packages only
pnpm --filter @tth/web build   # production PWA build
pnpm dev:server           # API server only
pnpm dev:web              # PWA only
pnpm dev:mobile           # Expo Go shell
```

---

## Repository layout

```
nearpast/
├── apps/
│   ├── web/        # Vite + React PWA — the full experience
│   ├── mobile/     # Expo iOS shell (WebView + native bridges)
│   └── server/     # Hono API — AI calls, key custody, static hosting
├── packages/
│   ├── shared/     # TS types, proximity engine, API client, Gemini prompts
│   ├── ai/         # Provider interfaces (Gemini / ElevenLabs / OpenAI)
│   └── db/         # Storage (in-memory dev + Postgres seam)
└── wiki/           # GitHub wiki source (copy into wiki repo to publish)
```

---

## 💰 Commercial / Business

NearPast sits at the intersection of **edtech, tourism, and AI companions** — three markets growing simultaneously. Here is how the business works and why it is fundable.

### Revenue streams

| Stream | Mechanism |
|--------|-----------|
| **Consumer subscription** | Free tier: 3 unlocks/day, 1 voice. NearPast Plus (£7.99/mo or £59.99/yr): unlimited conversations, all voices, offline tour maps, exclusive character packs |
| **B2B licensing** | White-label SDK + content for tourism boards, city councils, heritage bodies, and museum groups. Think Visit London, Historic England, National Trust — institutions already spending on audio guides that convert at 2–5% of footfall |
| **Sponsored partner stops** | Cafés, bookshops, and attractions pay a placement fee (CPM or flat monthly) to appear as "recommended stops" along tour routes — an in-context, non-intrusive ad format with measurable foot-traffic attribution |
| **Premium character & voice packs** | One-time IAP (£2.99–£9.99): unlock exclusive figures (Shakespeare, Florence Nightingale, Bowie…), celebrity narrator voices, or themed tour bundles |

### Why NearPast is monetizable

1. **Location locks engagement.** Users convert only when they are physically present — intent and context are pre-qualified. Churn is lower than pure-digital products because the experience is tied to real-world travel.
2. **Session quality over session quantity.** A 15-minute guided voice conversation at a landmark is worth more to an advertiser than 50 passive ad impressions. Partner stops can prove foot-traffic lift via GPS dwell data.
3. **B2B is immediate and high-margin.** A single licensing deal with a city tourism board (typical deal size £30k–£150k/yr) is worth thousands of consumer subscriptions and has a short sales cycle when the live demo exists.
4. **AI cost curve is falling fast.** Gemini Flash and ElevenLabs Flash keep per-story marginal cost under £0.01, so contribution margin is high even at early subscriber scale.

### Comparable companies

#### Replika

Replika (Luka Inc., founded 2017) is an AI companion app — a chatbot you can talk to as a friend, romantic partner, or therapist. It has surpassed **30 million registered users** and generated an estimated **$200–300 M** in lifetime revenue. Replika makes money because:

- **Emotional attachment creates extraordinary retention.** Daily active users who form a bond with their Replika log 20+ minutes/session. That depth converts into subscriptions (Replika Pro, ~$70/yr) at rates most consumer apps cannot reach.
- **Pure subscription, no ads.** Premium unlocks relationship personas, voice calls, and memory — exactly the features users most want, so willingness-to-pay is high.
- **No physical-world dependency.** Replika works anywhere, which is a growth advantage but also its ceiling — it cannot unlock the tourism and B2B institutional revenue that requires real places.

#### Character.AI

Character.AI (c.ai, founded 2021) lets users chat with AI personas — celebrities, fictional characters, and user-created bots. As of 2024, c.ai reported **20 million daily active users** and crossed **$200 M ARR** on a path toward a ~**$5 B valuation**. It makes money because:

- **Massive engagement flywheel.** Average session time reportedly exceeds YouTube and TikTok among its teen-skewing demographic. High DAU/MAU ratios signal genuine habit formation.
- **Creator marketplace + subscriptions.** c.ai+ (~$10/mo) offers faster responses and exclusive features; the creator-bot marketplace adds viral, low-cost user acquisition.
- **Scale effects on content.** User-generated characters mean c.ai's content library grows without editorial cost — but it also means quality and safety are harder to control.

#### How NearPast differs — and wins

| Dimension | Replika / Character.AI | NearPast |
|-----------|------------------------|----------|
| **Setting** | Anywhere (living room, bedroom) | Real, specific places — the character's actual address |
| **Revenue ceiling** | Consumer subscription only | Consumer + B2B licensing + partner-stop commerce |
| **Trust & brand** | Entertainment / companionship | Education, heritage, tourism — institutional credibility |
| **Churn driver** | Emotional novelty fades | Physical travel intent creates recurring use (tourists return; locals discover new tours) |
| **Regulatory surface** | Mental-health concerns, minor-safety scrutiny | Mainstream, family-friendly; aligns with government tourism spending |
| **Network moat** | Social graph of user-created characters | Geographic data moat — curated, verified historical content tied to coordinates |

The pure-chat companions prove the model: deep AI conversation at the right emotional moment drives subscription conversion at scale. NearPast takes that proven mechanic and adds the one ingredient a phone cannot replicate — **you have to be there**. That constraint is a feature: it is what unlocks B2B institutional contracts, measurable partner-stop ROI, and the kind of memory that brings users back next time they visit a city.

---

## Contributing

Pull requests are welcome. See [wiki/Architecture.md](wiki/Architecture.md) for the codebase map and [wiki/Core-Flows.md](wiki/Core-Flows.md) for the product state machine before diving in.

## License

MIT © NearPast contributors
