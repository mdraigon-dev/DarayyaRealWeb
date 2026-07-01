import { useEffect, useRef } from 'react';
import { loc, type Lang } from '../i18n/strings';

// Leaflet is loaded via CDN in BaseLayout and exposed globally as `L`.
// This mirrors DarayyaMap / LocationPicker; it needs `window`, so it only
// runs client-side (the parent ProjectDetailContent mounts with client:load).
declare const L: any;

type Bilingual = { ar: string; en: string };

type Props = {
  lat: number;
  lng: number;
  health: 'healthy' | 'warning' | 'stalled' | 'completed';
  title: Bilingual;
  location: Bilingual;
  lang: Lang;
};

// Center of Darayya — the same fallback the schema and picker use.
const DEFAULT_LAT = 33.45;
const DEFAULT_LNG = 36.25;

/**
 * A small, read-only map for a single project's detail page: one marker at the
 * project's coordinates, styled the same as the all-projects map so the pin
 * colour still reads as the project's health. Panning/zoom work, but the wheel
 * is disabled so scrolling the page doesn't get captured by the map.
 */
export default function ProjectLocationMap({ lat, lng, health, title, location, lang }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return;
    if (mapInstance.current) return;

    const la = Number.isFinite(lat) ? lat : DEFAULT_LAT;
    const ln = Number.isFinite(lng) ? lng : DEFAULT_LNG;

    const map = L.map(mapRef.current, {
      center: [la, ln],
      zoom: 15,
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Same health-coloured pin used on the overview map.
    const icon = L.divIcon({
      className: 'darayya-marker',
      html: `<div class="darayya-marker-inner ${health}"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const marker = L.marker([la, ln], { icon }).addTo(map);

    const popupHtml = `
      <div class="popup-content">
        <div class="popup-title">${loc(lang, title)}</div>
        <div class="popup-meta"><span>${loc(lang, location)}</span></div>
      </div>`;
    marker.bindPopup(popupHtml, { maxWidth: 260, closeButton: true });

    // Leaflet renders gray tiles if the container sized after init; nudge once.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="detail-map">
      <div ref={mapRef} className="detail-map-canvas" />
    </div>
  );
}
