/**
 * LocationMap — small read-only Leaflet map showing a single pin.
 * Used on EventDetailPage when locationLat/locationLng are present.
 */
import React, { useEffect, useRef } from 'react';

interface Props {
  lat: number;
  lng: number;
  label?: string;
}

export default function LocationMap({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default icon path in bundled environments
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, label]);

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div ref={containerRef} style={{ height: 220 }} />
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

// ─── Draggable marker for EventForm ───────────────────────────────────────────

interface PickerProps {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
  label?: string;
}

export function LocationMapPicker({ lat, lng, onMove, label }: PickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, { zoomControl: true, scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      if (label) marker.bindPopup(label);
      markerRef.current = marker;
      map.setView([lat, lng], 15);

      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        onMove(pos.lat, pos.lng);
      });
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  }, []); // intentional: only run once on mount

  // Update marker position if parent changes lat/lng (e.g. after geocoding)
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current?.setView([lat, lng], mapRef.current.getZoom());
    }
  }, [lat, lng]);

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      <div ref={containerRef} style={{ height: 220 }} />
      <p className="text-[10px] text-ink-muted text-center py-1.5 border-t border-border">
        📍 Přetáhněte špendlík pro přesnější umístění
      </p>
    </div>
  );
}
