import { useState, useMemo, useEffect } from 'react';
import { t, loc, fmtNum, type Lang } from '../i18n/strings';
import { can, type AuthUser } from '../data/permissions';
import CircularUploader from './CircularUploader';
import AdminDeleteButton from './AdminDeleteButton';
import { deleteDocument } from '../data/documents';
import { formatAbsolute } from '../data/time';
import { commitName } from '../data/admin-prefs';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Bilingual = { ar: string; en: string };
export type Circular = {
  id: string;
  title: Bilingual;
  description?: Bilingual;
  category: 'decision' | 'announcement' | 'report' | 'policy' | 'minutes' | 'other';
  date: string;       // YYYY-MM-DD
  file: string;       // public path
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  order: number;
  /** When it was published on the site */
  at?: string;
  /** Metadata file name — needed to delete it */
  source?: string;
};

type Props = {
  lang: Lang;
  basePath: string;
  circulars: Circular[];
};

const CATEGORIES: Array<{ key: Circular['category'] | 'all'; iconText: string }> = [
  { key: 'all',          iconText: '📚' },
  { key: 'decision',     iconText: '⚖️' },
  { key: 'announcement', iconText: '📢' },
  { key: 'report',       iconText: '📊' },
  { key: 'policy',       iconText: '📜' },
  { key: 'minutes',      iconText: '📝' },
  { key: 'other',        iconText: '📄' },
];

/**
 * Format a byte count into a human-readable size string ("1.4 MB", "523 KB").
 * Used in the file metadata strip under each circular.
 */
export function formatFileSize(bytes: number, lang: Lang): string {
  if (!bytes || bytes <= 0) return '';
  const KB = 1024;
  const MB = KB * 1024;
  if (bytes < KB) return `${fmtNum(lang, bytes)} B`;
  if (bytes < MB) return `${fmtNum(lang, Math.round(bytes / KB))} KB`;
  return `${fmtNum(lang, Math.round((bytes / MB) * 10) / 10)} MB`;
}

/**
 * Format an ISO date string into a locale-friendly display date.
 * Falls back to the raw string on parse failure.
 */
function formatDate(iso: string, lang: Lang): string {
  return iso ? formatAbsolute(iso, lang) : '';
}

/**
 * Whether a file's MIME type can be previewed inline (PDF or image).
 * Other types (Word, Excel, etc.) just get a Download button.
 */
function isPreviewable(fileType: string): boolean {
  if (!fileType) return false;
  if (fileType === 'application/pdf') return true;
  if (fileType.startsWith('image/')) return true;
  return false;
}

