import { useEffect, useRef, useState } from "react";
import type { ChargingStation } from "./shared/domain";
import type { Coordinates } from "./shared/geo";

declare global {
  interface Window {
    google?: any;
    __group28GoogleMapsLoading?: Promise<void>;
  }
}

const statusColors: Record<string, string> = {
  Available: "#16a56b",
  Occupied: "#e8a022",
  Offline: "#c43f32"
};

interface MapViewProps {
  stations: ChargingStation[];
  selectedStationId: string;
  apiKey?: string;
  origin: Coordinates;
  locationMode: "live" | "fallback";
  onSelect: (stationId: string) => void;
}

export function MapView({ stations, selectedStationId, apiKey, origin, locationMode, onSelect }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google) return;

        if (!mapInstance.current) {
          mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: 38.432, lng: 27.145 },
            zoom: 12,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            clickableIcons: false
          });
        }

        markers.current.forEach((marker) => marker.setMap(null));
        mapInstance.current.setCenter({ lat: origin.latitude, lng: origin.longitude });
        const userMarker = new window.google.maps.Marker({
          map: mapInstance.current,
          position: { lat: origin.latitude, lng: origin.longitude },
          title: locationMode === "live" ? "Your current location" : "Demo origin",
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#1f6feb",
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: "#ffffff"
          }
        });
        markers.current = [
          userMarker,
          ...stations.map((station) => {
          const availability = stationAvailability(station);
          const marker = new window.google.maps.Marker({
            map: mapInstance.current,
            position: { lat: station.latitude, lng: station.longitude },
            title: `${station.name} - ${availability}`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: station.id === selectedStationId ? 11 : 9,
              fillColor: statusColors[availability],
              fillOpacity: 1,
              strokeWeight: 3,
              strokeColor: "#ffffff"
            }
          });
          marker.addListener("click", () => onSelect(station.id));
          return marker;
          })
        ];
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));

    return () => {
      cancelled = true;
    };
  }, [apiKey, stations, selectedStationId, origin.latitude, origin.longitude, locationMode, onSelect]);

  if (!apiKey || loadError) {
    return <FallbackMap stations={stations} selectedStationId={selectedStationId} origin={origin} locationMode={locationMode} onSelect={onSelect} reason={loadError || "Google Maps API key is not configured yet."} />;
  }

  return (
    <div className="real-map-shell">
      <div ref={mapRef} className="real-map" />
      <div className="map-note">Live Google Maps mode</div>
      <div className="map-legend" aria-label="Marker legend">
        <span className="legend-available">Available</span>
        <span className="legend-occupied">Occupied</span>
        <span className="legend-offline">Offline</span>
      </div>
    </div>
  );
}

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (window.__group28GoogleMapsLoading) return window.__group28GoogleMapsLoading;

  window.__group28GoogleMapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script could not be loaded. Check the API key and Maps JavaScript API access."));
    document.head.appendChild(script);
  });

  return window.__group28GoogleMapsLoading;
}

function FallbackMap({ stations, selectedStationId, reason, locationMode, onSelect }: MapViewProps & { reason: string }) {
  return (
    <div className="map-canvas" aria-label="Google Maps-compatible fallback map">
      <div className="map-note">Fallback map: {reason}</div>
      <div className="map-legend" aria-label="Marker legend">
        <span className="legend-available">Available</span>
        <span className="legend-occupied">Occupied</span>
        <span className="legend-offline">Offline</span>
      </div>
      <div className="current-location">{locationMode === "live" ? "Current location" : "Demo origin"}</div>
      {stations.map((station, index) => (
        <button
          key={station.id}
          className={`marker ${availabilityClass(station)} marker-${index} ${station.id === selectedStationId ? "selected" : ""}`}
          onClick={() => onSelect(station.id)}
          title={`${station.name}: ${stationAvailability(station)}`}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

function stationAvailability(station: ChargingStation) {
  if (station.status !== "AVAILABLE") return "Offline";
  if (station.chargers.some((charger) => charger.status === "AVAILABLE")) return "Available";
  if (station.chargers.some((charger) => charger.status === "IN_USE" || charger.status === "RESERVED")) return "Occupied";
  return "Offline";
}

function availabilityClass(station: ChargingStation) {
  return stationAvailability(station).toLowerCase();
}
