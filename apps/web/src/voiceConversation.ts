// ─────────────────────────────────────────────────────────────────────────────
// NearPast — spoken back-and-forth with a historical character (STRETCH GOAL).
//
// This module starts/stops a real-time *voice* conversation with one of the
// CHARACTERS using ElevenLabs Conversational AI (the "Agents" platform).
// You speak into the mic; the agent answers out loud in the character's voice.
//
// ── How it fits together ──────────────────────────────────────────────────────
//   browser (this file)                server (apps/server)            ElevenLabs
//   ───────────────────                ────────────────────            ──────────
//   1. start(character)
//   2. POST /api/voice-token ─────────▶ holds ELEVENLABS_API_KEY
//                                       GET /v1/convai/conversation/token
//                                       (or /get-signed-url)  ─────────▶ mints
//                              ◀──────── { conversationToken }  ◀──────── token
//   3. import("@elevenlabs/client")
//   4. Conversation.startSession({ conversationToken, overrides, … })
//                                                          WebRTC mic+audio ⇄ agent
//
// The ElevenLabs API key NEVER touches the browser. The client only ever
// receives a short-lived token / signed URL minted server-side.
//
// ── Build-safety guard ────────────────────────────────────────────────────────
// `@elevenlabs/client` is NOT yet a dependency of @tth/web. To keep
// `pnpm --filter @tth/web build` green without it installed, this file:
//   • never *statically* imports the package,
//   • loads it via a dynamic import() through an indirected (non-literal)
//     specifier so `tsc` does not try to resolve it, and
//   • casts the result to the local `ElevenLabsClientModule` interface below
//     (a "clearly-typed thin wrapper" mirroring the real public API).
// When you install the dep and wire this up, no shim needs removing — the same
// code type-checks and runs. See voiceConversation.README.md for the steps.
//
// This module is intentionally NOT imported by App.tsx yet.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import type { Character } from "@tth/shared";

// ── Backend contract (see voiceConversation.README.md for the full sketch) ──────
// POST /api/voice-token  { characterId: string }  →  VoiceTokenResponse
// The server picks ONE auth mode and returns the matching field.
export type VoiceTokenResponse = {
  /** WebRTC (recommended): short-lived conversation token. */
  conversationToken?: string;
  /** WebSocket alternative: a pre-signed wss URL (expires ~15 min). */
  signedUrl?: string;
  /** Public-agent fallback (no auth on the agent) — fine for a demo only. */
  agentId?: string;
};

const VOICE_TOKEN_ROUTE = "/api/voice-token";
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

// ── Local typing for @elevenlabs/client (mirrors its public API) ────────────────
// Kept deliberately minimal: only what this module uses.
type ElevenLabsAgentOverrides = {
  agent?: {
    prompt?: { prompt: string };
    firstMessage?: string;
    language?: string;
  };
  tts?: { voiceId?: string };
};

export type ElevenLabsMessage = { message: string; source: "user" | "agent" };

type ElevenLabsSessionConfig = {
  // exactly one of these three identifies the agent / session
  conversationToken?: string;
  signedUrl?: string;
  agentId?: string;
  connectionType?: "webrtc" | "websocket";
  overrides?: ElevenLabsAgentOverrides;
  dynamicVariables?: Record<string, string | number | boolean>;
  onConnect?: (props: { conversationId: string }) => void;
  onDisconnect?: (details?: unknown) => void;
  onMessage?: (props: ElevenLabsMessage) => void;
  onModeChange?: (props: { mode: "speaking" | "listening" }) => void;
  onStatusChange?: (props: { status: string }) => void;
  onError?: (message: string, context?: unknown) => void;
};

type ElevenLabsConversation = {
  endSession: () => Promise<void>;
  setVolume: (opts: { volume: number }) => void;
  getId: () => string;
};

type ElevenLabsClientModule = {
  Conversation: {
    startSession: (
      config: ElevenLabsSessionConfig,
    ) => Promise<ElevenLabsConversation>;
  };
};

