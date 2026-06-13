import {
  Aperture as ApertureRaw,
  BookOpen as BookOpenRaw,
  Footprints as FootprintsRaw,
  Ghost as GhostRaw,
  LocateFixed as LocateFixedRaw,
  MapPin as MapPinRaw,
  Navigation as NavigationRaw,
  Sparkles as SparklesRaw,
  Volume2 as Volume2Raw,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  API_ROUTES,
  ProximityEngine,
  SEED_SPOTS,
  buildStoryUserPrompt,
  haversineMeters,
  type Challenge,
  type Fix,
  type GhostSpot,
  type LatLng,
  type Memory,
  type ProximityEvent,
  type Story,
  type TimeOfDay,
} from "@tth/shared";
import { createPlanMapAdapter, type ScreenPoint } from "./map/mapAdapter";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>;

const Aperture = ApertureRaw as unknown as IconComponent;
const BookOpen = BookOpenRaw as unknown as IconComponent;
const Footprints = FootprintsRaw as unknown as IconComponent;
const Ghost = GhostRaw as unknown as IconComponent;
const LocateFixed = LocateFixedRaw as unknown as IconComponent;
const MapPin = MapPinRaw as unknown as IconComponent;
const Navigation = NavigationRaw as unknown as IconComponent;
const Sparkles = SparklesRaw as unknown as IconComponent;
const Volume2 = Volume2Raw as unknown as IconComponent;

const STORAGE_KEY = "talktohistory.memories.v1";
const todayKey = () => new Date().toISOString().slice(0, 10);

type StoryMode = "map" | "story" | "challenge";

const DEMO_START: LatLng = { lat: 51.5115, lng: -0.105 };

const SPOT_COPY: Record<string, { mood: string; clue: string }> = {
  "weeping-lady": {
    mood: "A salt-white figure listens under the bridge lights.",
    clue: "Unlocked near the river wall",
  },
  "clockwork-boy": {
    mood: "Tiny brass footsteps count seconds behind closed shutters.",
    clue: "Unlocked around Westminster",
  },
  "lantern-keeper": {
    mood: "A lamp swings over black water even when the air is still.",
    clue: "Unlocked on the South Bank",
  },
  "whispering-alley": {
    mood: "Market voices leak from brickwork after the last shop closes.",
    clue: "Unlocked by the west-end lanes",
  },
};

