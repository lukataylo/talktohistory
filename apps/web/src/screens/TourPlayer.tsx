// ─────────────────────────────────────────────────────────────────────────────
// TourPlayer — full-screen glassmorphic player for the 10 pre-generated guided
// tours (TOURS / getTour from @tth/shared), which previously had no UI.
//
// Two modes:
//   • LIST  — every tour as a card (title, guide, duration, stop count).
//   • PLAYER — stop-by-stop walk for one tour: stop name + blurb + first-person
//             narration, a Narrate button (reuses fetchNarrationUrl), Prev/Next,
//             a "stop k of n" progress indicator, a partner-stop badge, and the
//             walkToNext directions.
//
// NO lucide-react imports — inline SVG / unicode / emoji throughout.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { TOURS, getTour, type Tour, type TourStop } from "@tth/shared";
import { fetchNarrationUrl } from "../api";
import "./TourPlayer.css";

// ── Location-sticker inference ────────────────────────────────────────────────
// Stickers live at /pins/places/<kind>.png:
//   coffee, pub, bookshop, museum, church, monument, park, theatre, plaque, station
type StickerKind =
  | "coffee"
  | "pub"
  | "bookshop"
  | "museum"
  | "church"
  | "monument"
  | "park"
  | "theatre"
  | "plaque"
  | "station";

const KIND_RULES: Array<{ kind: StickerKind; re: RegExp }> = [
  { kind: "coffee", re: /coffee|caf[eé]|patisserie|bakery|espresso|tea\b|tearoom/i },
  { kind: "pub", re: /\bpub\b|tavern|\binn\b|arms|\blion\b|\bbar\b|alehouse|brewery/i },
  { kind: "bookshop", re: /book|library|reading room|press|stationer/i },
  { kind: "museum", re: /museum|gallery|exhibition|collection/i },
  { kind: "church", re: /church|cathedral|chapel|abbey|st\.?\s|saint|minster/i },
  { kind: "theatre", re: /theatre|theater|playhouse|opera|hall\b|cinema|club\b/i },
  { kind: "station", re: /station|underground|tube|railway|terminus|platform/i },
  { kind: "park", re: /park|square|garden|green|heath|common|fields?\b/i },
  { kind: "monument", re: /monument|column|statue|memorial|arch\b|obelisk|fountain|tomb|grave/i },
];

function inferStickerKind(stop: TourStop): StickerKind | null {
  const haystack = `${stop.name} ${stop.partner?.venue ?? ""} ${stop.blurb}`;
  for (const rule of KIND_RULES) {
    if (rule.re.test(haystack)) return rule.kind;
  }
  // Plaque is a sensible default for an otherwise-unclassified historic marker.
  return stop.kind === "historic" ? "plaque" : null;
}

const FALLBACK_EMOJI = "📍";

// ── Inline icons ──────────────────────────────────────────────────────────────

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function IconSpeaker() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16 8.5a4 4 0 0 1 0 7" />
      <path d="M18.5 6a7.5 7.5 0 0 1 0 12" />
    </svg>
  );
}
function IconWalk() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2" />
      <path d="M11 8l-2 5 3 2 1 5M11 8l4 2 3-1M9 13l-3 2-1 4" />
    </svg>
  );
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function partnerStopCount(tour: Tour): number {
  return tour.stops.filter((s) => s.kind === "partner").length;
}

// ── Stop icon ─────────────────────────────────────────────────────────────────

