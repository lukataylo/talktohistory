import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GhostSpot, LatLng } from "@tth/shared";

import type { MapRendererProps } from "../adapters/mapRendererTypes";

type Point = { x: number; y: number };

export function MapLikeRenderer({
  spots,
  userLocation,
  activeSpotIds,
  selectedSpotId,
  onSelectSpot
}: MapRendererProps) {
  const bounds = getBounds(spots, userLocation);

  return (
    <View style={styles.map}>
      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={[styles.block, styles.blockOne]} />
      <View style={[styles.block, styles.blockTwo]} />
      <View style={[styles.river]} />

      {spots.map((spot) => {
        const point = project({ lat: spot.lat, lng: spot.lng }, bounds);
        const active = activeSpotIds.has(spot.id);
        const selected = selectedSpotId === spot.id;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${spot.title} ghost pin`}
            key={spot.id}
            onPress={() => onSelectSpot(spot)}
            style={[
              styles.pin,
              {
                left: `${point.x}%`,
                top: `${point.y}%`
              },
              active && styles.pinActive,
              selected && styles.pinSelected
            ]}
          >
            <Text style={styles.pinGlyph}>{active ? "!" : "G"}</Text>
          </Pressable>
        );
      })}

      {userLocation ? (
        <View
          style={[
            styles.userDot,
            {
              left: `${project(userLocation, bounds).x}%`,
              top: `${project(userLocation, bounds).y}%`
            }
          ]}
        >
          <View style={styles.userDotCore} />
        </View>
      ) : null}

      <View style={styles.compass}>
        <Text style={styles.compassText}>N</Text>
      </View>
    </View>
  );
}

function getBounds(spots: GhostSpot[], userLocation: LatLng | null) {
  const points = [
    ...spots.map((spot) => ({ lat: spot.lat, lng: spot.lng })),
    ...(userLocation ? [userLocation] : [])
  ];
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.18, 0.002);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.002);

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad
  };
}

function project(point: LatLng, bounds: ReturnType<typeof getBounds>): Point {
  const x = ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const y = (1 - (point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;

  return {
    x: clamp(x, 6, 94),
    y: clamp(y, 6, 94)
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const styles = StyleSheet.create({
  map: {
    minHeight: 420,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#cad7cd",
    borderWidth: 1,
    borderColor: "#839184"
  },
  road: {
    position: "absolute",
    backgroundColor: "#eef1e8",
    borderColor: "#b9c0b2",
    borderWidth: 1
  },
  roadOne: {
    width: "18%",
    height: "130%",
    left: "34%",
    top: "-12%",
    transform: [{ rotate: "18deg" }]
  },
  roadTwo: {
    width: "115%",
    height: "16%",
    left: "-6%",
    top: "49%",
    transform: [{ rotate: "-7deg" }]
  },
  roadThree: {
    width: "12%",
    height: "120%",
    left: "70%",
    top: "-8%",
    transform: [{ rotate: "-22deg" }]
  },
  block: {
    position: "absolute",
    borderRadius: 8,
    backgroundColor: "#abbda9",
    opacity: 0.58
  },
  blockOne: {
    width: "22%",
    height: "18%",
    left: "9%",
    top: "16%"
  },
  blockTwo: {
    width: "26%",
    height: "20%",
    right: "9%",
    bottom: "13%"
  },
  river: {
    position: "absolute",
    width: "26%",
    height: "125%",
    right: "-6%",
    top: "-8%",
    backgroundColor: "#87a9b5",
    opacity: 0.7,
    transform: [{ rotate: "11deg" }]
  },
  pin: {
    position: "absolute",
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2f3430",
    borderColor: "#f1efe3",
    borderWidth: 3
  },
  pinActive: {
    backgroundColor: "#9f3d55"
  },
  pinSelected: {
    borderColor: "#f4c95d",
    borderWidth: 4
  },
  pinGlyph: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  },
  userDot: {
    position: "absolute",
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 99, 235, 0.2)"
  },
  userDotCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563eb"
  },
  compass: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f3e8",
    borderWidth: 1,
    borderColor: "#b9ad95"
  },
  compassText: {
    color: "#3f3a31",
    fontSize: 14,
    fontWeight: "800"
  }
});
