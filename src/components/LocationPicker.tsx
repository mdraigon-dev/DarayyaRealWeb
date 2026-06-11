import { useEffect, useRef } from 'react';
import type { Lang } from '../i18n/strings';

// Leaflet is loaded via CDN in BaseLayout and exposed globally as `L`.
// Same pattern as DarayyaMap — it needs `window`, so this only runs
// client-side (the editor mounts with client:load).
declare const L: any;

type Props = {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  lang: Lang;
};

// Center of Darayya — the same fallback the number inputs use.
const DEFAULT_LAT = 33.45;
const DEFAULT_LNG = 36.25;

// 5 decimals ≈ 1 m precision, and keeps the number inputs readable
// instead of showing a click's full 14-digit float.
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export default function LocationPicker({ lat, lng, onChange, lang }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Hold the latest onChange so the click/drag handlers (registered once,
  // when the map is created) always call the current callback rather than
  // a stale closure from first render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create the map exactly once. We intentionally don't re-init on lat/lng
  // changes — doing so would reset the user's zoom/pan. External coordinate
  // changes are handled by the sync effect below instead.
  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return;
    if (mapInstance.current) return;

    const startLat = Number.isFinite(lat) ? lat : DEFAULT_LAT;
    const startLng = Number.isFinite(lng) ? lng : DEFAULT_LNG;

    const map = L.map(mapRef.current, {
      center: [startLat, startLng],
      zoom: 15,
      scrollWheelZoom: true,
      zoomControl: true,
    });
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
    markerRef.current = marker;

    // Click anywhere to drop the pin there.
    map.on('click', (e: any) => {
      const la = round5(e.latlng.lat);
      const ln = round5(e.latlng.lng);
      marker.setLatLng([la, ln]);
      onChangeRef.current(la, ln);
    });

    // Or fine-tune by dragging the pin.
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onChangeRef.current(round5(p.lat), round5(p.lng));
    });

    // Leaflet renders gray tiles if the container was sized after init
    // (e.g. fonts/layout settling). Nudge it once on the next tick.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync the marker when lat/lng change from outside this component —
  // i.e. the user typed into the Latitude/Longitude number inputs.
  useEffect(() => {
    const map = mapInstance.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const cur = marker.getLatLng();
    // Skip if the marker is already here. This also stops the click handler
    // (which moves the marker *then* fires onChange) from causing a redundant
    // re-pan when the state round-trips back as props.
    if (Math.abs(cur.lat - lat) < 1e-6 && Math.abs(cur.lng - lng) < 1e-6) return;

    marker.setLatLng([lat, lng]);
    // No animation — typing digit-by-digit shouldn't trigger a pan glide.
    map.panTo([lat, lng], { animate: false });
  }, [lat, lng]);

  return (
    <div className="editor-map">
      <div ref={mapRef} className="editor-map-canvas" />
      <p className="editor-map-hint">
        {lang === 'ar'
          ? 'انقر على الخريطة أو اسحب العلامة لتحديد موقع المشروع. ستُحدَّث القيم تلقائياً.'
          : 'Click the map or drag the pin to set the project location. The values below update automatically.'}
      </p>
    </div>
  );
}
