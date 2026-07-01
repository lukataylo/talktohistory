import {
  Aperture as ApertureRaw,
  BookOpen as BookOpenRaw,
  ChevronDown as ChevronDownRaw,
  ChevronLeft as ChevronLeftRaw,
  ChevronRight as ChevronRightRaw,
  ChevronUp as ChevronUpRaw,
  Coffee as CoffeeRaw,
  FlaskConical as FlaskConicalRaw,
  Footprints as FootprintsRaw,
  Landmark as LandmarkRaw,
  LocateFixed as LocateFixedRaw,
  MapPin as MapPinRaw,
  Minus as MinusRaw,
  Music as MusicRaw,
  Navigation as NavigationRaw,
  Palette as PaletteRaw,
  Plus as PlusRaw,
  RotateCcw as RotateCcwRaw,
  Sparkles as SparklesRaw,
  Volume2 as Volume2Raw,
} from "lucide-react";
import type { ComponentType, PointerEvent as ReactPointerEvent, SVGProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHARACTER_SPOTS,
  VOICE_BY_GUIDE,
  ProximityEngine,
  getCharacter,
  getTourByGuide,
  haversineMeters,
  type Challenge,
  type Fix,
  type GhostSpot,
  type LatLng,
  type Memory,
  type ProximityEvent,
  type Story,
  type TimeOfDay,
  type Tour,
} from "@tth/shared";
import {
  createMapboxMapRenderer,
  createPlanMapAdapter,
  type MapRenderer,
  type PlanMapView,
  type ScreenPoint,
} from "./map/mapAdapter";
import { fetchNarrationUrl, fetchStory } from "./api";
import { makeStickerFromPhoto } from "./sticker";
import { useVoiceConversation } from "./voiceConversation";
import { MemoryTab } from "./screens/MemoryTab";
import { TourPlayer } from "./screens/TourPlayer";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>;

const Aperture = ApertureRaw as unknown as IconComponent;
const BookOpen = BookOpenRaw as unknown as IconComponent;
const ChevronDown = ChevronDownRaw as unknown as IconComponent;
const ChevronLeft = ChevronLeftRaw as unknown as IconComponent;
const ChevronRight = ChevronRightRaw as unknown as IconComponent;
const ChevronUp = ChevronUpRaw as unknown as IconComponent;
const Coffee = CoffeeRaw as unknown as IconComponent;
const FlaskConical = FlaskConicalRaw as unknown as IconComponent;
const Footprints = FootprintsRaw as unknown as IconComponent;
const Landmark = LandmarkRaw as unknown as IconComponent;
const LocateFixed = LocateFixedRaw as unknown as IconComponent;
const MapPin = MapPinRaw as unknown as IconComponent;
const Minus = MinusRaw as unknown as IconComponent;
const Music = MusicRaw as unknown as IconComponent;
const Navigation = NavigationRaw as unknown as IconComponent;
const Palette = PaletteRaw as unknown as IconComponent;
const Plus = PlusRaw as unknown as IconComponent;
const RotateCcw = RotateCcwRaw as unknown as IconComponent;
const Sparkles = SparklesRaw as unknown as IconComponent;
const Volume2 = Volume2Raw as unknown as IconComponent;

const STORAGE_KEY = "talktohistory.memories.v1";
const DEFAULT_MAPBOX_STYLE = "mapbox://styles/mapbox/light-v11";
const todayKey = () => new Date().toISOString().slice(0, 10);

