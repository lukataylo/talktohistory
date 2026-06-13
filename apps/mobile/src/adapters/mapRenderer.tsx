import { MapLikeRenderer } from "../components/MapLikeRenderer";

import type { MapRendererComponent } from "./mapRendererTypes";

// Expo Go cannot load native Mapbox modules. Native builds can swap this export
// for a Mapbox-backed component without changing the app flow.
export const MapRenderer: MapRendererComponent = MapLikeRenderer;
