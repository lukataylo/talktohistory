import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import type { Fix, GhostSpot, LatLng } from "@tth/shared";

type PermissionState = "idle" | "asking" | "granted" | "denied" | "error";

export type LocationAdapterState = {
  permission: PermissionState;
  liveFix: Fix | null;
  error: string | null;
  requestLiveLocation: () => Promise<void>;
  makeSyntheticFix: (spot: GhostSpot) => Fix;
};

export function useLocationAdapter(): LocationAdapterState {
  const [permission, setPermission] = useState<PermissionState>("idle");
  const [liveFix, setLiveFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  const requestLiveLocation = useCallback(async () => {
    setPermission("asking");
    setError(null);

    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status !== Location.PermissionStatus.GRANTED) {
        setPermission("denied");
        return;
      }

      setPermission("granted");
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setLiveFix(toFix(current));

      subscriptionRef.current?.remove();
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 2500
        },
        (position) => setLiveFix(toFix(position))
      );
    } catch (err) {
      setPermission("error");
      setError(err instanceof Error ? err.message : "Location failed");
    }
  }, []);

  const makeSyntheticFix = useCallback((spot: GhostSpot): Fix => {
    return {
      lat: spot.lat,
      lng: spot.lng,
      accuracy: 8,
      timestamp: Date.now(),
      synthetic: true
    };
  }, []);

  return useMemo(
    () => ({ permission, liveFix, error, requestLiveLocation, makeSyntheticFix }),
    [permission, liveFix, error, requestLiveLocation, makeSyntheticFix]
  );
}

export function spotPoint(spot: GhostSpot): LatLng {
  return { lat: spot.lat, lng: spot.lng };
}

function toFix(position: Location.LocationObject): Fix {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 999,
    timestamp: position.timestamp
  };
}