export function App() {
  const spots = SEED_SPOTS;
  const [size, setSize] = useState({ width: 900, height: 720 });
  const [position, setPosition] = useState<LatLng>(DEMO_START);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState(spots[0]?.id ?? "");
  const [storyMode, setStoryMode] = useState<StoryMode>("map");
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [memories, setMemories] = useState<Memory[]>(() => readMemories());
  const [fixStatus, setFixStatus] = useState("Demo position");
  const [walkMeters, setWalkMeters] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastWalkPoint = useRef<LatLng | null>(null);

  const selectedSpot = spots.find((spot) => spot.id === selectedId) ?? spots[0];
  const adapter = useMemo(() => createPlanMapAdapter(spots, size), [spots, size]);
  const userPoint = adapter.project(position);

  const engineRef = useRef<ProximityEngine | null>(null);

  useEffect(() => {
    const engine = new ProximityEngine((event: ProximityEvent) => {
      if (event.type === "position") {
        setPosition(event.point);
      }
      if (event.type === "activate") {
        setActiveIds((ids) => new Set(ids).add(event.spot.id));
        setSelectedId(event.spot.id);
        setFixStatus(`Unlocked ${Math.round(event.distance)}m away`);
      }
      if (event.type === "deactivate") {
        setActiveIds((ids) => {
          const next = new Set(ids);
          next.delete(event.spot.id);
          return next;
        });
      }
    });
    engine.setSpots(spots);
    engineRef.current = engine;
    injectFix({ ...DEMO_START, accuracy: 15, synthetic: true });
    return () => {
      engineRef.current = null;
    };
  }, [spots]);

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(360, entry.contentRect.height),
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  }, [memories]);

  const sortedSpots = useMemo(
    () =>
      spots
        .map((spot) => ({
          spot,
          distance: haversineMeters(position, { lat: spot.lat, lng: spot.lng }),
          active: activeIds.has(spot.id),
        }))
        .sort((a, b) => a.distance - b.distance),
    [activeIds, position, spots]
  );

  const todayMemories = useMemo(
    () => memories.filter((memory) => memory.day === todayKey()),
    [memories]
  );

  const selectedDistance = selectedSpot
    ? haversineMeters(position, { lat: selectedSpot.lat, lng: selectedSpot.lng })
    : 0;
  const selectedUnlocked = selectedSpot ? activeIds.has(selectedSpot.id) : false;

  function injectFix(fix: Omit<Fix, "timestamp">) {
    engineRef.current?.onFix({ ...fix, timestamp: Date.now() });
  }

  function teleportToSpot(spot: GhostSpot) {
    setSelectedId(spot.id);
    setFixStatus("Demo unlock injected");
    for (let i = 0; i < 3; i += 1) {
      injectFix({
        lat: spot.lat + i * 0.000004,
        lng: spot.lng - i * 0.000004,
        accuracy: 8,
        synthetic: true,
      });
    }
  }

  function locateUser() {
    if (!navigator.geolocation) {
      setFixStatus("Geolocation unavailable");
      return;
    }

    setFixStatus("Locating...");
    navigator.geolocation.getCurrentPosition(
      (geo) => {
        injectFix({
          lat: geo.coords.latitude,
          lng: geo.coords.longitude,
          accuracy: geo.coords.accuracy,
        });
        setFixStatus(`GPS ${Math.round(geo.coords.accuracy)}m accuracy`);
      },
      () => setFixStatus("Location permission blocked"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 2000 }
    );
  }

  function beginStory(spot: GhostSpot) {
    if (!activeIds.has(spot.id)) {
      setSelectedId(spot.id);
      return;
    }

    const story = createDemoStory(spot);
    setCurrentStory(story);
    setStoryMode("story");
    setWalkMeters(0);
    lastWalkPoint.current = null;
    stopNarration();
  }

  function narrate() {
    if (!currentStory || !("speechSynthesis" in window)) return;
    stopNarration();
    const utterance = new SpeechSynthesisUtterance(currentStory.narration);
    utterance.rate = 0.9;
    utterance.pitch = 0.78;
    utterance.onend = () => setIsListening(false);
    utterance.onerror = () => setIsListening(false);
    speechRef.current = utterance;
    setIsListening(true);
    window.speechSynthesis.speak(utterance);
  }

  function stopNarration() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speechRef.current = null;
    setIsListening(false);
  }

  function advanceWalk() {
    if (!selectedSpot) return;
    const nextPoint = lastWalkPoint.current
      ? {
          lat: lastWalkPoint.current.lat + 0.00013,
          lng: lastWalkPoint.current.lng + 0.00008,
        }
      : { lat: selectedSpot.lat + 0.00012, lng: selectedSpot.lng + 0.0001 };

    const prev = lastWalkPoint.current ?? { lat: selectedSpot.lat, lng: selectedSpot.lng };
    const gained = haversineMeters(prev, nextPoint);
    lastWalkPoint.current = nextPoint;
    setWalkMeters((meters) => meters + gained);
  }

  function saveMemory(kind: "selfie" | "walk") {
    if (!selectedSpot) return;
    const memory: Memory = {
      id: crypto.randomUUID(),
      day: todayKey(),
      spotId: selectedSpot.id,
      photoUrl: createStickerDataUrl(selectedSpot, kind, false),
      stickerUrl: createStickerDataUrl(selectedSpot, kind, true),
      caption: kind === "selfie" ? "Proof from the haunting" : "Trail mark collected",
      lat: position.lat,
      lng: position.lng,
      createdAt: Date.now(),
    };
    setMemories((items) => [memory, ...items]);
    setStoryMode("map");
    setCurrentStory(null);
    stopNarration();
  }

  const currentChallenge = currentStory?.challenge;
  const challengeComplete =
    currentChallenge?.type === "walk"
      ? walkMeters >= currentChallenge.targetMeters
      : currentChallenge?.type === "selfie";

  return (
    <main className="app-shell">
      <section className="map-stage" ref={mapRef} aria-label="Ghost map">
        <MapBackdrop />
        <div className="route route-one" />
        <div className="route route-two" />
        <div className="route route-three" />
        <div className="river" />
        <div className="map-label label-north">Soho</div>
        <div className="map-label label-river">River Thames</div>
        <div className="map-label label-east">Dock Street</div>

        {spots.map((spot) => {
          const point = adapter.project({ lat: spot.lat, lng: spot.lng });
          const isActive = activeIds.has(spot.id);
          const isSelected = selectedId === spot.id;
          return (
            <button
              className={`ghost-pin ${isActive ? "is-active" : ""} ${
                isSelected ? "is-selected" : ""
              }`}
              key={spot.id}
              style={pointStyle(point)}
              type="button"
              onClick={() => beginStory(spot)}
              aria-label={`${spot.title} ${isActive ? "unlocked" : "locked"}`}
            >
              <span className="pin-halo" />
              <Ghost size={28} strokeWidth={2.2} />
            </button>
          );
        })}

        <div className="user-dot" style={pointStyle(userPoint)} aria-hidden="true">
          <Navigation size={16} fill="currentColor" />
        </div>

        <header className="topbar glass-panel">
          <div>
            <p className="eyebrow">PWA ghost map</p>
            <h1>TalkToHistory</h1>
          </div>
          <div className="status-cluster">
            <span className="status-pill">
              <Sparkles size={15} />
              {todayMemories.length} today
            </span>
            <button className="icon-button" type="button" onClick={locateUser} aria-label="Locate me">
              <LocateFixed size={19} />
            </button>
          </div>
        </header>

        <aside className="spot-dock glass-panel">
          <div className="dock-heading">
            <span className="dock-icon">
              <MapPin size={17} />
            </span>
            <div>
              <p className="eyebrow">Nearest haunt</p>
              <h2>{selectedSpot?.title}</h2>
            </div>
          </div>
          <p className="spot-mood">{selectedSpot ? SPOT_COPY[selectedSpot.id]?.mood : ""}</p>
          <div className="unlock-meter">
            <span style={{ width: `${getUnlockPercent(selectedDistance, selectedSpot)}%` }} />
          </div>
          <div className="dock-meta">
            <span>{Math.round(selectedDistance)}m away</span>
            <span>{selectedUnlocked ? "Unlocked" : selectedSpot ? SPOT_COPY[selectedSpot.id]?.clue : ""}</span>
          </div>
          <div className="dock-actions">
            <button className="primary-button" type="button" onClick={() => selectedSpot && beginStory(selectedSpot)}>
              <BookOpen size={17} />
              {selectedUnlocked ? "Open story" : "Select pin"}
            </button>
            <button className="secondary-button" type="button" onClick={() => selectedSpot && teleportToSpot(selectedSpot)}>
              <Sparkles size={17} />
              Demo unlock
            </button>
          </div>
          <p className="fix-status">{fixStatus}</p>
        </aside>

        <aside className="memory-dock glass-panel" aria-label="Daily memory stickers">
          <div className="memory-head">
            <div>
              <p className="eyebrow">Daily memory</p>
              <h2>{formatDay(todayKey())}</h2>
            </div>
            <Aperture size={19} />
          </div>
          <div className="sticker-grid">
            {todayMemories.length ? (
              todayMemories.slice(0, 4).map((memory) => (
                <img key={memory.id} src={memory.stickerUrl} alt={memory.caption ?? "Ghost sticker"} />
              ))
            ) : (
              <>
                <div className="empty-sticker">?</div>
                <div className="empty-sticker">+</div>
                <div className="empty-sticker">+</div>
                <div className="empty-sticker">+</div>
              </>
            )}
          </div>
          <p className="memory-note">
            {todayMemories.length
              ? "Captured stickers stay in this browser for the demo."
              : "Finish a story challenge to stamp today."}
          </p>
        </aside>

        <nav className="pin-list glass-panel" aria-label="Ghost spots">
          {sortedSpots.map(({ spot, distance, active }) => (
            <button
              key={spot.id}
              className={selectedId === spot.id ? "is-selected" : ""}
              type="button"
              onClick={() => setSelectedId(spot.id)}
            >
              <span className={active ? "pin-dot active" : "pin-dot"} />
              <span>{spot.title.replace("The ", "")}</span>
              <strong>{Math.round(distance)}m</strong>
            </button>
          ))}
        </nav>

        {storyMode !== "map" && currentStory ? (
          <StorySheet
            challengeComplete={Boolean(challengeComplete)}
            isListening={isListening}
            mode={storyMode}
            onAdvanceWalk={advanceWalk}
            onBack={() => {
              setStoryMode("map");
              setCurrentStory(null);
              stopNarration();
            }}
            onChallenge={() => setStoryMode("challenge")}
            onNarrate={narrate}
            onSave={saveMemory}
            story={currentStory}
            walkMeters={walkMeters}
          />
        ) : null}
      </section>
    </main>
  );
}