/** Lifecycle of a voice conversation, surfaced to the UI. */
export type VoiceStatus =
  | "idle"
  | "requesting-token"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type VoiceConversationState = {
  status: VoiceStatus;
  /** true while the agent (not you) is talking — drive a waveform/avatar with this */
  isSpeaking: boolean;
  error: string | null;
  conversationId: string | null;
  transcript: ElevenLabsMessage[];
};

export type VoiceConversationControls = VoiceConversationState & {
  /** Begin a spoken conversation with `character`. Prompts for mic permission. */
  start: (character: Character) => Promise<void>;
  /** End the conversation and release the mic. */
  stop: () => Promise<void>;
  /** 0..1 playback volume for the agent's voice. */
  setVolume: (volume: number) => void;
};

const INITIAL_STATE: VoiceConversationState = {
  status: "idle",
  isSpeaking: false,
  error: null,
  conversationId: null,
  transcript: [],
};

// ── Prompt shaping ──────────────────────────────────────────────────────────────
// Turn a Character's persona + voiceHint into an agent override. NOTE: voiceHint
// is a human-readable voice *description*, not an ElevenLabs voiceId — the actual
// voice is chosen when you create the agent in the dashboard (or via a real
// voiceId in tts.voiceId). We still feed it to the model as guidance.

/** System prompt that keeps the agent in character, historically grounded, and good for *spoken* replies. */
export function buildSystemPrompt(c: Character): string {
  const deathYear = (c.era.match(/(\d{4})\s*$/) ?? [])[1];
  return [
    `You ARE ${c.name} (${c.era}). ${c.blurb}`,
    c.persona,
    "",
    "HISTORICAL GROUNDING — stay accurate to who you really were:",
    `- Speak only from your own real life, work, beliefs and era (${c.era}). Reference real people, places, and events you actually knew.`,
    deathYear
      ? `- You know NOTHING of events after ${deathYear}. If asked about the modern world, react in character with period-appropriate curiosity or bemusement — never explain it as if you lived it.`
      : "",
    "- You are standing with a visitor at your own London blue-plaque address; refer to it and your surroundings naturally.",
    "- Never claim to be an AI, a model, a chatbot, or a program. Never break character.",
    "",
    "SPEAKING STYLE — you are talking ALOUD: reply in 1–3 short, natural sentences, then often ask the visitor a question back so the exchange flows. " +
      `Your manner of speaking: ${c.voiceHint}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** A short in-character opener the agent says first. */
export function buildFirstMessage(c: Character): string {
  const firstName = c.name.split(" ")[0] ?? c.name;
  return `Ah — a visitor. ${firstName} here. What would you like to ask me?`;
}

function buildOverrides(c: Character, voiceId?: string): ElevenLabsAgentOverrides {
  return {
    agent: {
      prompt: { prompt: buildSystemPrompt(c) },
      firstMessage: buildFirstMessage(c),
      language: "en",
    },
    ...(voiceId ? { tts: { voiceId } } : {}),
  };
}

async function fetchVoiceToken(
  characterId: string,
  signal: AbortSignal,
): Promise<VoiceTokenResponse> {
  const res = await fetch(`${API_BASE}${VOICE_TOKEN_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`voice-token request failed (${res.status})`);
  }
  return (await res.json()) as VoiceTokenResponse;
}

/**
 * Load @elevenlabs/client at runtime WITHOUT a static import, so the web build
 * passes when the package is not installed. The non-literal specifier stops
 * `tsc`/Vite from resolving it at build time; `@vite-ignore` silences the
 * dynamic-import warning. Throws a clear error if the dep is genuinely missing.
 */
async function loadElevenLabsClient(): Promise<ElevenLabsClientModule> {
  const specifier = ["@elevenlabs", "client"].join("/");
  try {
    return (await import(/* @vite-ignore */ specifier)) as ElevenLabsClientModule;
  } catch (err) {
    throw new Error(
      "@elevenlabs/client is not installed. Run `pnpm --filter @tth/web add @elevenlabs/client` " +
        "to enable voice conversations.",
      { cause: err },
    );
  }
}

