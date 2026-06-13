import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LatLng } from "@tth/shared";

import type { MapBounds, MapRendererProps } from "../adapters/mapRendererTypes";

type Point = { x: number; y: number };

export function MapLikeRenderer({
  spots,
  userLocation,
  activeSpotIds,
  selectedSpotId,
  camera,
  onSelectSpot
}: MapRendererProps) {
  return (
    <View style={styles.map}>
      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={[styles.block, styles.blockOne]} />
      <View style={[styles.block, styles.blockTwo]} />
      <View style={[styles.river]} />

      {spots.map((spot) => {
        const point = project({ lat: spot.lat, lng: spot.lng }, camera.bounds);
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
              left: `${project(userLocation, camera.bounds).x}%`,
              top: `${project(userLocation, camera.bounds).y}%`
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

function project(point: LatLng, bounds: MapBounds): Point {
  const latSpan = Math.max(bounds.northEast.lat - bounds.southWest.lat, 0.000001);
  const lngSpan = Math.max(bounds.northEast.lng - bounds.southWest.lng, 0.000001);
  const x = ((point.lng - bounds.southWest.lng) / lngSpan) * 100;
  const y = (1 - (point.lat - bounds.southWest.lat) / latSpan) * 100;

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