type StoryMode = "map" | "story" | "challenge";
type PlanDrag = {
  originX: number;
  originY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

const DEMO_START: LatLng = { lat: 51.5115, lng: -0.105 };
const PLAN_VIEW_DEFAULT: PlanMapView = { offsetX: 0, offsetY: 0, zoom: 1 };

const DISPLAY_TITLES: Record<string, string> = {
  "dock-street-roastery": "Dock Street Roastery",
  "westminster-books": "Westminster Books",
  "south-bank-steps": "South Bank Steps",
  "soho-listening-bar": "Soho Listening Bar",
};

const SPOT_COPY: Record<string, { mood: string; clue: string }> = {
  "dock-street-roastery": {
    mood: "Coffee, river air, and old warehouse brick make this a saved morning spot.",
    clue: "Unlock beside the river wall",
  },
  "westminster-books": {
    mood: "A compact bookshop corner with marginal notes, tourists, and quiet regulars.",
    clue: "Unlock around Westminster",
  },
  "south-bank-steps": {
    mood: "Steps, performers, and river light turn this walk into a small ritual.",
    clue: "Unlocked on the South Bank",
  },
  "soho-listening-bar": {
    mood: "A late-night corner where records, regulars, and street noise blur together.",
    clue: "Unlocked by the west-end lanes",
  },
};

export function App() {
  const spots = CHARACTER_SPOTS;
  const [size, setSize] = useState({ width: 900, height: 720 });
  const [position, setPosition] = useState<LatLng>(DEMO_START);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState("");
  const [storyMode, setStoryMode] = useState<StoryMode>("map");
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [memories, setMemories] = useState<Memory[]>(() => readMemories());
  const [fixStatus, setFixStatus] = useState("Demo position");
  const [walkMeters, setWalkMeters] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [showMemoryTab, setShowMemoryTab] = useState(false);
  const [tourState, setTourState] = useState<{ open: boolean; tourId?: string }>({ open: false });
  const [storyAutoTalk, setStoryAutoTalk] = useState(false);
  const [mapboxAdapter, setMapboxAdapter] = useState<MapRenderer["adapter"] | null>(null);
  const [planView, setPlanView] = useState<PlanMapView>(PLAN_VIEW_DEFAULT);
  const [, setMapProjectionTick] = useState(0);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapboxContainerRef = useRef<HTMLDivElement | null>(null);
  const mapboxRendererRef = useRef<MapRenderer | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastWalkPoint = useRef<LatLng | null>(null);
  const planDragRef = useRef<PlanDrag | null>(null);

  const selectedSpot = spots.find((spot) => spot.id === selectedId) ?? spots[0];
  const planAdapter = useMemo(() => createPlanMapAdapter(spots, size, planView), [planView, spots, size]);
  const adapter = mapboxAdapter ?? planAdapter;
  const userPoint = adapter.project(position);
  const mapboxToken = getEnvValue(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);
  const mapboxStyle = getEnvValue(import.meta.env.VITE_MAPBOX_STYLE) ?? DEFAULT_MAPBOX_STYLE;

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
    const container = mapboxContainerRef.current;
    if (!container || !mapboxToken) {
      mapboxRendererRef.current?.destroy();
      mapboxRendererRef.current = null;
      setMapboxAdapter(null);
      return;
    }

    let cancelled = false;
    let renderer: MapRenderer | null = null;

    try {
      renderer = createMapboxMapRenderer({
        accessToken: mapboxToken,
        center: position,
        container,
        onError: (error) => {
          console.warn("Falling back to plan map", error);
          renderer?.destroy();
          if (!cancelled) {
            mapboxRendererRef.current = null;
            setMapboxAdapter(null);
          }
        },
        onReady: () => {
          if (!cancelled && renderer) {
            mapboxRendererRef.current = renderer;
            setMapboxAdapter(renderer.adapter);
          }
        },
        onViewChange: () => setMapProjectionTick((tick) => tick + 1),
        size,
        spots,
        styleUrl: mapboxStyle,
      });
    } catch (error) {
      console.warn("Falling back to plan map", error);
      setMapboxAdapter(null);
    }

    return () => {
      cancelled = true;
      renderer?.destroy();
      if (mapboxRendererRef.current === renderer) {
        mapboxRendererRef.current = null;
      }
      setMapboxAdapter(null);
    };
  }, [mapboxStyle, mapboxToken, spots]);

  useEffect(() => {
    mapboxRendererRef.current?.resize();
  }, [size]);

  useEffect(() => {
    mapboxRendererRef.current?.setUserPosition(position);
  }, [position]);

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

  function injectFix(fix: Omit<Fix, "timestamp">) {
    engineRef.current?.onFix({ ...fix, timestamp: Date.now() });
  }

  function selectSpot(spot: GhostSpot) {
    // Tapping the already-open pin collapses its action fan.
    if (selectedId === spot.id && storyMode === "map") {
      closeFan();
      return;
    }
    setSelectedId(spot.id);
    setStoryMode("map");
    setCurrentStory(null);
    setCapturedPhotoUrl(null);
    stopNarration();
  }

  function unlockSpotNow(spot: GhostSpot) {
    setSelectedId(spot.id);
    setPosition({ lat: spot.lat, lng: spot.lng });
    setActiveIds((ids) => new Set(ids).add(spot.id));
    setFixStatus(`Unlocked ${displaySpotTitle(spot)}`);
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

  async function beginStory(spot: GhostSpot, autoTalk = false) {
    // Option A: tapping a person is treated as "you're there" — no walk step,
    // no distance gate. Unlock on the spot and drop straight into the story.
    if (!activeIds.has(spot.id)) {
      unlockSpotNow(spot);
    }
    setStoryAutoTalk(autoTalk);

    // Show a character-voiced fallback instantly, then upgrade with Gemini.
    const fallback = createCharacterStory(spot);
    setCurrentStory(fallback);
    setStoryMode("story");
    setWalkMeters(0);
    setCapturedPhotoUrl(null);
    lastWalkPoint.current = null;
    stopNarration();

    const character = getCharacter(spot.id);
    const remote = await fetchStory({
      spotId: spot.id,
      lat: spot.lat,
      lng: spot.lng,
      timeOfDay: getTimeOfDay(),
      placeName: spot.title,
      seed: character?.persona,
    });
    if (remote) {
      setCurrentStory((cur) =>
        cur && cur.spotId === spot.id
          ? { spotId: spot.id, title: remote.title, narration: remote.narration, challenge: remote.challenge }
          : cur
      );
    }
  }

  async function narrate() {
    const story = currentStory;
    if (!story) return;
    stopNarration();
    setIsListening(true);
    // Prefer the real ElevenLabs voice from the backend; fall back to browser TTS.
    const url = await fetchNarrationUrl({ text: story.narration, spotId: story.spotId });
    if (url) {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsListening(false);
      audio.onerror = () => speakBrowser(story);
      try {
        await audio.play();
        return;
      } catch {
        // Autoplay blocked or playback failed — fall back to browser speech.
      }
    }
    speakBrowser(story);
  }

  function speakBrowser(story: Story) {
    if (!("speechSynthesis" in window)) {
      setIsListening(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(story.narration);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
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

  async function saveMemory(kind: "selfie" | "walk") {
    if (!selectedSpot) return;
    const character = getCharacter(selectedSpot.id);
    let photoUrl: string;
    let stickerUrl: string;
    if (kind === "selfie" && capturedPhotoUrl) {
      photoUrl = capturedPhotoUrl;
      stickerUrl = await makeStickerFromPhoto(capturedPhotoUrl, character?.name ?? selectedSpot.title);
    } else {
      photoUrl = createStickerDataUrl(selectedSpot, kind, false);
      stickerUrl = createStickerDataUrl(selectedSpot, kind, true);
    }
    const memory: Memory = {
      id: crypto.randomUUID(),
      day: todayKey(),
      spotId: selectedSpot.id,
      photoUrl,
      stickerUrl,
      caption: character ? `Met ${character.name}` : "Memory captured",
      lat: position.lat,
      lng: position.lng,
      createdAt: Date.now(),
    };
    setMemories((items) => [memory, ...items]);
    setStoryMode("map");
    setCurrentStory(null);
    setCapturedPhotoUrl(null);
    stopNarration();
  }

  function handleCapturePhoto(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCapturedPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function setPlanZoom(nextZoom: number) {
    setPlanView((view) => ({
      ...view,
      zoom: Math.max(0.72, Math.min(2.35, nextZoom)),
    }));
  }

  function panPlanBy(x: number, y: number) {
    setPlanView((view) => ({
      ...view,
      offsetX: clampPlanOffset(view.offsetX + x),
      offsetY: clampPlanOffset(view.offsetY + y),
    }));
  }

  function resetPlanView() {
    setPlanView(PLAN_VIEW_DEFAULT);
    setFixStatus("Map view reset");
  }

  function handlePlanPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (mapboxAdapter || storyMode !== "map" || isInteractiveTarget(event.target)) return;
    // Ignore additional fingers — a second touch starting while a drag is live
    // would otherwise hijack planDragRef and produce jittery movement. It also
    // prevents the plan-map from fighting a pinch gesture on mobile.
    if (planDragRef.current !== null) return;
    planDragRef.current = {
      originX: planView.offsetX,
      originY: planView.offsetY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePlanPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = planDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPlanView((view) => ({
      ...view,
      offsetX: clampPlanOffset(drag.originX + event.clientX - drag.startX),
      offsetY: clampPlanOffset(drag.originY + event.clientY - drag.startY),
    }));
  }

  function handlePlanPointerEnd(event: ReactPointerEvent<HTMLElement>) {
    if (planDragRef.current?.pointerId === event.pointerId) {
      planDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const currentChallenge = currentStory?.challenge;
  const challengeComplete =
    currentChallenge?.type === "walk"
      ? walkMeters >= currentChallenge.targetMeters
      : currentChallenge?.type === "selfie"
        ? Boolean(capturedPhotoUrl)
        : false;

  // Re-projected every render (incl. the mapbox view tick) so collision offsets
  // track the live map; cheap for a handful of pins.
  const pinPlacement = declutterPoints(
    spots.map((spot) => ({
      spot,
      point: adapter.project({ lat: spot.lat, lng: spot.lng }),
    }))
  );

  // Anchor point for the radial action fan on the currently selected pin.
  const fanOpen = Boolean(selectedId) && storyMode === "map";
  const selectedPoint =
    selectedId && selectedSpot
      ? pinPlacement.get(selectedId) ?? adapter.project({ lat: selectedSpot.lat, lng: selectedSpot.lng })
      : null;
  const selectedTour = selectedSpot ? getTourByGuide(selectedSpot.id) : undefined;

  function closeFan() {
    setSelectedId("");
    stopNarration();
  }

  return (
    <main className="app-shell">
      <section
        className={`map-stage ${mapboxAdapter ? "has-mapbox" : "has-plan-map"}`}
        ref={mapRef}
        aria-label="Favorite spots map"
        onPointerDown={handlePlanPointerDown}
        onPointerMove={handlePlanPointerMove}
        onPointerUp={handlePlanPointerEnd}
        onPointerCancel={handlePlanPointerEnd}
      >
        <div className={`mapbox-layer ${mapboxAdapter ? "is-ready" : ""}`} ref={mapboxContainerRef} aria-hidden="true" />
        <div className="plan-map" style={planViewStyle(planView)} aria-hidden={mapboxAdapter ? "true" : undefined}>
          <MapBackdrop />
          <div className="route route-one" />
          <div className="route route-two" />
          <div className="route route-three" />
          <div className="river" />
          <div className="map-label label-north">Soho</div>
          <div className="map-label label-river">River Thames</div>
          <div className="map-label label-east">Dock Street</div>
        </div>

        {spots.map((spot) => (
          <PlacePin
            key={spot.id}
            spot={spot}
            point={pinPlacement.get(spot.id) ?? adapter.project({ lat: spot.lat, lng: spot.lng })}
            isActive={activeIds.has(spot.id)}
            isSelected={selectedId === spot.id}
            onClick={() => selectSpot(spot)}
          />
        ))}

        <div className="user-dot" style={pointStyle(userPoint)} aria-hidden="true">
          <Navigation size={16} fill="currentColor" />
        </div>

        {!mapboxAdapter ? (
          <div className="map-controls glass-panel" aria-label="Fallback map controls">
            <button type="button" onClick={() => panPlanBy(0, 76)} aria-label="Pan map north" title="Pan map north">
              <ChevronUp size={18} />
            </button>
            <button type="button" onClick={() => panPlanBy(-76, 0)} aria-label="Pan map west" title="Pan map west">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => setPlanZoom(planView.zoom + 0.18)} aria-label="Zoom in" title="Zoom in">
              <Plus size={18} />
            </button>
            <button type="button" onClick={() => setPlanZoom(planView.zoom - 0.18)} aria-label="Zoom out" title="Zoom out">
              <Minus size={18} />
            </button>
            <button type="button" onClick={() => panPlanBy(76, 0)} aria-label="Pan map east" title="Pan map east">
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => panPlanBy(0, -76)} aria-label="Pan map south" title="Pan map south">
              <ChevronDown size={18} />
            </button>
            <button className="map-reset" type="button" onClick={resetPlanView} aria-label="Reset map view" title="Reset map view">
              <RotateCcw size={17} />
            </button>
          </div>
        ) : null}

        <header className="topbar glass-panel">
          <div className="topbar-brand">
            <img className="topbar-logo" src="/logo.svg" alt="NearPast" />
          </div>
          <div className="status-cluster">
            <button
              className="status-pill"
              type="button"
              onClick={() => setShowMemoryTab(true)}
              aria-label="Open today's memories"
              title="Open today's memories"
            >
              <Sparkles size={15} />
              {todayMemories.length} today
            </button>
            <button className="icon-button" type="button" onClick={locateUser} aria-label="Locate me">
              <LocateFixed size={19} />
            </button>
          </div>
        </header>

        {fanOpen && selectedSpot && selectedPoint ? (
          <ActionFan
            spot={selectedSpot}
            point={selectedPoint}
            hasTour={Boolean(selectedTour)}
            onStory={() => beginStory(selectedSpot)}
            onTalk={() => beginStory(selectedSpot, true)}
            onTour={() => {
              if (!selectedTour) return;
              stopNarration();
              setSelectedId("");
              setTourState({ open: true, tourId: selectedTour.id });
            }}
            onClose={closeFan}
          />
        ) : null}

        {memories.length > 0 ? (
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
                <img key={memory.id} src={memory.stickerUrl} alt={memory.caption ?? "Memory sticker"} />
              ))
            ) : (
              <>
                <div className="empty-sticker" aria-hidden="true" />
                <div className="empty-sticker" aria-hidden="true" />
                <div className="empty-sticker" aria-hidden="true" />
                <div className="empty-sticker" aria-hidden="true" />
              </>
            )}
          </div>
          <p className="memory-note">
            {todayMemories.length
              ? "Captured stickers stay in this browser for the demo."
              : "Finish a story challenge to stamp today."}
          </p>
        </aside>
        ) : null}

        <nav className="floating-tapbar glass-panel" aria-label="Quick actions">
          <button type="button" onClick={locateUser} aria-label="Locate me" title="Locate me">
            <LocateFixed size={21} />
          </button>
          <button
            type="button"
            onClick={() => setTourState({ open: true })}
            aria-label="Guided tours"
            title="Guided tours"
          >
            <Footprints size={21} />
          </button>
          <button
            className="tapbar-primary"
            type="button"
            onClick={() => setShowMemoryTab(true)}
            aria-label="Today memories"
            title="Today memories"
          >
            <Aperture size={22} />
            {todayMemories.length ? <span>{todayMemories.length}</span> : null}
          </button>
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
            onCapturePhoto={handleCapturePhoto}
            onNarrate={narrate}
            onSave={saveMemory}
            story={currentStory}
            capturedPhotoUrl={capturedPhotoUrl}
            walkMeters={walkMeters}
            autoTalk={storyAutoTalk}
            guideTour={getTourByGuide(currentStory.spotId)}
            onStartTour={(tour: Tour) => {
              stopNarration();
              setStoryMode("map");
              setCurrentStory(null);
              setTourState({ open: true, tourId: tour.id });
            }}
          />
        ) : null}
      </section>
      {showMemoryTab ? <MemoryTab onClose={() => setShowMemoryTab(false)} /> : null}
      {tourState.open ? (
        <TourPlayer initialTourId={tourState.tourId} onClose={() => setTourState({ open: false })} />
      ) : null}
    </main>
  );
}

