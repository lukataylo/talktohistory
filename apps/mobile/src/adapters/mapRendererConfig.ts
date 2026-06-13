import type { GhostSpot, LatLng } from "@tth/shared";

import type { MapBounds, MapCamera, MapRendererConfig } from "./mapRendererTypes";

const DEFAULT_MAPBOX_STYLE_URL = "mapbox://styles/mapbox/streets-v12";

type ExpoPublicEnv = {
  EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?: string;
  EXPO_PUBLIC_MAPBOX_STYLE_URL?: string;
};

declare const process: { env: ExpoPublicEnv };

export function getMapRendererConfig(): MapRendererConfig {
  return {
    kind: "expo-go-demo",
    mapbox: {
      // Keep Mapbox config outside source; Expo inlines EXPO_PUBLIC_* values at build/start time.
      accessToken: readPublicEnvValue(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN),
      styleUrl: readPublicEnvValue(process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL) ?? DEFAULT_MAPBOX_STYLE_URL
    }
  };
}

export function getInitialMapCamera(spots: GhostSpot[], userLocation: LatLng | null): MapCamera {
  const bounds = getMapBounds(spots, userLocation);

  return {
    center: getBoundsCenter(bounds),
    bounds,
    zoom: 14,
    pitch: 0,
    bearing: 0,
    padding: 36
  };
}

export function getMapBounds(spots: GhostSpot[], userLocation: LatLng | null): MapBounds {
  const points = [
    ...spots.map((spot) => ({ lat: spot.lat, lng: spot.lng })),
    ...(userLocation ? [userLocation] : [])
  ];

  if (points.length === 0) {
    const fallbackCenter = { lat: 51.5074, lng: -0.1278 };
    return {
      northEast: fallbackCenter,
      southWest: fallbackCenter
    };
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.18, 0.002);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.002);

  return {
    northEast: { lat: maxLat + latPad, lng: maxLng + lngPad },
    southWest: { lat: minLat - latPad, lng: minLng - lngPad }
  };
}

function getBoundsCenter(bounds: MapBounds): LatLng {
  return {
    lat: (bounds.northEast.lat + bounds.southWest.lat) / 2,
    lng: (bounds.northEast.lng + bounds.southWest.lng) / 2
  };
}

function readPublicEnvValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