export default function CircularsContent({ lang, basePath, circulars: rawCirculars }: Props) {
  const [catKey, setCatKey] = useState<Circular['category'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploader, setShowUploader] = useState(false);

  // Auth state — used to show the "Upload" button for admins only
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni) {
        tries++;
        if (tries < 40) setTimeout(init, 100);
        else setAuthUser(null);
        return;
      }
      try { ni.init(); } catch {}
      setAuthUser(ni.currentUser() || null);
      ni.on('login', (u: any) => setAuthUser(u));
      ni.on('logout', () => setAuthUser(null));
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const canUpload = can(authUser, 'upload-documents');
  const canDelete = can(authUser, 'delete-documents');

  // Documents deleted this session are hidden immediately; the rebuild
  // removes them for everyone.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);
  const removeDoc = async (c: Circular) => {
    await deleteDocument({
      source: c.source || `${c.id}.md`,
      file: c.file,
      message: `Delete document ${c.id} by ${commitName(authUser)}`,
    });
    setDeletedIds((d) => new Set(d).add(c.id));
    setToast(true);
    setTimeout(() => setToast(false), 5000);
  };
  const liveCirculars = useMemo(() => rawCirculars.filter((c) => !deletedIds.has(c.id)), [rawCirculars, deletedIds]);

  // Sort: pinned (order > 0) first, then newest by date.
  const sorted = useMemo(() => {
    return [...liveCirculars].sort((a, b) => {
      if (a.order !== b.order) return b.order - a.order;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [liveCirculars]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sorted.filter(c => {
      if (catKey !== 'all' && c.category !== catKey) return false;
      if (q) {
        const hay = `${loc(lang, c.title)} ${loc(lang, c.description)} ${c.uploadedBy}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, catKey, searchQuery, lang]);

  // Per-category counts for the filter chips
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: liveCirculars.length };
    for (const c of liveCirculars) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
    return counts;
  }, [liveCirculars]);

  return (
    <section className="section circulars-section">
      <div className="circulars-hero">
        <div className="section-header">
          <div className="section-eyebrow">{t(lang, 'circ_subtitle')}</div>
          <h1 className="section-title">{t(lang, 'circ_title')}</h1>
          <p className="section-desc">{t(lang, 'circ_desc')}</p>
        </div>

        {/* Admin-only Upload button. Hidden until Identity hydrates. */}
        {canUpload && !showUploader && (
          <button
            type="button"
            className="btn-primary circulars-upload-btn"
            onClick={() => setShowUploader(true)}
          >
            {t(lang, 'circ_upload_btn')}
          </button>
        )}
      </div>

      {/* Upload form (admin only, toggled by the button above) */}
      {canUpload && showUploader && (
        <CircularUploader
          lang={lang}
          onClose={() => setShowUploader(false)}
        />
      )}

      {/* Filter chips + search */}
      <div className="circulars-toolbar">
        <div className="circulars-filters">
          {CATEGORIES.map(c => {
            const n = categoryCounts[c.key] || 0;
            const label = c.key === 'all'
              ? t(lang, 'circ_filter_all')
              : t(lang, `circ_cat_${c.key}` as any);
            return (
              <button
                key={c.key}
                type="button"
                className={`circ-chip ${catKey === c.key ? 'active' : ''}`}
                onClick={() => setCatKey(c.key)}
                disabled={n === 0 && c.key !== 'all'}
              >
                <span className="circ-chip-icon" aria-hidden="true">{c.iconText}</span>
                <span>{label}</span>
                <span className="circ-chip-count">{fmtNum(lang, n)}</span>
              </button>
            );
          })}
        </div>
        <div className="circulars-search">
          <span className="circulars-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            placeholder={lang === 'ar' ? 'ابحث في الوثائق…' : 'Search documents…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Result count */}
      <div className="circulars-count">
        {fmtNum(lang, filtered.length)}{' '}
        {filtered.length === 1 ? t(lang, 'circ_count_one') : t(lang, 'circ_count_other')}
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="circulars-empty">{t(lang, 'circ_no_results')}</div>
      ) : (
        <div className="circulars-grid">
          {filtered.map(c => (
            <CircularCard
              key={c.id}
              circular={c}
              lang={lang}
              basePath={basePath}
              onDelete={canDelete ? () => removeDoc(c) : undefined}
            />
          ))}
        </div>
      )}
      {toast && (
        <div className="admin-toast" role="status">✓ {t(lang, 'activity_deleted_toast')}</div>
      )}
    </section>
  );
}

/**
 * Individual circular card. Shows the title, description, metadata
 * strip (date, uploader, file size), and Download/Preview buttons.
 *
 * For PDFs and images, the Preview button opens the file in a new
 * tab (browser-native rendering). For other file types we show only
 * Download.
 */
function CircularCard({ circular, lang, basePath: _basePath, onDelete }: {
  circular: Circular; lang: Lang; basePath: string;
  /** Present only for admins */
  onDelete?: () => Promise<void>;
}) {
  const category = circular.category;
  const fileUrl = circular.file;
  const previewable = isPreviewable(circular.fileType);

  return (
    <article id={`doc-${circular.id}`} className={`circular-card circular-card-${category}`}>
      <div className="circular-card-head">
        <span className={`circ-category circ-category-${category}`}>
          {t(lang, `circ_cat_${category}` as any)}
        </span>
        <span className="circular-card-date">{formatDate(circular.date, lang)}</span>
        {onDelete && (
          <AdminDeleteButton
            lang={lang}
            what={lang === 'ar' ? 'الوثيقة' : 'document'}
            warning={t(lang, 'activity_del_doc_warning')}
            onConfirm={onDelete}
          />
        )}
      </div>
      <h3 className="circular-card-title">{loc(lang, circular.title)}</h3>
      {loc(lang, circular.description) && (
        <p className="circular-card-desc">{loc(lang, circular.description)}</p>
      )}
      <div className="circular-card-meta">
        {circular.uploadedBy && (
          <span className="circular-card-meta-item">
            {t(lang, 'circ_uploaded_by')}: <strong>{circular.uploadedBy}</strong>
          </span>
        )}
        {circular.fileSize > 0 && (
          <span className="circular-card-meta-item">
            {formatFileSize(circular.fileSize, lang)}
          </span>
        )}
      </div>
      <div className="circular-card-actions">
        <a
          className="btn-circ-download"
          href={fileUrl}
          download
        >
          ↓ {t(lang, 'circ_download')}
        </a>
        {previewable && (
          <a
            className="btn-circ-preview"
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            👁 {t(lang, 'circ_preview')}
          </a>
        )}
      </div>
    </article>
  );
}