function StorySheet(props: {
  challengeComplete: boolean;
  isListening: boolean;
  mode: StoryMode;
  onAdvanceWalk: () => void;
  onBack: () => void;
  onChallenge: () => void;
  onNarrate: () => void;
  onSave: (kind: "selfie" | "walk") => void;
  story: Story;
  walkMeters: number;
}) {
  const challenge = props.story.challenge;
  const walkTarget = challenge.type === "walk" ? challenge.targetMeters : 0;

  return (
    <div className="story-scrim">
      <section className="story-sheet glass-panel" aria-label="Story mode">
        <div className="story-art">
          <Ghost size={48} />
          <span />
        </div>
        <div className="story-content">
          <p className="eyebrow">{props.mode === "story" ? "Story mode" : "Challenge"}</p>
          <h2>{props.story.title}</h2>
          {props.mode === "story" ? (
            <>
              <p className="narration">{props.story.narration}</p>
              <div className="story-actions">
                <button className="secondary-button" type="button" onClick={props.onNarrate}>
                  <Volume2 size={17} />
                  {props.isListening ? "Restart" : "Narrate"}
                </button>
                <button className="primary-button" type="button" onClick={props.onChallenge}>
                  {challenge.type === "walk" ? <Footprints size={17} /> : <Aperture size={17} />}
                  Start challenge
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="challenge-copy">{challenge.instruction}</p>
              {challenge.type === "walk" ? (
                <div className="walk-card">
                  <div className="walk-ring">
                    {Math.min(100, Math.round((props.walkMeters / walkTarget) * 100))}%
                  </div>
                  <div>
                    <strong>
                      {Math.round(props.walkMeters)} / {walkTarget}m
                    </strong>
                    <button className="secondary-button compact" type="button" onClick={props.onAdvanceWalk}>
                      <Footprints size={16} />
                      Simulate steps
                    </button>
                  </div>
                </div>
              ) : (
                <div className="camera-card">
                  <Aperture size={30} />
                  <span>Demo camera ready</span>
                </div>
              )}
              <div className="story-actions">
                <button className="secondary-button" type="button" onClick={props.onBack}>
                  Back to map
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!props.challengeComplete}
                  onClick={() => props.onSave(challenge.type)}
                >
                  <Sparkles size={17} />
                  Save sticker
                </button>
              </div>
            </>
          )}
        </div>
        <button className="sheet-close" type="button" onClick={props.onBack} aria-label="Close story">
          x
        </button>
      </section>
    </div>
  );
}

