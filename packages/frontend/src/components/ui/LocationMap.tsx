/**
 * LocationMap — read-only Leaflet map showing a single pin.
 * LocationMapPicker — draggable-marker + click-to-place map for EventForm.
 *
 * Leaflet CSS and marker images are bundled via npm (no CDN → no CSP issues).
 */
import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

// Bundled marker assets (Vite resolves these to hashed URLs)
import markerIcon2x   from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon     from 'leaflet/dist/images/marker-icon.png';
import markerShadow   from 'leaflet/dist/images/marker-shadow.png';

// Prague city centre as default when no coordinates are known
const DEFAULT_LAT = 50.0755;
const DEFAULT_LNG = 14.4378;
const DEFAULT_ZOOM = 13;

function fixLeafletIcons(L: typeof import('leaflet')) {
  // Vite strips the `_getIconUrl` method; restore it with bundled assets
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl:       markerIcon,
    shadowUrl:     markerShadow,
  });
}

// ─── Read-only map ─────────────────────────────────────────────────────────

interface Props {
  lat: number;
  lng: number;
  label?: string;
}

export default function LocationMap({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then((L) => {
      fixLeafletIcons(L);
      const map = L.map(containerRef.current!, { zoomControl: true, scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([lat, lng]).addTo(map);
      if (label) marker.bindPopup(label).openPopup();
      map.setView([lat, lng], 15);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, label]);

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      <div ref={containerRef} style={{ height: 200 }} />
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 py-2 text-xs text-primary font-semibold hover:bg-surface-raised transition-colors border-t border-border"
      >
        🗺️ Otevřít v mapách
      </a>
    </div>
  );
}

// ─── Picker (EventForm) ────────────────────────────────────────────────────

interface PickerProps {
  lat?: number | null;
  lng?: number | null;
  onMove: (lat: number, lng: number) => void;
  label?: string;
}

export function LocationMapPicker({ lat, lng, onMove, label }: PickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markerRef    = useRef<any>(null);

  const initLat = lat ?? DEFAULT_LAT;
  const initLng = lng ?? DEFAULT_LNG;
  const initZoom = lat != null ? 15 : DEFAULT_ZOOM;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then((L) => {
      fixLeafletIcons(L);
      const map = L.map(containerRef.current!, { zoomControl: true, scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
      if (label) marker.bindPopup(label);
      markerRef.current = marker;
      map.setView([initLat, initLng], initZoom);

      // Drag to reposition
      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        onMove(pos.lat, pos.lng);
      });

      // Click on map to reposition marker
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        marker.setLatLng([clickLat, clickLng]);
        onMove(clickLat, clickLng);
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // intentionally run once on mount

  // Sync marker when parent updates coords (e.g. after geocoding)
  useEffect(() => {
    if (markerRef.current && lat != null && lng != null) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current?.setView([lat, lng], mapRef.current.getZoom());
    }
  }, [lat, lng]);

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      <div ref={containerRef} style={{ height: 220 }} />
      <p className="text-[10px] text-ink-muted text-center py-1.5 border-t border-border">
        📍 Klikněte na mapu nebo přetáhněte špendlík pro přesné umístění
      </p>
    </div>
  );
}
