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
  onReserveClick?: (stationId: string) => void;
}

function shortenName(name: string, max = 22) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function createStationMarkerIcon(name: string, color: string, selected: boolean) {
  const radius = selected ? 11 : 9;
  const label = shortenName(name);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='46' viewBox='0 0 160 46'>` +
    `<text x='80' y='42' font-family='Inter, system-ui, sans-serif' font-size='11' font-weight='700' fill='#1F1C17' stroke='#FAF7F0' stroke-width='3' paint-order='stroke' text-anchor='middle'>${label}</text>` +
    `<circle cx='80' cy='15' r='${radius}' fill='${color}' stroke='#FFFFFF' stroke-width='3'/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function infoWindowContent(name: string, availability: string, stationId: string) {
  const color = statusColors[availability] ?? "#6F675C";
  return (
    `<div class="map-info-card" style="font-family:inherit;min-width:172px;padding:4px 2px;">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">` +
        `<span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>` +
        `<strong style="font-size:0.95rem;color:#1F1C17;letter-spacing:-0.01em;">${name}</strong>` +
      `</div>` +
      `<div style="color:#6F675C;font-size:0.78rem;margin-bottom:8px;">Status: ${availability}</div>` +
      `<button data-station-id="${stationId}" class="map-info-reserve" ` +
        `style="appearance:none;border:0;border-radius:999px;padding:6px 14px;background:#1F1C17;color:#FAF7F0;font-weight:700;font-size:0.78rem;cursor:pointer;font-family:inherit;">` +
        `Reserve here</button>` +
    `</div>`
  );
}

export function MapView({ stations, selectedStationId, apiKey, origin, locationMode, onSelect, onReserveClick }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const infoWindow = useRef<any>(null);
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

        if (!infoWindow.current) {
          infoWindow.current = new window.google.maps.InfoWindow({ disableAutoPan: false });
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
            const selected = station.id === selectedStationId;
            const iconUrl = createStationMarkerIcon(station.name, statusColors[availability], selected);
            const marker = new window.google.maps.Marker({
              map: mapInstance.current,
              position: { lat: station.latitude, lng: station.longitude },
              title: `${station.name} - ${availability}`,
              icon: {
                url: iconUrl,
                anchor: new window.google.maps.Point(80, 15),
                scaledSize: new window.google.maps.Size(160, 46)
              }
            });
            marker.addListener("click", () => {
              onSelect(station.id);
              if (infoWindow.current) {
                infoWindow.current.setContent(infoWindowContent(station.name, availability, station.id));
                infoWindow.current.open(mapInstance.current, marker);
                window.google.maps.event.addListenerOnce(infoWindow.current, "domready", () => {
                  const btn = document.querySelector(`.map-info-reserve[data-station-id="${station.id}"]`) as HTMLButtonElement | null;
                  if (btn && onReserveClick) {
                    btn.onclick = () => {
                      infoWindow.current?.close();
                      onReserveClick(station.id);
                    };
                  }
                });
              }
            });
            return marker;
          })
        ];
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));

    return () => {
      cancelled = true;
    };
  }, [apiKey, stations, selectedStationId, origin.latitude, origin.longitude, locationMode, onSelect, onReserveClick]);

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
    return (
      <FallbackMap
        stations={stations}
        selectedStationId={selectedStationId}
        origin={origin}
        locationMode={locationMode}
        onSelect={onSelect}
        onReserveClick={onReserveClick}
        reason={loadError || "Google Maps API key is not configured yet."}
      />
    );
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

function FallbackMap({ stations, selectedStationId, reason, locationMode, onSelect, onReserveClick }: MapViewProps & { reason: string }) {
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
        <div
          key={station.id}
          className={`fallback-marker-wrap marker-${index} ${station.id === selectedStationId ? "selected" : ""}`}
        >
          <button
            className={`marker ${availabilityClass(station)}`}
            onClick={() => {
              onSelect(station.id);
              if (onReserveClick) onReserveClick(station.id);
            }}
            title={`${station.name}: ${stationAvailability(station)}`}
          >
            {index + 1}
          </button>
          <span className="fallback-marker-label">{shortenName(station.name, 18)}</span>
        </div>
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