function MapBackdrop() {
  return (
    <svg className="map-backdrop" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="cityGrid" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(52,48,42,.09)" strokeWidth="3" />
        </pattern>
      </defs>
      <rect width="1000" height="760" fill="url(#cityGrid)" />
      <path d="M-40 430 C 140 365 253 470 420 410 S 740 302 1045 350" fill="none" stroke="rgba(255,255,255,.76)" strokeWidth="54" strokeLinecap="round" />
      <path d="M-40 430 C 140 365 253 470 420 410 S 740 302 1045 350" fill="none" stroke="rgba(75,139,160,.36)" strokeWidth="38" strokeLinecap="round" />
      <path d="M56 96 C 276 156 474 102 652 34" fill="none" stroke="rgba(53,50,45,.14)" strokeWidth="24" strokeLinecap="round" />
      <path d="M124 684 C 304 548 546 632 818 506" fill="none" stroke="rgba(53,50,45,.12)" strokeWidth="20" strokeLinecap="round" />
    </svg>
  );
}

function createDemoStory(spot: GhostSpot): Story {
  const timeOfDay = getTimeOfDay();
  const prompt = buildStoryUserPrompt({
    spotId: spot.id,
    lat: spot.lat,
    lng: spot.lng,
    timeOfDay,
    seed: spot.seed,
    placeName: spot.title,
  });
  const challenge: Challenge =
    spot.id === "lantern-keeper" || spot.id === "whispering-alley"
      ? {
          type: "walk",
          instruction: "Follow the cold patch in the pavement until it loosens its grip.",
          targetMeters: 45,
        }
      : {
          type: "selfie",
          instruction: "Take a brave photo facing the place where the ghost would be standing.",
        };

  return {
    spotId: spot.id,
    title: spot.title,
    narration: `${SPOT_COPY[spot.id]?.mood ?? "The street holds its breath."} You step into the edge of ${spot.title}, and the city seems to lower its voice. The map light flickers across old stone, naming a place that remembers more footsteps than it should. In the ${timeOfDay}, the legend feels close enough to answer. ${spot.seed ?? "A local spirit"} circles the corner, not angry, only unfinished. Your phone warms in your hand. A pin opens like an eye, and for a second the modern street and its buried story line up perfectly. ${prompt.includes(API_ROUTES.story) ? "" : "The ghost waits for proof that you heard it."}`,
    challenge,
  };
}

