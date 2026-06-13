# NearPast Railway Handoff

This repo is being deployed as **NearPast** at `nearpast.com`.

## Current Railway State

Workspace: `lukataylo's Projects`

Project:

- Name: `nearpast`
- Project ID: `02620a12-6c0e-4e95-8c13-cb2faf6de394`
- Environment: `production`
- Environment ID: `f77fc430-b0eb-407c-a9d9-953310ce9262`
- Dashboard: `https://railway.com/project/02620a12-6c0e-4e95-8c13-cb2faf6de394`

Services:

- `web`
  - Service ID: `155c3fca-c798-4b4f-8745-83362af060d3`
  - Railway URL: `https://web-production-a3baa.up.railway.app`
  - Build: `pnpm --filter @tth/web build`
  - Start: `pnpm --filter @tth/web exec vite preview --host 0.0.0.0 --port $PORT`
  - Health: `/`
- `api`
  - Service ID: `707e1242-de60-4c86-8094-9156ec8aa5f6`
  - Railway URL: `https://api-production-5c12.up.railway.app`
  - Build: `pnpm --filter @tth/server build`
  - Start: `pnpm --filter @tth/server start`
  - Health: `/api/health`

The project is linked locally in this directory.

No deployments are currently active. The generated Railway domains are reserved/configured, but they return Railway's fallback `404 Application not found` until `api` and `web` are deployed successfully.

## Variables

`web` has:

- `VITE_API_BASE`
- `VITE_MOCK=false`
- `VITE_MAPBOX_ACCESS_TOKEN`
- `VITE_MAPBOX_STYLE=mapbox://styles/mapbox/light-v11`

`api` has:

- `AI_STORY_PROVIDER=gemini`
- `AI_TTS_PROVIDER=mock`
- `AI_STICKER_PROVIDER=mock`
- `DB_PROVIDER=memory`
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`

`ELEVENLABS_VOICE_ID` was missing locally, so TTS is intentionally set to `mock` until a voice ID is added.

## Known Blockers

1. Railway custom domain creation returned:

   ```text
   Unauthorized. Please run `railway login` again.
   ```

   Generated Railway domains are configured, but `nearpast.com` and `api.nearpast.com` are not attached yet.

2. Railway source configuration points at `https://github.com/lukataylo/talktohistory`, but Railway reported:

   ```text
   No GitHub installation found for repo: https://github.com/lukataylo/talktohistory
   ```

   Until the Railway GitHub app is installed for that repo, use `railway up` from the local checkout or connect the repo in the Railway dashboard.

## Next-Agent Instructions

1. Re-authenticate Railway if needed:

   ```bash
   railway login
   railway whoami --json
   railway status --json
   ```

2. Install/connect the Railway GitHub app for:

   ```text
   https://github.com/lukataylo/talktohistory
   ```

   Then verify both services still have:

   ```bash
   railway environment config --json
   ```

3. Attach custom domains:

   ```bash
   railway domain nearpast.com --service web --json
   railway domain www.nearpast.com --service web --json
   railway domain api.nearpast.com --service api --json
   ```

4. Add the DNS records returned by Railway at the domain registrar:

   - `nearpast.com` -> Railway target returned for the `web` service.
   - `www.nearpast.com` -> Railway target returned for the `web` service.
   - `api.nearpast.com` -> Railway target returned for the `api` service.

   Keep Cloudflare proxy disabled or set SSL/TLS mode according to Railway's domain guidance if using Cloudflare.

5. After `api.nearpast.com` is verified, switch the web build variable:

   ```bash
   railway variable set VITE_API_BASE=https://api.nearpast.com --service web --environment production
   ```

   Redeploy `web` afterward because `VITE_*` variables are baked into the frontend build.

6. Add ElevenLabs voice when ready:

   ```bash
   railway variable set ELEVENLABS_VOICE_ID=<voice-id> --service api --environment production
   railway variable set AI_TTS_PROVIDER=eleven --service api --environment production
   ```

7. Deploy or redeploy from this checkout:

   ```bash
   railway up --service api --environment production --detach -m "Deploy NearPast API"
   railway up --service web --environment production --detach -m "Deploy NearPast web"
   ```

8. Verify:

   ```bash
   curl https://api-production-5c12.up.railway.app/api/health
   curl https://api.nearpast.com/api/health
   ```

   Then open:

   - `https://web-production-a3baa.up.railway.app`
   - `https://nearpast.com`

## Repo Docs To Update

After custom domains are live, update:

- `README.md` with production URLs.
- `.env.example` comments if `api.nearpast.com` becomes the default.
- Any deployment notes with DNS provider-specific records.

Do not commit `.env.local` or any Railway/API secrets.
