/**
 * Nominatim geocoding service (OpenStreetMap).
 *
 * Usage policy: max 1 request/second, must send a meaningful User-Agent.
 */

const USER_AGENT = 'Rodinka/1.0 (family-calendar; contact@example.com)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

let lastCallAt = 0;

async function rateLimit() {
  const now = Date.now();
  const gap = 1100 - (now - lastCallAt);
  if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  lastCallAt = Date.now();
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export const geocodeService = {
  async geocode(address: string): Promise<GeocodeResult | null> {
    if (!address?.trim()) return null;
    try {
      await rateLimit();
      const url = `${NOMINATIM}?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!data.length) return null;
      const first = data[0]!;
      return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), displayName: first.display_name };
    } catch {
      return null;
    }
  },
};