function StopIcon({ stop }: { stop: TourStop }) {
  const kind = inferStickerKind(stop);
  const [failed, setFailed] = useState(false);
  if (!kind || failed) {
    return <span className="tp-stop-emoji" aria-hidden="true">{FALLBACK_EMOJI}</span>;
  }
  return (
    <img
      className="tp-stop-sticker"
      src={`/pins/places/${kind}.png`}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TourPlayer({
  onClose,
  initialTourId,
}: {
  onClose: () => void;
  initialTourId?: string;
}) {
  const [selectedTourId, setSelectedTourId] = useState<string | null>(initialTourId ?? null);
  const [stopIndex, setStopIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const tour = selectedTourId ? getTour(selectedTourId) : undefined;

  function stopNarration() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
  }

  // Stop any audio when the tour, stop, or component changes.
  useEffect(() => stopNarration, []);
  useEffect(() => {
    stopNarration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTourId, stopIndex]);

  function openTour(id: string) {
    setSelectedTourId(id);
    setStopIndex(0);
  }

  function backToList() {
    stopNarration();
    setSelectedTourId(null);
    setStopIndex(0);
  }

  function speakBrowser(text: string) {
    if (!("speechSynthesis" in window)) {
      setIsPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  async function narrate(stop: TourStop, guideId: string) {
    stopNarration();
    setIsPlaying(true);
    // Prefer the real backend voice (guideId echoed as spotId so the server can
    // resolve the guide's voice); fall back to browser TTS.
    const url = await fetchNarrationUrl({ text: stop.narration, spotId: guideId });
    if (url) {
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stopNarration();
      audio.onerror = () => speakBrowser(stop.narration);
      try {
        await audio.play();
        return;
      } catch {
        // Autoplay blocked — fall through to browser speech.
      }
    }
    speakBrowser(stop.narration);
  }

  // ── LIST view ────────────────────────────────────────────────────────────
  if (!tour) {
    return (
      <div className="tour-player" role="dialog" aria-label="Guided tours">
        <header className="tp-header glass-panel">
          <div>
            <p className="tp-eyebrow">Guided walks</p>
            <h1 className="tp-title">Tours of historic London</h1>
          </div>
          <button className="tp-close" type="button" onClick={onClose} aria-label="Close tours">
            <IconClose />
          </button>
        </header>

        <div className="tp-scroll">
          <ul className="tp-list">
            {TOURS.map((t) => {
              const partners = partnerStopCount(t);
              return (
                <li key={t.id}>
                  <button className="tp-card glass-panel" type="button" onClick={() => openTour(t.id)}>
                    <div className="tp-card-head">
                      <span className="tp-guide-avatar">
                        <img
                          src={`/pins/${t.guideId}.png`}
                          alt=""
                          draggable={false}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </span>
                      <div className="tp-card-titles">
                        <h2>{t.title}</h2>
                        <p className="tp-card-guide">with {t.guideName}</p>
                      </div>
                    </div>
                    <p className="tp-card-summary">{t.summary}</p>
                    <div className="tp-card-meta">
                      <span>{t.durationMin} min</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDistance(t.distanceM)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.stops.length} stops</span>
                      {partners > 0 ? <span className="tp-partner-pill">{partners} partner</span> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  // ── PLAYER view ──────────────────────────────────────────────────────────
  const total = tour.stops.length;
  const stop = tour.stops[Math.min(stopIndex, total - 1)];
  if (!stop) return null;
  const isPartner = stop.kind === "partner";

  return (
    <div className="tour-player" role="dialog" aria-label={`${tour.title} guided tour`}>
      <header className="tp-header glass-panel">
        <button className="tp-back" type="button" onClick={backToList} aria-label="Back to tour list">
          <IconChevronLeft />
          <span>Tours</span>
        </button>
        <div className="tp-header-titles">
          <p className="tp-eyebrow">{tour.guideName}</p>
          <h1 className="tp-title tp-title-sm">{tour.title}</h1>
        </div>
        <button className="tp-close" type="button" onClick={onClose} aria-label="Close tours">
          <IconClose />
        </button>
      </header>

      <div className="tp-scroll">
        <section className="tp-stop glass-panel">
          <div className="tp-stop-head">
            <span className={`tp-stop-icon ${isPartner ? "is-partner" : ""}`}>
              <StopIcon stop={stop} />
            </span>
            <div className="tp-stop-titles">
              <p className="tp-progress">Stop {stopIndex + 1} of {total}</p>
              <h2>{stop.name}</h2>
              <p className="tp-stop-blurb">{stop.blurb}</p>
            </div>
          </div>

          {isPartner && stop.partner ? (
            <div className="tp-partner-card">
              <span className="tp-partner-badge">Partner stop</span>
              <strong>{stop.partner.venue}</strong>
              {stop.partner.offer ? <p>{stop.partner.offer}</p> : null}
            </div>
          ) : null}

          <p className="tp-narration">{stop.narration}</p>

          <button
            className="tp-narrate"
            type="button"
            onClick={() => narrate(stop, tour.guideId)}
          >
            <IconSpeaker />
            {isPlaying ? "Restart narration" : "Narrate"}
          </button>

          {stop.walkToNext ? (
            <p className="tp-walk">
              <IconWalk />
              <span>{stop.walkToNext}</span>
            </p>
          ) : (
            <p className="tp-walk tp-walk-end">
              <span>Final stop — end of the walk.</span>
            </p>
          )}
        </section>

        <ol className="tp-dots" aria-hidden="true">
          {tour.stops.map((s, i) => (
            <li key={s.id} className={i === stopIndex ? "is-current" : i < stopIndex ? "is-done" : ""} />
          ))}
        </ol>
      </div>

      <footer className="tp-nav glass-panel">
        <button
          className="tp-nav-btn"
          type="button"
          disabled={stopIndex === 0}
          onClick={() => setStopIndex((i) => Math.max(0, i - 1))}
        >
          <IconChevronLeft />
          Prev
        </button>
        <span className="tp-nav-count">{stopIndex + 1} / {total}</span>
        <button
          className="tp-nav-btn tp-nav-next"
          type="button"
          disabled={stopIndex >= total - 1}
          onClick={() => setStopIndex((i) => Math.min(total - 1, i + 1))}
        >
          Next
          <IconChevronRight />
        </button>
      </footer>
    </div>
  );
}
