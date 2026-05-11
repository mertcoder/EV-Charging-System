declare global {
  interface Window {
    google?: any;
    __group28GoogleMapsLoading?: Promise<void>;
  }
}

export function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Window unavailable"));
  if (window.google?.maps) return Promise.resolve();
  if (window.__group28GoogleMapsLoading) return window.__group28GoogleMapsLoading;

  window.__group28GoogleMapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=en&region=US`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script could not be loaded. Check the API key and Maps JavaScript API access."));
    document.head.appendChild(script);
  });

  return window.__group28GoogleMapsLoading;
}
