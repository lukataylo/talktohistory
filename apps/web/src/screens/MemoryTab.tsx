// ─────────────────────────────────────────────────────────────────────────────
// MemoryTab — full-screen keepsake scrapbook.
// Reads from localStorage (talktohistory.memories.v1) so it is self-contained
// and always reflects the latest saved stickers.
// NO lucide-react imports — uses inline SVG / unicode throughout.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { Memory } from "@tth/shared";
import { getCharacter } from "@tth/shared";
import "./MemoryTab.css";

// ── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "talktohistory.memories.v1";

function readMemories(): Memory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Memory[]) : [];
  } catch {
    return [];
  }
}

function persistMemories(mems: Memory[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mems));
}

// ── Area lookup (rough London neighbourhood from character spot) ──────────────

const AREA_BY_SPOT: Record<string, string> = {
  "ada-lovelace": "St James's",
  "john-logie-baird": "Soho",
  "karl-marx": "Soho",
  "mary-seacole": "Soho",
  "jimi-hendrix": "Mayfair",
  "samuel-johnson": "Fleet St",
  "charles-dickens": "Bloomsbury",
  "virginia-woolf": "Fitzrovia",
};

function dayLocation(memories: Memory[]): string {
  for (const m of memories) {
    const area = AREA_BY_SPOT[m.spotId];
    if (area) return area;
  }
  return "London";
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatDayHeader(day: string, mems: Memory[]): string {
  const date = new Date(`${day}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
  const dayNum = date.getDate();
  const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
  return `${weekday} ${dayNum} ${month} · ${dayLocation(mems)}`;
}

function formatTimestamp(createdAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

// ── Grouping ─────────────────────────────────────────────────────────────────

type DayGroup = { day: string; mems: Memory[] };

function groupByDay(memories: Memory[]): DayGroup[] {
  const map = new Map<string, Memory[]>();
  for (const m of memories) {
    if (!map.has(m.day)) map.set(m.day, []);
    map.get(m.day)!.push(m);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // newest day first
    .map(([day, mems]) => ({
      day,
      mems: [...mems].sort((a, b) => b.createdAt - a.createdAt),
    }));
}

// ── Dev seed ─────────────────────────────────────────────────────────────────

function makePlaceholderSvg(label: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
    <rect width="220" height="220" rx="44" fill="${bg}"/>
    <circle cx="110" cy="100" r="56" fill="rgba(255,255,255,0.22)"/>
    <text x="110" y="112" text-anchor="middle" font-family="system-ui,Arial,sans-serif" font-size="28" font-weight="800" fill="white">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildSeedMemories(): Memory[] {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);

  const rows: Array<{ day: string; spotId: string; stickerBg: string; photoBg: string; label: string; offset: number }> = [
    { day: today,     spotId: "ada-lovelace",    stickerBg: "#6c63d8", photoBg: "#8b84e8", label: "ADA", offset: 1 },
    { day: today,     spotId: "karl-marx",        stickerBg: "#c44040", photoBg: "#e05050", label: "KM",  offset: 3 },
    { day: today,     spotId: "jimi-hendrix",     stickerBg: "#2e9e7a", photoBg: "#3abf95", label: "JH",  offset: 5 },
    { day: yesterday, spotId: "virginia-woolf",   stickerBg: "#b87c2a", photoBg: "#d4943a", label: "VW",  offset: 25 },
    { day: yesterday, spotId: "charles-dickens",  stickerBg: "#8b3aab", photoBg: "#a04ec4", label: "CD",  offset: 27 },
    { day: yesterday, spotId: "samuel-johnson",   stickerBg: "#2a7ab8", photoBg: "#3a92d4", label: "SJ",  offset: 29 },
  ];

  return rows.map(({ day, spotId, stickerBg, photoBg, label, offset }) => {
    const char = getCharacter(spotId);
    return {
      id: crypto.randomUUID(),
      day,
      spotId,
      photoUrl: makePlaceholderSvg(label, photoBg),
      stickerUrl: makePlaceholderSvg(label, stickerBg),
      caption: char ? `Met ${char.name}` : "Memory captured",
      lat: char?.lat ?? 51.5,
      lng: char?.lng ?? -0.13,
      createdAt: now - offset * 3_600_000,
    };
  });
}

// ── Icons (inline SVG — no lucide) ───────────────────────────────────────────

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.4 4.6 2.4 7.4L12 17l-6 4.4 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}

// ── Detail sheet ─────────────────────────────────────────────────────────────

function DetailSheet({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  const char = getCharacter(memory.spotId);

  return (
    <div className="mt-detail-overlay" onClick={onClose}>
      <div className="mt-detail-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <button className="mt-detail-back" type="button" onClick={onClose} aria-label="Back to memories">
          <ArrowLeftIcon />
          <span>Back</span>
        </button>

        <div className="mt-detail-media">
          <img
            className="mt-detail-photo"
            src={memory.photoUrl}
            alt={memory.caption ?? "Original photo"}
          />
          <div className="mt-detail-sticker-badge">
            <img src={memory.stickerUrl} alt="Sticker" />
          </div>
        </div>

        {memory.caption ? (
          <p className="mt-detail-caption">{memory.caption}</p>
        ) : null}

        {char ? (
          <div className="mt-detail-char">
            <h2 className="mt-detail-name">{char.name}</h2>
            <span className="mt-detail-era">{char.era}</span>
            <p className="mt-detail-blurb">{char.blurb}</p>
          </div>
        ) : null}

        <p className="mt-detail-time">{formatTimestamp(memory.createdAt)}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MemoryTab({ onClose }: { onClose: () => void }) {
  const [memories, setMemories] = useState<Memory[]>(readMemories);
  const [selected, setSelected] = useState<Memory | null>(null);

  const grouped = groupByDay(memories);
  const total = memories.length;

  function handleSeed() {
    const seeded = buildSeedMemories();
    persistMemories(seeded);
    setMemories(seeded);
  }

  return (
    <div className="memory-tab" role="dialog" aria-label="Your Memories">
      {/* ── Header ── */}
      <header className="mt-header glass-panel">
        <button className="mt-close" type="button" onClick={onClose} aria-label="Close memories">
          <CloseIcon />
        </button>
        <div className="mt-header-text">
          <h1 className="mt-title">Your Memories</h1>
          <p className="mt-subtitle">
            <SparkleIcon />
            {total} sticker{total !== 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {/* ── Scroll area ── */}
      <div className="mt-scroll">
        {grouped.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon">
              <CameraIcon />
            </div>
            <h2 className="mt-empty-title">No memories yet</h2>
            <p className="mt-empty-body">
              Explore London, unlock a historical figure, and complete a challenge to earn your first sticker.
            </p>
            <button className="mt-seed-btn" type="button" onClick={handleSeed}>
              Add sample memories
            </button>
          </div>
        ) : (
          <>
            {grouped.map(({ day, mems }) => (
              <div className="mt-day-card glass-panel" key={day}>
                <div className="mt-day-head">
                  <span className="mt-day-label">{formatDayHeader(day, mems)}</span>
                  <span className="mt-day-badge">
                    {mems.length} sticker{mems.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="mt-strip" role="list">
                  {mems.map((m) => (
                    <button
                      key={m.id}
                      className="mt-sticker-btn"
                      type="button"
                      role="listitem"
                      onClick={() => setSelected(m)}
                      aria-label={m.caption ?? "Memory sticker"}
                    >
                      <img src={m.stickerUrl} alt={m.caption ?? "Sticker"} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Detail sheet ── */}
      {selected ? (
        <DetailSheet memory={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
