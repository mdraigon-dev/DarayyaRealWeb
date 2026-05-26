import { useEffect, useRef, useState } from 'react';
import { t, loc, fmtNum, type Lang } from '../i18n/strings';
import { loadDonations } from '../data/demo-donations';

// We declare L globally because Leaflet is loaded via CDN in BaseLayout
declare const L: any;

type MapProject = {
  id: string;
  category: string;
  title: { ar: string; en: string };
  lat: number;
  lng: number;
  health: 'healthy' | 'warning' | 'stalled' | 'completed';
  raisedUSD: number;
  budgetUSD: number;
  donors: number;
};

type Props = {
  projects: MapProject[];
  lang: Lang;
  basePath: string; // e.g. "/darayya-platform/ar"
};

export default function DarayyaMap({ projects, lang, basePath }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  // Demo donation totals per project id, populated after mount
  const [demoByProject, setDemoByProject] = useState<Record<string, { amount: number; count: number }>>({});
  useEffect(() => {
    const compute = () => {
      const map: Record<string, { amount: number; count: number }> = {};
      for (const d of loadDonations().donations) {
        if (!map[d.projectId]) map[d.projectId] = { amount: 0, count: 0 };
        map[d.projectId].amount += d.amountUSD;
        map[d.projectId].count += 1;
      }
      setDemoByProject(map);
    };
    compute();
    document.addEventListener('visibilitychange', compute);
    return () => document.removeEventListener('visibilitychange', compute);
  }, []);

  useEffect(() => {
    if (!mapRef.current || typeof L === 'undefined') return;

    // Re-init when language changes so popup text refreshes
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current, {
      center: [33.45, 36.25],
      zoom: 15,
      scrollWheelZoom: false,
      zoomControl: true,
    });
    mapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    projects.forEach(p => {
      if (!p.lat || !p.lng) return;
      const delta = demoByProject[p.id] || { amount: 0, count: 0 };
      const raised = p.raisedUSD + delta.amount;
      const donors = p.donors + delta.count;
      const pct = Math.min(100, Math.round((raised / Math.max(1, p.budgetUSD)) * 100));
      const fillColor: Record<string, string> = {
        healthy: '#007A3D',
        warning: '#C9A14A',
        stalled: '#CE1126',
        completed: '#9A9A9A',
      };

      const icon = L.divIcon({
        className: 'darayya-marker',
        html: `<div class="darayya-marker-inner ${p.health}"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);

      const popupHtml = `
        <div class="popup-content">
          <div class="popup-category">${t(lang, `cat_${p.category}` as any)}</div>
          <div class="popup-title">${loc(lang, p.title)}</div>
          <div class="popup-mini-progress">
            <div class="popup-mini-fill" style="width:${pct}%; background:${fillColor[p.health]};"></div>
          </div>
          <div class="popup-meta">
            <span>${fmtNum(lang, pct)}${t(lang, 'map_popup_funded')}</span>
            <span><strong>${fmtNum(lang, donors)}</strong> ${t(lang, 'map_popup_donor')}</span>
          </div>
          <a class="popup-btn" href="${basePath}/projects/${p.id}/">${t(lang, 'map_popup_view')}</a>
        </div>
      `;
      marker.bindPopup(popupHtml, { maxWidth: 280, closeButton: true });
    });

    const coords = projects.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng]);
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 16 });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [projects, lang, basePath, demoByProject]);

  return (
    <div className="map-frame">
      <div className="map-legend">
        <div className="map-legend-title">{t(lang, 'map_legend_title')}</div>
        <div className="legend-row"><span className="legend-dot healthy"></span> {t(lang, 'health_healthy')}</div>
        <div className="legend-row"><span className="legend-dot warning"></span> {t(lang, 'health_warning')}</div>
        <div className="legend-row"><span className="legend-dot stalled"></span> {t(lang, 'health_stalled')}</div>
        <div className="legend-row"><span className="legend-dot completed"></span> {t(lang, 'health_completed')}</div>
      </div>
      <div ref={mapRef} className="map-container"></div>
    </div>
  );
}