function createStickerDataUrl(spot: GhostSpot, kind: "selfie" | "walk", sticker: boolean) {
  const title = spot.title.replace("The ", "").split(" ").slice(0, 2).join(" ");
  const glyph = kind === "walk" ? "foot" : "face";
  const bg = sticker ? "#fffdf2" : "#ded8c5";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
    <rect width="220" height="220" rx="44" fill="${bg}"/>
    <path d="M44 146c28-8 28-42 48-66 26-31 86-27 108 12 18 31 6 74 22 101-18-3-28-14-40-24-13 12-28 23-50 23-41 1-58-30-88-46Z" fill="#2b2927"/>
    <path d="M82 133c9-45 24-68 51-68 32 0 50 27 50 70 0 20-11 36-27 36-11 0-19-8-27-8-9 0-18 16-32 12-15-4-19-21-15-42Z" fill="#fffef9"/>
    <text x="110" y="106" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#2b2927">${glyph}</text>
    <text x="110" y="202" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="#2b2927">${escapeSvg(title)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function readMemories(): Memory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Memory[]) : [];
  } catch {
    return [];
  }
}

function getUnlockPercent(distance: number, spot: GhostSpot | undefined) {
  if (!spot) return 0;
  const outer = Math.max(spot.unlockRadius * 5, 180);
  const progress = 100 - (Math.min(distance, outer) / outer) * 100;
  return Math.max(8, Math.min(100, progress));
}

function formatDay(day: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${day}T12:00:00`));
}

function pointStyle(point: ScreenPoint) {
  return {
    left: `${point.x}px`,
    top: `${point.y}px`,
  };
}

function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[char] ?? char;
  });
}
