export interface Coordinates {
  latitude: number;
  longitude: number;
}

const earthRadiusKm = 6371;

export const demoOrigin: Coordinates = {
  latitude: 38.432,
  longitude: 27.145
};

export function haversineDistanceKm(origin: Coordinates, destination: Coordinates) {
  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLon = toRadians(destination.longitude - origin.longitude);
  const originLat = toRadians(origin.latitude);
  const destinationLat = toRadians(destination.latitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