function StorySheet(props: {
  capturedPhotoUrl: string | null;
  challengeComplete: boolean;
  isListening: boolean;
  mode: StoryMode;
  onAdvanceWalk: () => void;
  onBack: () => void;
  onChallenge: () => void;
  onCapturePhoto: (file: File | null) => void;
  onNarrate: () => void;
  onSave: (kind: "selfie" | "walk") => void;
  story: Story;
  walkMeters: number;
  autoTalk?: boolean;
  guideTour?: Tour;
  onStartTour: (tour: Tour) => void;
}) {
  const challenge = props.story.challenge;
  const walkTarget = challenge.type === "walk" ? challenge.targetMeters : 0;
  const character = getCharacter(props.story.spotId);
  const voice = useVoiceConversation({ voiceIdFor: (c) => VOICE_BY_GUIDE[c.id] });

  // The fan's "Talk" action opens the story already committed to a conversation,
  // so kick the voice session off once per spot instead of waiting for a tap.
  const autoTalkedSpot = useRef<string | null>(null);
  useEffect(() => {
    if (props.autoTalk && character && autoTalkedSpot.current !== character.id) {
      autoTalkedSpot.current = character.id;
      voice.start(character);
    }
  }, [props.autoTalk, character, voice]);

  // Pre-warm disabled for reliability: connect on click instead, so the Talk
  // button can never get stuck in a "Getting ready…" state if warmup hangs.
  const convoLive =
    voice.status === "requesting-token" ||
    voice.status === "connecting" ||
    voice.status === "connected";

  return (
    <div className="story-scrim">
      <section className="story-sheet glass-panel" aria-label="Story mode">
        <div className="story-art">
          <img
            className="story-art-bust"
            src={`/pins/${props.story.spotId}.png`}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span />
        </div>
        <div className="story-content">
          <p className="eyebrow">{props.mode === "story" ? "Place story" : "Challenge"}</p>
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
              {props.guideTour ? (
                <button
                  className="secondary-button tour-cta"
                  type="button"
                  onClick={() => props.onStartTour(props.guideTour!)}
                >
                  <Navigation size={17} />
                  Start {props.guideTour.guideName}'s tour
                </button>
              ) : null}
              {character ? (
                <button
                  className={`primary-button talk-cta ${convoLive ? "is-live" : ""}`}
                  type="button"
                  onClick={() => (convoLive ? voice.stop() : voice.start(character))}
                  aria-label={
                    convoLive ? "End voice conversation" : `Talk to ${character.name.split(" ")[0]}`
                  }
                >
                  <Volume2 size={17} />
                  {convoLive ? "End conversation" : `Talk to ${character.name.split(" ")[0]}`}
                </button>
              ) : null}
              {voice.status !== "idle" ? (
                <div
                  className={`voice-convo ${
                    voice.isSpeaking
                      ? "is-speaking"
                      : voice.status === "pre-connecting" || voice.status === "pre-connected"
                        ? "is-warming"
                        : ""
                  }`}
                >
                  <p className="voice-status">
                    {voice.status === "pre-connecting"
                      ? "Warming up connection…"
                      : voice.status === "pre-connected"
                        ? "Session ready — tap to start speaking"
                        : voice.status === "requesting-token" || voice.status === "connecting"
                          ? "Connecting…"
                          : voice.status === "error"
                            ? `Couldn't connect: ${voice.error ?? "unknown error"}`
                            : voice.status === "connected"
                              ? voice.isSpeaking
                                ? `${character?.name.split(" ")[0]} is speaking…`
                                : "Listening — speak now"
                              : "Conversation ended"}
                  </p>
                  {voice.transcript.length ? (
                    <div className="voice-transcript">
                      {voice.transcript.slice(-4).map((m, i) => (
                        <p key={i} className={m.source === "user" ? "vt-user" : "vt-agent"}>
                          <strong>{m.source === "user" ? "You" : character?.name.split(" ")[0]}:</strong>{" "}
                          {m.message}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                  {props.capturedPhotoUrl ? (
                    <img src={props.capturedPhotoUrl} alt="Captured place detail" />
                  ) : (
                    <Aperture size={30} />
                  )}
                  <label>
                    <span>{props.capturedPhotoUrl ? "Photo ready" : "Open camera"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => props.onCapturePhoto(event.currentTarget.files?.[0] ?? null)}
                    />
                  </label>
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

function createCharacterStory(spot: GhostSpot): Story {
  const character = getCharacter(spot.id);
  const timeOfDay = getTimeOfDay();
  const challenge: Challenge = character?.challenge ?? {
    type: "selfie",
    instruction: "Take a photo to remember standing on this exact spot.",
  };
  const narration = character
    ? `${character.persona}`
    : `You stand where history happened, in the ${timeOfDay} light, and the place begins to speak.`;
  return {
    spotId: spot.id,
    title: character?.name ?? displaySpotTitle(spot),
    narration,
    challenge,
  };
}

function createStickerDataUrl(spot: GhostSpot, kind: "selfie" | "walk", sticker: boolean) {
  const title = displaySpotTitle(spot).split(" ").slice(0, 2).join(" ");
  const glyph = kind === "walk" ? "foot" : "face";
  const bg = sticker ? "#fffdf2" : "#ded8c5";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
    <rect width="220" height="220" rx="44" fill="${bg}"/>
    <circle cx="110" cy="104" r="58" fill="#2b2927"/>
    <circle cx="110" cy="104" r="45" fill="#fffef9"/>
    <text x="110" y="112" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#2b2927">${glyph}</text>
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

function displaySpotTitle(spot: GhostSpot) {
  return DISPLAY_TITLES[spot.id] ?? spot.title.replace(/^The /, "");
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

function planViewStyle(view: PlanMapView) {
  return {
    transform: `translate(${view.offsetX}px, ${view.offsetY}px) scale(${view.zoom})`,
  };
}

// Option A radial action fan: labelled icons bloom out of the tapped pin so the
// user drops straight into an action — no "walk here" navigate step, no card gap.
function ActionFan({
  spot,
  point,
  hasTour,
  onStory,
  onTalk,
  onTour,
  onClose,
}: {
  spot: GhostSpot;
  point: ScreenPoint;
  hasTour: boolean;
  onStory: () => void;
  onTalk: () => void;
  onTour: () => void;
  onClose: () => void;
}) {
  const character = getCharacter(spot.id);
  const firstName = character?.name.split(" ")[0] ?? displaySpotTitle(spot);

  const base = [
    { key: "story", label: "Story", icon: <BookOpen size={20} />, onClick: onStory, primary: true },
    { key: "talk", label: `Talk`, icon: <Volume2 size={20} />, onClick: onTalk, primary: false },
  ];
  if (hasTour) {
    base.push({ key: "tour", label: "Tour", icon: <Navigation size={20} />, onClick: onTour, primary: false });
  }

  // Fan the items across an upward arc centred on the pin.
  const n = base.length;
  const radius = 96;
  const spreadDeg = n <= 1 ? 0 : Math.min(150, 58 * (n - 1));
  const startDeg = -90 - spreadDeg / 2;
  const items = base.map((action, i) => {
    const deg = n <= 1 ? -90 : startDeg + (spreadDeg / (n - 1)) * i;
    const rad = (deg * Math.PI) / 180;
    return { ...action, x: Math.cos(rad) * radius, y: Math.sin(rad) * radius, delay: i * 40 };
  });

  return (
    <>
      <div className="action-fan-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="action-fan"
        style={{ left: `${point.x}px`, top: `${point.y}px` }}
        role="menu"
        aria-label={`${firstName} actions`}
      >
        {items.map((item) => (
          <button
            key={item.key}
            className={`action-fan-item ${item.primary ? "is-primary" : ""}`}
            type="button"
            role="menuitem"
            style={{
              transform: `translate(-50%, -50%) translate(${item.x}px, ${item.y}px)`,
              animationDelay: `${item.delay}ms`,
            }}
            onClick={item.onClick}
          >
            <span className="action-fan-ic">{item.icon}</span>
            <span className="action-fan-cap">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function PlacePin({
  spot,
  point,
  isActive,
  isSelected,
  onClick,
}: {
  spot: GhostSpot;
  point: ScreenPoint;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <button
      className={`place-pin ${isActive ? "is-active" : ""} ${isSelected ? "is-selected" : ""}`}
      style={{
        left: `${point.x}px`,
        top: `${point.y}px`,
        zIndex: isSelected ? 44 : isActive ? 36 : 32,
      }}
      type="button"
      onClick={onClick}
      aria-label={`${displaySpotTitle(spot)} ${isActive ? "unlocked" : "locked"}`}
    >
      {imageFailed ? (
        <>
          <span className="pin-halo" />
          <span className="place-pin-glyph">
            <PinIcon spot={spot} />
          </span>
        </>
      ) : (
        <img
          className="place-pin-bust"
          src={`/pins/${spot.id}.png`}
          alt=""
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
      <span className="pin-name">{displaySpotTitle(spot)}</span>
    </button>
  );
}

// Fan out pins whose projected screen points overlap so dense clusters (the Soho
// figures sit within ~70-280m) stay individually tappable instead of stacking.
function declutterPoints(
  items: Array<{ spot: GhostSpot; point: ScreenPoint }>,
  minDistance = 46
): Map<string, ScreenPoint> {
  const placed: ScreenPoint[] = [];
  const result = new Map<string, ScreenPoint>();
  items.forEach((item, index) => {
    let x = item.point.x;
    let y = item.point.y;
    for (let pass = 0; pass < 16; pass += 1) {
      let collided = false;
      for (const other of placed) {
        const dx = x - other.x;
        const dy = y - other.y;
        const dist = Math.hypot(dx, dy);
        if (dist < minDistance) {
          collided = true;
          const angle = dist > 0.01 ? Math.atan2(dy, dx) : index * 2.39996;
          const push = minDistance - dist + 0.5;
          x += Math.cos(angle) * push;
          y += Math.sin(angle) * push;
        }
      }
      if (!collided) break;
    }
    const resolved = { x, y };
    placed.push(resolved);
    result.set(item.spot.id, resolved);
  });
  return result;
}

function PinIcon({ spot }: { spot: GhostSpot }) {
  const iconProps = { size: 22, strokeWidth: 2.25 };
  switch (spot.icon) {
    case "science":
      return <FlaskConical {...iconProps} />;
    case "music":
      return <Music {...iconProps} />;
    case "politics":
    case "history":
      return <Landmark {...iconProps} />;
    case "arts":
      return <Palette {...iconProps} />;
    case "literature":
      return <BookOpen {...iconProps} />;
    // legacy favorite-spot categories (kept for safety)
    case "coffee":
      return <Coffee {...iconProps} />;
    case "books":
      return <BookOpen {...iconProps} />;
    case "walk":
      return <Footprints {...iconProps} />;
    default:
      return <MapPin {...iconProps} />;
  }
}

function clampPlanOffset(value: number) {
  return Math.max(-520, Math.min(520, value));
}

function isInteractiveTarget(target: EventTarget) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, a, input, label, textarea, select, .glass-panel, .mapbox-layer"))
    : false;
}

function getEnvValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
