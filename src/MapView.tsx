import { useEffect, useRef, useState } from "react";
import type { ChargingStation } from "./shared/domain";
import type { Coordinates } from "./shared/geo";
import { loadGoogleMaps } from "./lib/googleMaps";

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
  const directionsRenderer = useRef<any>(null);
  const [loadError, setLoadError] = useState("");
  const [routeSummary, setRouteSummary] = useState<{ distance: string; duration: string } | null>(null);

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
            clickableIcons: false,
            keyboardShortcuts: false,
            gestureHandling: "greedy"
          });
        }

        if (!directionsRenderer.current) {
          directionsRenderer.current = new window.google.maps.DirectionsRenderer({
            map: mapInstance.current,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: "#1f6feb",
              strokeOpacity: 0.85,
              strokeWeight: 5
            }
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

  useEffect(() => {
    if (!apiKey) return;
    const station = stations.find((s) => s.id === selectedStationId);
    if (!station || !window.google?.maps || !directionsRenderer.current) return;
    const service = new window.google.maps.DirectionsService();
    let cancelled = false;
    service.route(
      {
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: station.latitude, lng: station.longitude },
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result: any, status: any) => {
        if (cancelled) return;
        if (status === "OK" && result) {
          directionsRenderer.current.setDirections(result);
          const leg = result.routes?.[0]?.legs?.[0];
          if (leg?.distance?.text && leg?.duration?.text) {
            setRouteSummary({ distance: leg.distance.text, duration: leg.duration.text });
          } else {
            setRouteSummary(null);
          }
        } else {
          setRouteSummary(null);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [apiKey, selectedStationId, origin.latitude, origin.longitude, stations]);

  if (!apiKey || loadError) {
    return <FallbackMap stations={stations} selectedStationId={selectedStationId} origin={origin} locationMode={locationMode} onSelect={onSelect} reason={loadError || "Google Maps API key is not configured yet."} />;
  }

  return (
    <div className="real-map-shell">
      <div ref={mapRef} className="real-map" />
      <div className="map-note">Live Google Maps mode</div>
      {routeSummary && (
        <div className="map-route-summary" aria-live="polite">
          <strong>{routeSummary.duration}</strong>
          <span>{routeSummary.distance} by car</span>
        </div>
      )}
      <div className="map-legend" aria-label="Marker legend">
        <span className="legend-available">Available</span>
        <span className="legend-occupied">Occupied</span>
        <span className="legend-offline">Offline</span>
      </div>
    </div>
  );
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
