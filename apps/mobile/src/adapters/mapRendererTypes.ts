import type { GhostSpot, LatLng } from "@tth/shared";

export type MapRendererProps = {
  spots: GhostSpot[];
  userLocation: LatLng | null;
  activeSpotIds: ReadonlySet<string>;
  selectedSpotId: string | null;
  onSelectSpot: (spot: GhostSpot) => void;
};
