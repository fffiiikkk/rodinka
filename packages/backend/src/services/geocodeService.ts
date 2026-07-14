/**
 * Nominatim geocoding service (OpenStreetMap).
 *
 * Usage policy: max 1 request/second, must send a meaningful User-Agent.
 */
import { logger } from '../logger.js';

const USER_AGENT = 'Rodinka/1.0 (family-calendar; krataf.dev)';
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

export type GeocodeOutcome =
  | { ok: true; result: GeocodeResult }
  | { ok: false; reason: 'not_found' | 'error'; message: string };

export const geocodeService = {
  async geocode(address: string): Promise<GeocodeResult | null> {
    const outcome = await geocodeService.geocodeWithReason(address);
    if (outcome.ok) return outcome.result;
    return null;
  },

  async geocodeWithReason(address: string): Promise<GeocodeOutcome> {
    if (!address?.trim()) {
      return { ok: false, reason: 'error', message: 'Address is empty' };
    }
    try {
      await rateLimit();
      const url = `${NOMINATIM}?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1&accept-language=cs,en`;
      logger.info({ url, address }, 'Geocoding address');

      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'cs,en',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const msg = `Nominatim HTTP ${res.status}`;
        logger.warn({ status: res.status, address }, msg);
        return { ok: false, reason: 'error', message: msg };
      }

      const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      logger.info({ count: data.length, address }, 'Nominatim returned results');

      if (!data.length) {
        return { ok: false, reason: 'not_found', message: `No results for "${address}"` };
      }

      const first = data[0]!;
      return {
        ok: true,
        result: {
          lat: parseFloat(first.lat),
          lng: parseFloat(first.lon),
          displayName: first.display_name,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, address }, `Geocoding error: ${message}`);
      return { ok: false, reason: 'error', message };
    }
  },
};
