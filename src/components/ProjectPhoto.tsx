import { t, type Lang } from '../i18n/strings';

type SceneType = 'road' | 'water' | 'sewer' | 'light' | 'internet' | 'building' | 'park';
type Status = 'healthy' | 'warning' | 'stalled' | 'completed';

type Props = {
  scene?: SceneType;
  src?: string; // if an uploaded image exists, prefer it
  status: Status;
  caption: string;
  date: string;
  lang: Lang;
};

const TINTS: Record<Status, { sky1: string; sky2: string; ground: string; mood: string }> = {
  healthy:   { sky1: '#A8D8B9', sky2: '#7AC495', ground: '#C7B58A', mood: '#FFEFB8' },
  warning:   { sky1: '#E6D4A8', sky2: '#D8B973', ground: '#C9A86F', mood: '#F5C56E' },
  stalled:   { sky1: '#C8A5A0', sky2: '#A8716A', ground: '#9A8270', mood: '#E8907A' },
  completed: { sky1: '#B8C5BE', sky2: '#8FA39A', ground: '#A8A095', mood: '#D8D2C0' },
};

export default function ProjectPhoto({ scene, src, status, caption, date, lang }: Props) {
  // Prefer uploaded image if provided
  if (src) {
    return (
      <div className="photo-card">
        <span className={`photo-status-badge ${status}`}>{t(lang, `photo_status_${status}` as any)}</span>
        <img className="photo-scene" src={src} alt={caption} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
        <div className="photo-meta">
          <div className="photo-caption">{caption}</div>
          <div className="photo-date">
            <span>{date}</span>
            <span style={{ color: 'var(--sy-gold)', fontWeight: 600 }}>{t(lang, 'photo_caption_credit')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, generated scene
  const sceneKey = scene || 'building';
  const tint = TINTS[status];

  return (
    <div className="photo-card">
      <span className={`photo-status-badge ${status}`}>{t(lang, `photo_status_${status}` as any)}</span>
      <svg className="photo-scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`sky-${sceneKey}-${status}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tint.sky1} />
            <stop offset="100%" stopColor={tint.sky2} />
          </linearGradient>
        </defs>
        <rect width="320" height="120" fill={`url(#sky-${sceneKey}-${status})`} />
        <circle cx="260" cy="40" r="22" fill={tint.mood} opacity="0.7" />
        <circle cx="260" cy="40" r="14" fill={tint.mood} />
        <path d="M 0 80 L 40 55 L 70 70 L 110 45 L 150 65 L 200 50 L 250 70 L 320 60 L 320 120 L 0 120 Z" fill="rgba(0, 88, 44, 0.18)" />
        <path d="M 0 95 L 50 75 L 100 90 L 160 72 L 220 88 L 280 78 L 320 85 L 320 120 L 0 120 Z" fill="rgba(0, 88, 44, 0.3)" />
        <rect x="0" y="120" width="320" height="60" fill={tint.ground} />

        {sceneKey === 'road' && <RoadScene status={status} />}
        {sceneKey === 'water' && <WaterScene status={status} />}
        {sceneKey === 'sewer' && <SewerScene status={status} />}
        {sceneKey === 'light' && <LightScene status={status} />}
        {sceneKey === 'internet' && <InternetScene status={status} />}
        {sceneKey === 'building' && <BuildingScene status={status} />}
        {sceneKey === 'park' && <ParkScene status={status} />}
      </svg>
      <div className="photo-meta">
        <div className="photo-caption">{caption}</div>
        <div className="photo-date">
          <span>{date}</span>
          <span style={{ color: 'var(--sy-gold)', fontWeight: 600 }}>{t(lang, 'photo_caption_credit')}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Scene sub-components — abstract illustrative SVG
// (Ported from the demo verbatim)
// ============================================================

function RoadScene({ status }: { status: Status }) {
  const stalled = status === 'stalled';
  return (
    <g>
      <path d="M 60 180 L 130 120 L 190 120 L 260 180 Z" fill={stalled ? '#5C3E2E' : '#3A3A3A'} />
      {stalled && (
        <>
          <ellipse cx="160" cy="155" rx="14" ry="4" fill="#2A1A12" />
          <ellipse cx="190" cy="170" rx="10" ry="3" fill="#2A1A12" />
          <ellipse cx="120" cy="170" rx="8" ry="3" fill="#2A1A12" />
        </>
      )}
      {!stalled && <path d="M 158 125 L 152 145 M 154 155 L 148 175" stroke="#F0E0B0" strokeWidth="2" strokeDasharray="6 4" />}
      {status === 'healthy' && (
        <>
          <rect x="195" y="105" width="30" height="14" fill="#C9A14A" rx="2" />
          <circle cx="201" cy="120" r="5" fill="#2A2A2A" />
          <circle cx="220" cy="120" r="5" fill="#2A2A2A" />
          <rect x="208" y="98" width="9" height="8" fill="#888" />
        </>
      )}
      {status === 'warning' && (
        <>
          <polygon points="100,125 105,108 110,125" fill="#D8702A" />
          <polygon points="220,125 225,108 230,125" fill="#D8702A" />
        </>
      )}
      {stalled && (
        <>
          <line x1="70" y1="125" x2="250" y2="125" stroke="#D8702A" strokeWidth="2" strokeDasharray="8 4" />
          <rect x="80" y="115" width="6" height="12" fill="#CE1126" />
        </>
      )}
    </g>
  );
}

function WaterScene({ status }: { status: Status }) {
  const flowing = status === 'healthy';
  return (
    <g>
      <rect x="40" y="130" width="240" height="14" fill="#5A6B7A" rx="2" />
      <rect x="40" y="130" width="240" height="4" fill="#7A8C9B" />
      <rect x="120" y="126" width="12" height="22" fill="#3A4A5A" rx="1" />
      <rect x="200" y="126" width="12" height="22" fill="#3A4A5A" rx="1" />
      <ellipse cx="245" cy="100" rx="35" ry="8" fill={status === 'stalled' ? '#888' : '#4A8FCB'} />
      <rect x="210" y="100" width="70" height="32" fill={status === 'stalled' ? '#888' : '#5BA0DC'} />
      <ellipse cx="245" cy="132" rx="35" ry="8" fill={status === 'stalled' ? '#666' : '#3A7FBB'} />
      <text x="245" y="118" fontSize="11" textAnchor="middle" fill="#fff" fontWeight="700">H₂O</text>
      {flowing && (
        <>
          <circle cx="170" cy="138" r="2" fill="#5BA0DC" />
          <circle cx="180" cy="142" r="1.5" fill="#5BA0DC" />
          <rect x="65" y="115" width="14" height="14" fill="#C9A14A" rx="1" />
          <rect x="65" y="115" width="14" height="3" fill="#8B6F1F" />
        </>
      )}
      {status === 'stalled' && (
        <>
          <path d="M 150 145 L 145 165 M 153 145 L 150 167 M 156 145 L 158 165" stroke="#5BA0DC" strokeWidth="1.5" opacity="0.8" />
          <ellipse cx="151" cy="172" rx="14" ry="2" fill="#3A7FBB" opacity="0.6" />
        </>
      )}
      {status === 'warning' && <rect x="100" y="115" width="14" height="14" fill="#9A9A9A" rx="1" />}
    </g>
  );
}

function SewerScene({ status }: { status: Status }) {
  return (
    <g>
      <path d="M 30 130 L 50 165 L 270 165 L 290 130 Z" fill="#5C4A33" />
      <path d="M 50 165 L 270 165" stroke="#3A2A18" strokeWidth="2" />
      {status !== 'stalled' && <ellipse cx="160" cy="160" rx="100" ry="6" fill={status === 'healthy' ? '#3A3A3A' : '#5A5A5A'} />}
      <circle cx="80" cy="128" r="9" fill="#3A3A3A" />
      <circle cx="80" cy="128" r="7" fill="#5A5A5A" />
      <circle cx="240" cy="128" r="9" fill="#3A3A3A" />
      <circle cx="240" cy="128" r="7" fill="#5A5A5A" />
      {status === 'healthy' && (
        <>
          <circle cx="160" cy="115" r="5" fill="#C9A14A" />
          <rect x="156" y="120" width="8" height="14" fill="#007A3D" rx="1" />
          <rect x="154" y="134" width="3" height="8" fill="#3A3A3A" />
          <rect x="163" y="134" width="3" height="8" fill="#3A3A3A" />
          <path d="M 155 113 Q 160 108 165 113" fill="#FFEFB8" />
        </>
      )}
      {status === 'warning' && <rect x="140" y="115" width="40" height="6" fill="#D8702A" />}
    </g>
  );
}

function LightScene({ status }: { status: Status }) {
  const lit = status === 'healthy';
  const poleColor = status === 'stalled' ? '#5A5A5A' : '#3A3A3A';
  return (
    <g>
      {[80, 160, 240].map((x, i) => (
        <g key={i}>
          <rect x={x - 1.5} y="60" width="3" height="65" fill={poleColor} />
          <rect x={x - 8} y="55" width="16" height="6" fill={poleColor} rx="1" />
          {lit && (
            <>
              <circle cx={x} cy="63" r="14" fill="#FFEFB8" opacity="0.5" />
              <circle cx={x} cy="63" r="7" fill="#FFF6D0" />
            </>
          )}
          {!lit && status === 'warning' && i !== 1 && (
            <>
              <circle cx={x} cy="63" r="10" fill="#FFEFB8" opacity="0.3" />
              <circle cx={x} cy="63" r="5" fill="#E8D08F" />
            </>
          )}
        </g>
      ))}
      <rect x="0" y="125" width="320" height="55" fill="#4A4A4A" />
      <path d="M 30 152 L 60 152 M 100 152 L 130 152 M 170 152 L 200 152 M 240 152 L 270 152" stroke="#F0E0B0" strokeWidth="2" />
      {lit && (
        <>
          <circle cx="120" cy="138" r="3" fill="#3A3A3A" />
          <rect x="118" y="141" width="4" height="8" fill="#007A3D" />
          <circle cx="200" cy="140" r="3" fill="#3A3A3A" />
          <rect x="198" y="143" width="4" height="7" fill="#C9A14A" />
        </>
      )}
    </g>
  );
}

function InternetScene({ status }: { status: Status }) {
  const working = status === 'healthy' || status === 'completed';
  return (
    <g>
      <polygon points="160,40 152,130 168,130" fill={status === 'stalled' ? '#888' : '#5A6B7A'} />
      <polygon points="160,40 155,130 165,130" fill={status === 'stalled' ? '#A0A0A0' : '#7A8C9B'} />
      <line x1="153" y1="60" x2="167" y2="80" stroke={status === 'stalled' ? '#666' : '#3A4A5A'} strokeWidth="1" />
      <line x1="167" y1="60" x2="153" y2="80" stroke={status === 'stalled' ? '#666' : '#3A4A5A'} strokeWidth="1" />
      <line x1="153" y1="90" x2="167" y2="110" stroke={status === 'stalled' ? '#666' : '#3A4A5A'} strokeWidth="1" />
      <line x1="167" y1="90" x2="153" y2="110" stroke={status === 'stalled' ? '#666' : '#3A4A5A'} strokeWidth="1" />
      <ellipse cx="155" cy="75" rx="6" ry="3" fill={working ? '#C9A14A' : '#888'} />
      <ellipse cx="165" cy="55" rx="5" ry="3" fill={working ? '#C9A14A' : '#888'} />
      {working && (
        <>
          <path d="M 180 50 Q 195 50 195 65" fill="none" stroke="#007A3D" strokeWidth="1.5" opacity="0.8" />
          <path d="M 180 50 Q 205 50 205 75" fill="none" stroke="#007A3D" strokeWidth="1.5" opacity="0.5" />
          <path d="M 180 50 Q 215 50 215 85" fill="none" stroke="#007A3D" strokeWidth="1.5" opacity="0.3" />
          <path d="M 140 50 Q 125 50 125 65" fill="none" stroke="#007A3D" strokeWidth="1.5" opacity="0.8" />
          <path d="M 140 50 Q 115 50 115 75" fill="none" stroke="#007A3D" strokeWidth="1.5" opacity="0.5" />
          <path d="M 140 50 Q 105 50 105 85" fill="none" stroke="#007A3D" strokeWidth="1.5" opacity="0.3" />
        </>
      )}
      <circle cx="160" cy="40" r="3" fill={working ? '#CE1126' : '#888'} />
      <rect x="40" y="105" width="40" height="25" fill="#C9A14A" />
      <polygon points="40,105 60,90 80,105" fill="#8B6F1F" />
      <rect x="55" y="115" width="10" height="15" fill="#3A3A3A" />
    </g>
  );
}

function BuildingScene({ status }: { status: Status }) {
  const completed = status === 'completed';
  return (
    <g>
      <rect x="60" y="60" width="200" height="70" fill={completed ? '#E8D5A8' : status === 'warning' ? '#C9A98E' : '#A89788'} />
      <polygon points="60,60 160,30 260,60" fill={completed ? '#8B6F1F' : '#6A553A'} />
      <rect x="80" y="75" width="14" height="14" fill={completed ? '#7AC4DC' : '#444'} />
      <rect x="105" y="75" width="14" height="14" fill={completed ? '#7AC4DC' : '#444'} />
      <rect x="130" y="75" width="14" height="14" fill={completed ? '#7AC4DC' : '#444'} />
      <rect x="180" y="75" width="14" height="14" fill={completed ? '#7AC4DC' : '#444'} />
      <rect x="205" y="75" width="14" height="14" fill={completed ? '#7AC4DC' : '#444'} />
      <rect x="230" y="75" width="14" height="14" fill={completed ? '#7AC4DC' : '#444'} />
      <rect x="153" y="100" width="14" height="30" fill={completed ? '#5A3A1A' : '#3A2A1A'} />
      {status === 'healthy' && !completed && (
        <>
          <line x1="75" y1="60" x2="75" y2="130" stroke="#C9A14A" strokeWidth="1.5" />
          <line x1="75" y1="80" x2="100" y2="80" stroke="#C9A14A" strokeWidth="1.5" />
          <line x1="75" y1="100" x2="100" y2="100" stroke="#C9A14A" strokeWidth="1.5" />
          <line x1="100" y1="60" x2="100" y2="130" stroke="#C9A14A" strokeWidth="1.5" />
        </>
      )}
      {status === 'warning' && (
        <>
          <rect x="78" y="73" width="18" height="18" fill="#888" opacity="0.7" />
          <rect x="203" y="73" width="18" height="18" fill="#888" opacity="0.7" />
        </>
      )}
      {completed && (
        <>
          <line x1="160" y1="30" x2="160" y2="18" stroke="#3A3A3A" strokeWidth="1.5" />
          <polygon points="160,18 175,22 160,26" fill="#007A3D" />
        </>
      )}
    </g>
  );
}

function ParkScene({ status }: { status: Status }) {
  const healthy = status === 'healthy';
  return (
    <g>
      <rect x="0" y="118" width="320" height="62" fill={healthy ? '#5BA065' : '#9A8B6A'} />
      <rect x="0" y="118" width="320" height="3" fill={healthy ? '#7BC485' : '#B8A985'} />
      {[50, 110, 220, 280].map((x, i) => (
        <g key={i}>
          <rect x={x - 2} y="100" width="4" height="22" fill="#6A4A2A" />
          <circle cx={x} cy="92" r={healthy ? 14 : 9} fill={healthy ? '#3A8B45' : '#7A7A4A'} />
          {healthy && <circle cx={x - 4} cy={88} r="9" fill="#4AA055" />}
          {healthy && <circle cx={x + 4} cy={88} r="9" fill="#4AA055" />}
        </g>
      ))}
      <rect x="140" y="135" width="40" height="3" fill="#6A4A2A" />
      <rect x="143" y="138" width="3" height="10" fill="#6A4A2A" />
      <rect x="174" y="138" width="3" height="10" fill="#6A4A2A" />
      <rect x="140" y="128" width="40" height="2" fill="#6A4A2A" />
      {healthy && (
        <>
          <rect x="240" y="125" width="3" height="18" fill="#CE1126" />
          <rect x="258" y="125" width="3" height="18" fill="#CE1126" />
          <path d="M 240 130 Q 250 122 260 130" stroke="#C9A14A" strokeWidth="2" fill="none" />
          <circle cx="160" cy="130" r="3" fill="#3A3A3A" />
          <rect x="158" y="133" width="4" height="6" fill="#CE1126" />
        </>
      )}
      <path d="M 0 145 L 320 142" stroke="#D8C9A0" strokeWidth="4" fill="none" />
    </g>
  );
}
