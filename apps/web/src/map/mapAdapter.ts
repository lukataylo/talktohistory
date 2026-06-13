import type { GhostSpot, LatLng } from "@tth/shared";
import mapboxgl, { type Map as MapboxMap, type MapboxOptions } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

export type MapRenderer = {
  readonly adapter: MapAdapter;
  destroy(): void;
  resize(): void;
  setUserPosition(point: LatLng): void;
};

export type PlanMapView = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

export type MapboxRendererOptions = {
  accessToken: string;
  center: LatLng;
  container: HTMLElement;
  onError: (error: Error) => void;
  onReady: () => void;
  onViewChange: () => void;
  size: { width: number; height: number };
  spots: GhostSpot[];
  styleUrl: string;
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
  size: { width: number; height: number },
  view: PlanMapView = { offsetX: 0, offsetY: 0, zoom: 1 }
): MapAdapter {
  const bounds = getBounds(spots);
  const padding = Math.max(42, Math.min(size.width, size.height) * 0.12);
  const width = Math.max(1, size.width - padding * 2);
  const height = Math.max(1, size.height - padding * 2);
  const center = { x: size.width / 2, y: size.height / 2 };

  function applyView(point: ScreenPoint): ScreenPoint {
    return {
      x: center.x + (point.x - center.x) * view.zoom + view.offsetX,
      y: center.y + (point.y - center.y) * view.zoom + view.offsetY,
    };
  }

  function removeView(point: ScreenPoint): ScreenPoint {
    return {
      x: center.x + (point.x - view.offsetX - center.x) / view.zoom,
      y: center.y + (point.y - view.offsetY - center.y) / view.zoom,
    };
  }

  return {
    name: "plan-renderer",
    project(point) {
      const lngSpan = Math.max(0.0001, bounds.maxLng - bounds.minLng);
      const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
      const x = padding + ((point.lng - bounds.minLng) / lngSpan) * width;
      const y = padding + ((bounds.maxLat - point.lat) / latSpan) * height;
      return applyView({ x, y });
    },
    unproject(point) {
      const unviewed = removeView(point);
      const lngSpan = Math.max(0.0001, bounds.maxLng - bounds.minLng);
      const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
      return {
        lat: bounds.maxLat - ((unviewed.y - padding) / height) * latSpan,
        lng: bounds.minLng + ((unviewed.x - padding) / width) * lngSpan,
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

export function createMapboxMapRenderer(options: MapboxRendererOptions): MapRenderer {
  mapboxgl.accessToken = options.accessToken;
  options.container.replaceChildren();

  let ready = false;
  let destroyed = false;
  let viewChangeFrame = 0;

  const map = new mapboxgl.Map({
    attributionControl: false,
    center: [options.center.lng, options.center.lat],
    container: options.container,
    cooperativeGestures: true,
    pitchWithRotate: false,
    style: options.styleUrl,
    zoom: 13.1,
  } satisfies MapboxOptions);

  map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

  const adapter: MapAdapter = {
    name: "mapbox-gl",
    project(point) {
      const projected = map.project([point.lng, point.lat]);
      return { x: projected.x, y: projected.y };
    },
    unproject(point) {
      const lngLat = map.unproject([point.x, point.y]);
      return { lat: lngLat.lat, lng: lngLat.lng };
    },
    markerForSpot(spot) {
      return {
        id: spot.id,
        title: spot.title,
        point: { lat: spot.lat, lng: spot.lng },
      };
    },
  };

  function notifyViewChange() {
    if (viewChangeFrame) return;
    viewChangeFrame = window.requestAnimationFrame(() => {
      viewChangeFrame = 0;
      if (!destroyed) {
        options.onViewChange();
      }
    });
  }

  function fail(error: Error) {
    if (destroyed) return;
    if (!ready) {
      options.onError(error);
    } else {
      console.warn("Mapbox renderer error", error);
    }
  }

  map.on("load", () => {
    ready = true;
    fitMapToSpots(map, options.spots, options.center, options.size);
    options.onReady();
    notifyViewChange();
  });

  map.on("error", (event) => {
    const sourceError = event.error;
    fail(sourceError instanceof Error ? sourceError : new Error(String(sourceError ?? "Mapbox failed to initialize")));
  });

  map.on("move", notifyViewChange);
  map.on("resize", notifyViewChange);

  return {
    adapter,
    destroy() {
      destroyed = true;
      if (viewChangeFrame) {
        window.cancelAnimationFrame(viewChangeFrame);
        viewChangeFrame = 0;
      }
      map.remove();
    },
    resize() {
      map.resize();
      notifyViewChange();
    },
    setUserPosition(point) {
      if (!ready) return;
      const projected = map.project([point.lng, point.lat]);
      const buffer = 72;
      const outsideViewport =
        projected.x < buffer ||
        projected.y < buffer ||
        projected.x > options.container.clientWidth - buffer ||
        projected.y > options.container.clientHeight - buffer;

      if (outsideViewport) {
        map.easeTo({
          center: [point.lng, point.lat],
          duration: 500,
          essential: true,
        });
      } else {
        notifyViewChange();
      }
    },
  };
}

function fitMapToSpots(
  map: MapboxMap,
  spots: GhostSpot[],
  center: LatLng,
  size: { width: number; height: number }
) {
  const bounds = new mapboxgl.LngLatBounds([center.lng, center.lat], [center.lng, center.lat]);

  for (const spot of spots) {
    bounds.extend([spot.lng, spot.lat]);
  }

  map.fitBounds(bounds, {
    duration: 0,
    maxZoom: 14.7,
    padding: {
      top: Math.min(170, Math.max(90, size.height * 0.22)),
      right: Math.min(360, Math.max(96, size.width * 0.28)),
      bottom: Math.min(240, Math.max(140, size.height * 0.28)),
      left: Math.min(440, Math.max(96, size.width * 0.26)),
    },
  });
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
