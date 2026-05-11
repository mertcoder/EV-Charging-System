import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../../lib/googleMaps";

type LatLng = { lat: number; lng: number };

const defaultCenter: LatLng = { lat: 38.432, lng: 27.145 };

interface LocationPickerProps {
  apiKey?: string;
  value: LatLng | null;
  onChange: (value: LatLng) => void;
}

export function LocationPicker({ apiKey, value, onChange }: LocationPickerProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [loadError, setLoadError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!apiKey || !mapEl.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapEl.current || !window.google) return;
        if (mapInstance.current) {
          mapInstance.current.setOptions({ keyboardShortcuts: false, gestureHandling: "greedy", disableDefaultUI: true, zoomControl: true, clickableIcons: false });
          setReady(true);
          return;
        }
        const center = value ?? defaultCenter;
        mapInstance.current = new window.google.maps.Map(mapEl.current, {
          center,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          keyboardShortcuts: false,
          gestureHandling: "greedy",
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          rotateControl: false,
          scaleControl: false
        });
        mapInstance.current.setOptions({ keyboardShortcuts: false });
        markerInstance.current = new window.google.maps.Marker({
          map: mapInstance.current,
          position: center,
          draggable: true,
          title: "Drag to refine the station location",
          animation: window.google.maps.Animation.DROP
        });
        mapInstance.current.addListener("click", (event: any) => {
          if (!event?.latLng) return;
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          if (markerInstance.current) markerInstance.current.setPosition({ lat, lng });
          onChangeRef.current({ lat, lng });
        });
        markerInstance.current.addListener("dragend", (event: any) => {
          if (!event?.latLng) return;
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          onChangeRef.current({ lat, lng });
        });
        // Belt-and-braces: re-apply keyboard-shortcut suppression after first render and on resize
        const enforceOptions = () => {
          mapInstance.current?.setOptions({ keyboardShortcuts: false, disableDefaultUI: true, zoomControl: true });
          if (mapEl.current) {
            mapEl.current.querySelectorAll<HTMLElement>('[aria-label*="Keyboard shortcuts" i], [title*="Keyboard shortcuts" i]').forEach((el) => {
              el.style.display = "none";
            });
          }
        };
        enforceOptions();
        setTimeout(enforceOptions, 500);
        setTimeout(enforceOptions, 1500);
        mapInstance.current.addListener("idle", enforceOptions);
        mapInstance.current.addListener("tilesloaded", enforceOptions);
        setReady(true);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : String(error)));

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !markerInstance.current || !value) return;
    const current = markerInstance.current.getPosition?.();
    if (current && Math.abs(current.lat() - value.lat) < 1e-7 && Math.abs(current.lng() - value.lng) < 1e-7) return;
    markerInstance.current.setPosition(value);
    mapInstance.current?.panTo(value);
  }, [ready, value?.lat, value?.lng]);

  if (!apiKey || loadError) {
    return <FallbackPicker value={value} onChange={onChange} reason={loadError || "Google Maps API key is not configured."} />;
  }

  return (
    <div className="location-picker">
      <div ref={mapEl} className="location-picker-map" />
      <small className="location-picker-hint">Click anywhere on the map or drag the pin to set the station location.</small>
    </div>
  );
}

function FallbackPicker({ value, onChange, reason }: { value: LatLng | null; onChange: (v: LatLng) => void; reason: string }) {
  const minLat = 38.30;
  const maxLat = 38.55;
  const minLng = 26.95;
  const maxLng = 27.35;

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const lng = minLng + x * (maxLng - minLng);
    const lat = maxLat - y * (maxLat - minLat);
    onChange({ lat, lng });
  }

  const pinX = value ? ((value.lng - minLng) / (maxLng - minLng)) * 100 : 50;
  const pinY = value ? ((maxLat - value.lat) / (maxLat - minLat)) * 100 : 50;

  return (
    <div className="location-picker">
      <div className="location-picker-fallback" onClick={handleClick} role="button" tabIndex={0}>
        <span className="fallback-pin" style={{ left: `${pinX}%`, top: `${pinY}%` }} aria-hidden />
        <span className="fallback-note">Click anywhere to place the station</span>
      </div>
      <small className="map-note">Map unavailable ({reason}). Coordinates are approximated within Izmir.</small>
    </div>
  );
}
