import type { GhostSpot, LatLng } from "@tth/shared";

export type ScreenPoint = { x: number; y: number };

export type MapMarker = {
  id: string;
  point: LatLng;
  title: string;
};

export type MapAdapter = {
  readonly name: string;
  project(point: LatLng): ScreenPoint;
  unproject(point: ScreenPoint): LatLng;
  markerForSpot(spot: GhostSpot): MapMarker;
};

type Bounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

const EMPTY_BOUNDS: Bounds = {
  minLat: 51.495,
  maxLat: 51.521,
  minLng: -0.155,
  maxLng: -0.07,
};

export function createPlanMapAdapter(
  spots: GhostSpot[],
  size: { width: number; height: number }
): MapAdapter {
  const bounds = getBounds(spots);
  const padding = Math.max(42, Math.min(size.width, size.height) * 0.12);
  const width = Math.max(1, size.width - padding * 2);
  const height = Math.max(1, size.height - padding * 2);

  return {
    name: "plan-renderer",
    project(point) {
      const lngSpan = Math.max(0.0001, bounds.maxLng - bounds.minLng);
      const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
      const x = padding + ((point.lng - bounds.minLng) / lngSpan) * width;
      const y = padding + ((bounds.maxLat - point.lat) / latSpan) * height;
      return { x, y };
    },
    unproject(point) {
      const lngSpan = Math.max(0.0001, bounds.maxLng - bounds.minLng);
      const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
      return {
        lat: bounds.maxLat - ((point.y - padding) / height) * latSpan,
        lng: bounds.minLng + ((point.x - padding) / width) * lngSpan,
      };
    },
    markerForSpot(spot) {
      return {
        id: spot.id,
        title: spot.title,
        point: { lat: spot.lat, lng: spot.lng },
      };
    },
  };
}

function getBounds(spots: GhostSpot[]): Bounds {
  if (!spots.length) return EMPTY_BOUNDS;

  const minLat = Math.min(...spots.map((spot) => spot.lat));
  const maxLat = Math.max(...spots.map((spot) => spot.lat));
  const minLng = Math.min(...spots.map((spot) => spot.lng));
  const maxLng = Math.max(...spots.map((spot) => spot.lng));
  const latPad = Math.max(0.006, (maxLat - minLat) * 0.34);
  const lngPad = Math.max(0.012, (maxLng - minLng) * 0.28);

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}
