import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  haversineMeters,
  ProximityEngine,
  SEED_SPOTS,
  type Fix,
  type GhostSpot,
  type LatLng,
  type Memory
} from "@tth/shared";

import { makeMemoryId } from "./memory";
import { useLocationAdapter } from "./adapters/locationAdapter";
import { MapRenderer } from "./adapters/mapRenderer";
import { getInitialMapCamera, getMapRendererConfig } from "./adapters/mapRendererConfig";
import { ChallengeCapture } from "./components/ChallengeCapture";
import { MemoryDayView } from "./components/MemoryDayView";
import { StoryCard } from "./components/StoryCard";
import { buildDemoStory } from "./data/demoStories";

type ViewMode = "map" | "memories";

export function GhostMapApp() {
  const [today, setToday] = useState(() => getLocalCalendarDay(new Date()));
  const location = useLocationAdapter();
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(SEED_SPOTS[0]?.id ?? null);
  const [unlockedSpotIds, setUnlockedSpotIds] = useState<Set<string>>(() => new Set());
  const [position, setPosition] = useState<LatLng | null>(null);
  const [lastEvent, setLastEvent] = useState("Pick a favorite spot to preview");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);

  const engineRef = useRef<ProximityEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new ProximityEngine((event) => {
      if (event.type === "position") {
        setPosition(event.point);
        return;
      }

      if (event.type === "activate") {
        setUnlockedSpotIds((current) => {
          const next = new Set(current);
          next.add(event.spot.id);
          return next;
        });
        setSelectedSpotId(event.spot.id);
        setLastEvent(`Unlocked ${event.spot.title}`);
        return;
      }

      setLastEvent(`${event.spot.title} is out of range`);
    });
  }

  useEffect(() => {
    engineRef.current?.setSpots(SEED_SPOTS);
  }, []);

  useEffect(() => {
    if (location.liveFix) {
      feedFix(location.liveFix);
    }
  }, [location.liveFix]);

  const selectedSpot = useMemo(
    () => SEED_SPOTS.find((spot) => spot.id === selectedSpotId) ?? SEED_SPOTS[0] ?? null,
    [selectedSpotId]
  );
  const selectedUnlocked = selectedSpot ? unlockedSpotIds.has(selectedSpot.id) : false;
  const selectedStory = selectedSpot && selectedUnlocked ? buildDemoStory(selectedSpot) : null;
  const todayMemories = memories.filter((memory) => memory.day === today);
  const mapRendererConfig = useMemo(() => getMapRendererConfig(), []);
  const mapCamera = useMemo(() => getInitialMapCamera(SEED_SPOTS, position), [position]);

  const distanceLabel = useMemo(() => {
    if (!selectedSpot) return "";
    if (!position) return `Unlock radius ${selectedSpot.unlockRadius}m`;

    const distance = haversineMeters(position, { lat: selectedSpot.lat, lng: selectedSpot.lng });
    return `${Math.round(distance)}m away`;
  }, [position, selectedSpot]);

  function feedFix(fix: Fix) {
    engineRef.current?.onFix(fix);
  }

  function unlockWithDemo(spot: GhostSpot | null) {
    if (!spot) return;
    setCaptureOpen(false);
    setSelectedSpotId(spot.id);
    setLastEvent(`Demo approach started for ${spot.title}`);

    const fix = location.makeSyntheticFix(spot);
    feedFix(fix);
    feedFix({ ...fix, timestamp: fix.timestamp + 1 });
    feedFix({ ...fix, timestamp: fix.timestamp + 2 });
  }

  function savePlaceholderMemory() {
    if (!selectedSpot) return;

    const localDay = getLocalCalendarDay(new Date());
    setToday(localDay);

    const memory: Memory = {
      id: makeMemoryId(),
      day: localDay,
      spotId: selectedSpot.id,
      photoUrl: "local-placeholder://capture",
      stickerUrl: "local-placeholder://sticker",
      caption: selectedSpot.title,
      lat: selectedSpot.lat,
      lng: selectedSpot.lng,
      createdAt: Date.now()
    };

    setMemories((current) => [memory, ...current]);
    setCaptureOpen(false);
    setViewMode("memories");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Favorite spots</Text>
            <Text style={styles.title}>NearPast</Text>
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterNumber}>{unlockedSpotIds.size}</Text>
            <Text style={styles.counterLabel}>unlocked</Text>
          </View>
        </View>

        <View style={styles.segmented}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setViewMode("map")}
            style={[styles.segment, viewMode === "map" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, viewMode === "map" && styles.segmentTextActive]}>Map</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setViewMode("memories")}
            style={[styles.segment, viewMode === "memories" && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, viewMode === "memories" && styles.segmentTextActive]}>Memories</Text>
          </Pressable>
        </View>

        {viewMode === "map" ? (
          <>
            <View style={styles.toolbar}>
              <Pressable accessibilityRole="button" onPress={location.requestLiveLocation} style={styles.toolbarButton}>
                <Text style={styles.toolbarButtonText}>Use location</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => unlockWithDemo(selectedSpot)} style={styles.toolbarButtonAlt}>
                <Text style={styles.toolbarButtonAltText}>Demo unlock</Text>
              </Pressable>
            </View>

            <View style={styles.statusBar}>
              <Text style={styles.statusText}>{lastEvent}</Text>
              <Text style={styles.statusMeta}>
                Location: {location.permission}
                {location.error ? `, ${location.error}` : ""}
              </Text>
            </View>

            <MapRenderer
              spots={SEED_SPOTS}
              userLocation={position}
              activeSpotIds={unlockedSpotIds}
              selectedSpotId={selectedSpot?.id ?? null}
              camera={mapCamera}
              config={mapRendererConfig}
              onSelectSpot={(spot) => {
                setCaptureOpen(false);
                setSelectedSpotId(spot.id);
              }}
            />

            <StoryCard
              spot={selectedSpot}
              story={selectedStory}
              distanceLabel={distanceLabel}
              isUnlocked={selectedUnlocked}
              onDemoUnlock={() => unlockWithDemo(selectedSpot)}
              onCapture={() => setCaptureOpen(true)}
            />

            <ChallengeCapture
              spot={selectedSpot}
              visible={captureOpen}
              onCancel={() => setCaptureOpen(false)}
              onSave={savePlaceholderMemory}
            />
          </>
        ) : (
          <MemoryDayView day={today} memories={todayMemories} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getLocalCalendarDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5efe3",
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight ?? 0 : 0
  },
  screen: {
    flex: 1
  },
  content: {
    gap: 12,
    padding: 16,
    paddingBottom: 30
  },
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  kicker: {
    color: "#6d5f4c",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: "#20231e",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 35
  },
  counter: {
    minWidth: 68,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#20231e"
  },
  counterNumber: {
    color: "#f4c95d",
    fontSize: 22,
    fontWeight: "900"
  },
  counterLabel: {
    color: "#fffaf0",
    fontSize: 12,
    fontWeight: "800"
  },
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#ded6c6"
  },
  segment: {
    minHeight: 42,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6
  },
  segmentActive: {
    backgroundColor: "#ffffff"
  },
  segmentText: {
    color: "#5d594f",
    fontSize: 14,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: "#20231e"
  },
  toolbar: {
    flexDirection: "row",
    gap: 10
  },
  toolbarButton: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#315241"
  },
  toolbarButtonAlt: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f4c95d"
  },
  toolbarButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  toolbarButtonAltText: {
    color: "#2f2718",
    fontSize: 14,
    fontWeight: "900"
  },
  statusBar: {
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#e8eee6",
    borderWidth: 1,
    borderColor: "#c7d2c3"
  },
  statusText: {
    color: "#27312b",
    fontSize: 14,
    fontWeight: "900"
  },
  statusMeta: {
    color: "#5b665d",
    fontSize: 12,
    fontWeight: "700"
  }
});