/** Build the SessionConfig auth fields from whatever the backend returned. */
function toSessionAuth(
  token: VoiceTokenResponse,
): Pick<ElevenLabsSessionConfig, "conversationToken" | "signedUrl" | "agentId" | "connectionType"> {
  if (token.conversationToken) {
    return { conversationToken: token.conversationToken, connectionType: "webrtc" };
  }
  if (token.signedUrl) {
    return { signedUrl: token.signedUrl, connectionType: "websocket" };
  }
  if (token.agentId) {
    return { agentId: token.agentId, connectionType: "webrtc" };
  }
  throw new Error(
    "voice-token response had no conversationToken, signedUrl, or agentId",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook — the main entry point for the UI.
//
//   const voice = useVoiceConversation();
//   <button onClick={() => voice.start(karlMarx)}>Talk to Marx</button>
//   <button onClick={voice.stop} disabled={voice.status !== "connected"}>Stop</button>
//
// (Not wired into App.tsx yet — see voiceConversation.README.md for remaining
// steps to make it live: create the dashboard agent, add /api/voice-token,
// install @elevenlabs/client, then mount this hook.)
// ─────────────────────────────────────────────────────────────────────────────
export function useVoiceConversation(
  options?: {
    /** real ElevenLabs voiceId override (per-character), if you've cloned voices */
    voiceIdFor?: (c: Character) => string | undefined;
  },
): VoiceConversationControls {
  const [state, setState] = useState<VoiceConversationState>(INITIAL_STATE);

  // Mutable handles that must survive re-renders.
  const convRef = useRef<ElevenLabsConversation | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const patch = useCallback((p: Partial<VoiceConversationState>) => {
    if (mountedRef.current) setState((s) => ({ ...s, ...p }));
  }, []);

  const start = useCallback(
    async (character: Character) => {
      // Guard against double-starts.
      if (convRef.current) return;

      const abort = new AbortController();
      abortRef.current = abort;
      setState({ ...INITIAL_STATE, status: "requesting-token" });

      try {
        const token = await fetchVoiceToken(character.id, abort.signal);
        const auth = toSessionAuth(token);
        const { Conversation } = await loadElevenLabsClient();

        patch({ status: "connecting" });

        const voiceId = options?.voiceIdFor?.(character);
        const conversation = await Conversation.startSession({
          ...auth,
          overrides: buildOverrides(character, voiceId),
          dynamicVariables: {
            character_name: character.name,
            era: character.era,
            voice_hint: character.voiceHint,
          },
          onConnect: ({ conversationId }) =>
            patch({ status: "connected", conversationId, error: null }),
          onDisconnect: () => {
            convRef.current = null;
            patch({ status: "disconnected", isSpeaking: false });
          },
          onModeChange: ({ mode }) => patch({ isSpeaking: mode === "speaking" }),
          onMessage: (msg) =>
            setState((s) => ({ ...s, transcript: [...s.transcript, msg] })),
          onError: (message) => patch({ status: "error", error: message }),
        });

        convRef.current = conversation;
      } catch (err) {
        convRef.current = null;
        patch({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [options, patch],
  );

  const stop = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    const conv = convRef.current;
    convRef.current = null;
    if (conv) {
      try {
        await conv.endSession();
      } catch {
        /* already closed */
      }
    }
    patch({ status: "disconnected", isSpeaking: false });
  }, [patch]);

  const setVolume = useCallback((volume: number) => {
    convRef.current?.setVolume({ volume: Math.max(0, Math.min(1, volume)) });
  }, []);

  // Tear down the session if the component unmounts mid-conversation.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      void convRef.current?.endSession().catch(() => {});
      convRef.current = null;
    };
  }, []);

  return { ...state, start, stop, setVolume };
}
