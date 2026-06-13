import type { ReactElement } from "react";
import type { GhostSpot, LatLng } from "@tth/shared";

export type MapRendererKind = "expo-go-demo" | "native-mapbox";

export type MapBounds = {
  northEast: LatLng;
  southWest: LatLng;
};

export type MapCamera = {
  center: LatLng;
  bounds: MapBounds;
  zoom: number;
  pitch: number;
  bearing: number;
  padding: number;
};

export type MapboxRendererConfig = {
  accessToken: string | null;
  styleUrl: string | null;
};

export type MapRendererConfig = {
  kind: MapRendererKind;
  mapbox: MapboxRendererConfig;
};

export type MapRendererProps = {
  spots: GhostSpot[];
  userLocation: LatLng | null;
  activeSpotIds: ReadonlySet<string>;
  selectedSpotId: string | null;
  camera: MapCamera;
  config: MapRendererConfig;
  onSelectSpot: (spot: GhostSpot) => void;
};

export type MapRendererComponent = (props: MapRendererProps) => ReactElement;
