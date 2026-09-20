import { useState, useEffect } from 'react';
import HealthPill from './HealthPill';
import ProjectPhoto from './ProjectPhoto';
import AuthAwareNoteAdder from './AuthAwareNoteAdder';
import AuthAwareUpdateAdder, { type PendingPhoto } from './AuthAwareUpdateAdder';
import AdminEditProjectButton from './AdminEditProjectButton';
import AdminFundUpdater from './AdminFundUpdater';
import ProjectLocationMap from './ProjectLocationMap';
import { pickPhoto } from '../data/unsplash-photos';
import { computeSubRaised, computeProjectRaised, displayStatus, type DemoBreakdown } from '../data/donation-math';
import { t, loc, fmtNum, fmtMoney, type Lang } from '../i18n/strings';

type Bilingual = { ar: string; en: string };
type Sub = {
  id: string;
  title: Bilingual;
  length: Bilingual;
  budgetUSD: number;
  raisedUSD: number;
};
type Update = { date: Bilingual; author: Bilingual; body: Bilingual };
type Photo = {
  src?: string;
  scene?: 'road' | 'water' | 'sewer' | 'light' | 'internet' | 'building' | 'park';
  status: 'healthy' | 'warning' | 'stalled' | 'completed';
  caption: Bilingual;
  date: Bilingual;
};

type Engineer = {
  name: Bilingual;
  role: Bilingual;
  phone?: string;
  email?: string;
};

type Comment = {
  author: Bilingual;
  body: Bilingual;
  date?: string;
};

type ProjectFull = {
  id: string;
  category: string;
  status: 'funding' | 'active' | 'completed' | 'planning';
  health: 'healthy' | 'warning' | 'stalled' | 'completed';
  title: Bilingual;
  location: Bilingual;
  description: Bilingual;
  budgetUSD: number;
  raisedUSD: number;
  donors: number;
  daysLeft: number;
  lat?: number;
  lng?: number;
  subs: Sub[];
  updates: Update[];
  photos: Photo[];
  engineers?: Engineer[];
  comments?: Comment[];
};

type Props = {
  project: ProjectFull;
  lang: Lang;
  basePath: string;
};

export default function ProjectDetailContent({ project, lang, basePath }: Props) {
  const [currency] = useState<'USD' | 'SYP'>('USD');

  // Notes/updates added this session via the inline forms. Shown immediately
  // so staff don't have to wait for the Netlify rebuild to see them. These
  // live only in memory — a reload (after the rebuild lands) replaces them
  // with the real, build-rendered items.
  const [extraUpdates, setExtraUpdates] = useState<Update[]>([]);
  const [extraComments, setExtraComments] = useState<Comment[]>([]);
  const [extraPhotos, setExtraPhotos] = useState<PendingPhoto[]>([]);

  // Live funding figures. Seeded from the built-in project data (the real,
  // committed numbers) and bumped optimistically when an admin records a
  // contribution below, so they see it before the rebuild lands. Public
  // visitors just see the committed values.
  const [liveRaised, setLiveRaised] = useState(project.raisedUSD);
  const [liveSubs, setLiveSubs] = useState(project.subs || []);
  const [fundFlash, setFundFlash] = useState(false);

  // Donations are no longer collected online, so there is no demo/browser
  // layer to fold in — funding shown is exactly what management has recorded.
  const emptyBreakdown: DemoBreakdown = { targetedBySub: {}, undirectedTotal: 0 };
  const subRaisedDisplayed = computeSubRaised(liveSubs, emptyBreakdown);
  const displayedRaised = computeProjectRaised(liveRaised, liveSubs, emptyBreakdown);
  const displayedDonors = project.donors;
  const totalBudget = (liveSubs.length > 0)
    ? liveSubs.reduce((s, x) => s + x.budgetUSD, 0)
    : project.budgetUSD;
  const pct = Math.min(
    100,
    Math.round((displayedRaised / Math.max(1, totalBudget)) * 100)
  );

  // Effective display status: 'funding' that reached 100% reads as 'active'.
  const effStatus = displayStatus({
    status: project.status,
    raisedUSD: displayedRaised,
    budgetUSD: totalBudget,
  });

  // Apply an admin's recorded contribution to the on-screen totals now.
  const handleFundsUpdated = ({ subId, amount }: { subId?: string; amount: number }) => {
    if (subId) {
      setLiveSubs((prev) => {
        const next = prev.map((s) =>
          s.id === subId ? { ...s, raisedUSD: Math.max(0, s.raisedUSD + amount) } : s
        );
        setLiveRaised(next.reduce((a, s) => a + s.raisedUSD, 0));
        return next;
      });
    } else {
      setLiveRaised((r) => Math.max(0, r + amount));
    }
    setFundFlash(true);
    setTimeout(() => setFundFlash(false), 4000);
  };

  return (
    <section className="section">
      <div className="detail-hero">
        <div className="breadcrumb">
          <a href={`${basePath}/`}>{t(lang, 'breadcrumb_home')}</a>
          <span className="breadcrumb-sep">/</span>
          <a href={`${basePath}/projects/`}>{t(lang, 'breadcrumb_projects')}</a>
          <span className="breadcrumb-sep">/</span>
          <span>{t(lang, `cat_${project.category}` as any)}</span>
        </div>
        {/* Admin-only quick access to the editor. Renders nothing for
            anonymous/non-admin visitors. */}
        <AdminEditProjectButton
          projectId={project.id}
          lang={lang}
          engineers={project.engineers || []}
          basePath={basePath}
        />
        <div className="project-card-header">
          <span className="project-category">{t(lang, `cat_${project.category}` as any)}</span>
          <span className={`project-status status-${effStatus}`}>{t(lang, `status_${effStatus}` as any)}</span>
        </div>
        <h1 className="detail-title">{loc(lang, project.title)}</h1>
        <div style={{ marginBottom: '0.75rem' }}>
          <HealthPill health={project.health} lang={lang} />
        </div>
        <div className="detail-loc">
          <span className="detail-loc-item">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            {loc(lang, project.location)}
          </span>
          {project.daysLeft > 0 && (
            <span className="detail-loc-item">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {fmtNum(lang, project.daysLeft)} {t(lang, 'days_remaining')}
            </span>
          )}
          <span className="detail-loc-item">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
            {fmtNum(lang, project.donors)} {project.donors === 1 ? t(lang, 'progress_donor') : t(lang, 'progress_donors')}
          </span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <p style={{ fontSize: '1.1rem', color: 'var(--sy-ink-soft)' }}>{loc(lang, project.description)}</p>

          {typeof project.lat === 'number' && typeof project.lng === 'number' && (
            <div className="detail-map-section">
              <div className="detail-map-title">
                <span style={{ color: 'var(--sy-gold)' }}>◆</span>
                {lang === 'ar' ? 'موقع المشروع' : 'Project location'}
              </div>
              <ProjectLocationMap
                lat={project.lat}
                lng={project.lng}
                health={project.health}
                title={project.title}
                location={project.location}
                lang={lang}
              />
            </div>
          )}

          <div className="hierarchy">
            <div className="hierarchy-title">
              <span style={{ color: 'var(--sy-gold)' }}>◆</span>
              {t(lang, 'hierarchy_title')}
            </div>
            <div className="tree">
              {liveSubs.map((s, i) => {
                const subDisplayedRaised = subRaisedDisplayed[s.id] ?? s.raisedUSD;
                const subPct = Math.min(
                  100,
                  Math.round((subDisplayedRaised / Math.max(1, s.budgetUSD)) * 100)
                );
                const isLast = i === liveSubs.length - 1;
                return (
                  <div key={s.id} className={`tree-node ${isLast ? 'last' : 'continues'}`}>
                    <div className="tree-line"></div>
                    <div className="tree-node-content">
                      <div className="tree-node-row">
                        <div>
                          <div className="tree-node-title">{loc(lang, s.title)}</div>
                          <div className="tree-node-meta">
                            {loc(lang, s.length)} • {t(lang, 'hierarchy_collected')} {fmtNum(lang, subPct)}%
                          </div>
                        </div>
                        <div className="tree-node-amount">
                          {fmtMoney(lang, currency, subDisplayedRaised)} / {fmtMoney(lang, currency, s.budgetUSD)}
                        </div>
                      </div>
                      <div className="tree-mini-progress">
                        <div className="tree-mini-fill" style={{ width: `${subPct}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ marginTop: '1rem', fontSize: '14px', color: 'var(--sy-muted)' }}>
              {t(lang, 'hierarchy_hint')}
            </p>
          </div>

          {((project.photos && project.photos.length > 0) || extraPhotos.length > 0) && (
            <div className="photo-section">
              <div className="photo-section-title">
                <span style={{ color: 'var(--sy-gold)' }}>◆</span>
                {t(lang, 'photos_title')}
              </div>
              <div className="photo-grid">
                {/* Photos just uploaded this session — shown from a local preview
                    with a badge until the rebuild serves the committed file. */}
                {extraPhotos.map((photo, i) => (
                  <div className="photo-pending-wrap" key={`x-${i}`}>
                    <span className="pending-badge photo-pending-badge">
                      {lang === 'ar' ? 'قيد النشر' : 'Publishing…'}
                    </span>
                    <ProjectPhoto
                      src={photo.previewUrl}
                      status={photo.status}
                      caption={loc(lang, photo.caption)}
                      date={loc(lang, photo.date)}
                      lang={lang}
                      projectId={project.id}
                      photoIndex={i}
                    />
                  </div>
                ))}
                {(project.photos || []).map((photo, i) => (
                  <ProjectPhoto
                    key={i}
                    scene={photo.scene}
                    src={photo.src}
                    status={photo.status}
                    caption={loc(lang, photo.caption)}
                    date={loc(lang, photo.date)}
                    lang={lang}
                    projectId={project.id}
                    photoIndex={i}
                  />
                ))}
              </div>
              {/* Credits footer — explains the illustrative photo policy */}
              <PhotoCreditsFooter
                photos={project.photos}
                projectId={project.id}
                lang={lang}
              />
            </div>
          )}

          {(extraUpdates.length > 0 || (project.updates && project.updates.length > 0)) && (
            <>
              <h3>{t(lang, 'updates_title')}</h3>
              <div className="timeline">
                {extraUpdates.map((u, i) => (
                  <div className="update update-pending" key={`x-${i}`}>
                    <div className="update-head">
                      <span className="update-author">{loc(lang, u.author)}</span>
                      <span className="update-date">{loc(lang, u.date)}</span>
                      <span className="pending-badge">
                        {lang === 'ar' ? 'قيد النشر' : 'Publishing…'}
                      </span>
                    </div>
                    <div className="update-body">{loc(lang, u.body)}</div>
                  </div>
                ))}
                {(project.updates || []).map((u, i) => (
                  <div className="update" key={i}>
                    <div className="update-head">
                      <span className="update-author">{loc(lang, u.author)}</span>
                      <span className="update-date">{loc(lang, u.date)}</span>
                    </div>
                    <div className="update-body">{loc(lang, u.body)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Add Field Update — placed right after the timeline so admins/
              engineers can add a new update where they just read existing
              ones. Hidden for everyone else. onAdded shows it immediately. */}
          <AuthAwareUpdateAdder
            projectId={project.id}
            lang={lang}
            engineers={project.engineers || []}
            projectHealth={project.health}
            onAdded={({ update, photos }) => {
              setExtraUpdates((prev) => [update, ...prev]);
              if (photos.length > 0) setExtraPhotos((prev) => [...photos, ...prev]);
            }}
          />

          {project.engineers && project.engineers.length > 0 && (
            <>
              <h3>{t(lang, 'engineers_title')}</h3>
              <div className="engineers-grid">
                {project.engineers.map((e, i) => (
                  <div className="engineer-card" key={i}>
                    <div className="engineer-avatar">{getInitials(loc(lang, e.name))}</div>
                    <div className="engineer-info">
                      <div className="engineer-name">{loc(lang, e.name)}</div>
                      <div className="engineer-role">{loc(lang, e.role)}</div>
                      {(e.phone || e.email) && (
                        <div className="engineer-contact">
                          {e.phone && <span>📞 {e.phone}</span>}
                          {e.email && <a href={`mailto:${e.email}`}>✉ {e.email}</a>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Add Note button — visible to admins AND engineers on this project.
              Inline form posts to comments[] via Git Gateway. The auth bar
              shows who's signed in and their role. onAdded shows it immediately. */}
          <AuthAwareNoteAdder
            projectId={project.id}
            lang={lang}
            engineers={project.engineers || []}
            onAdded={(c) => setExtraComments((prev) => [...prev, c])}
          />

          {((project.comments && project.comments.length > 0) || extraComments.length > 0) && (
            <>
              <h3>{t(lang, 'comments_title')}</h3>
              <div className="comments-list">
                {(project.comments || []).map((c, i) => (
                  <div className="comment" key={i}>
                    <div className="comment-head">
                      <span className="comment-author">{loc(lang, c.author)}</span>
                      {c.date && <span className="comment-date">{c.date}</span>}
                    </div>
                    <div className="comment-body">{loc(lang, c.body)}</div>
                  </div>
                ))}
                {extraComments.map((c, i) => (
                  <div className="comment comment-pending" key={`x-${i}`}>
                    <div className="comment-head">
                      <span className="comment-author">{loc(lang, c.author)}</span>
                      {c.date && <span className="comment-date">{c.date}</span>}
                      <span className="pending-badge">
                        {lang === 'ar' ? 'قيد النشر' : 'Publishing…'}
                      </span>
                    </div>
                    <div className="comment-body">{loc(lang, c.body)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="donate-card">
            <h3>{t(lang, 'contribute_title')}</h3>
            <div className="donate-stat">
              <div className="donate-stat-big">{fmtMoney(lang, currency, displayedRaised)}</div>
              <div className="donate-stat-of">
                {t(lang, 'donate_raised_of')} <strong>{fmtMoney(lang, currency, totalBudget)}</strong>
              </div>
              <div className="progress" style={{ marginTop: '0.75rem' }}>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                </div>
                <div className="progress-meta">
                  <span className="progress-percent">{fmtNum(lang, pct)}%</span>
                  {displayedRaised >= totalBudget && (
                    <span className="progress-amount">
                      {lang === 'ar' ? '✓ مموّل بالكامل' : '✓ Fully funded'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Public contribution message — online donations are not offered;
                funding is arranged through the committee. */}
            <div className="contribute-msg">
              <p>
                {t(lang, 'contribute_msg_before')}{' '}
                <strong className="committee-name">{t(lang, 'committee_name')}</strong>{' '}
                {t(lang, 'contribute_msg_after')}
              </p>
              <p className="contribute-note">{t(lang, 'contribute_note')}</p>
            </div>

            {fundFlash && (
              <div className="fund-admin-flash">✓ {t(lang, 'fund_added')}</div>
            )}

            {/* Admin-only: record a real contribution against the funds. */}
            <AdminFundUpdater
              projectId={project.id}
              subs={liveSubs}
              projectRaisedUSD={liveRaised}
              totalBudgetUSD={totalBudget}
              engineers={project.engineers || []}
              lang={lang}
              currency={currency}
              onUpdated={handleFundsUpdated}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Photo credits footer — shown beneath the photo grid when Unsplash photos
 * are in use. Makes the illustrative-photo policy clear to visitors and
 * credits the photographers (a courtesy beyond the Unsplash license terms).
 */
function PhotoCreditsFooter({
  photos,
  projectId,
  lang,
}: {
  photos: Photo[];
  projectId: string;
  lang: Lang;
}) {
  // Import the helper to gather credits
  // (top-level import would be circular-ish for typings; inline import is cleaner)
  const credits = gatherCreditsLocal(photos, projectId);
  if (credits.length === 0) return null;

  return (
    <div className="photo-credits">
      <p className="photo-credits-policy">
        {lang === 'ar'
          ? '★ هذه الصور توضيحية من مكتبة Unsplash المجانية، لا تمثّل مواقع المشاريع الفعلية. سيتم استبدالها بصور حقيقية من الميدان عندما يرفعها المجلس عبر لوحة الإدارة.'
          : '★ These are illustrative stock photos from Unsplash, not real photos of the project sites. They will be replaced with actual field photos when the council uploads them via the admin panel.'}
      </p>
      <p className="photo-credits-list">
        {lang === 'ar' ? 'تصوير: ' : 'Photos by: '}
        {credits.map((c, i) => (
          <span key={c.hash}>
            <a href={c.link} target="_blank" rel="noopener noreferrer">
              {c.photographer}
            </a>
            {i < credits.length - 1 ? ', ' : ''}
          </span>
        ))}
        {' · '}
        <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>
      </p>
    </div>
  );
}

// Local helper to gather credits.
// Mirrors gatherCredits in data/unsplash-photos.ts but uses inline type.
function gatherCreditsLocal(
  photos: Photo[],
  projectId: string,
): Array<{ hash: string; photographer: string; link: string }> {
  const seen = new Set<string>();
  const credits: Array<{ hash: string; photographer: string; link: string }> = [];
  photos.forEach((p, i) => {
    if (p.src) return;
    if (!p.scene) return;
    const photo = pickPhoto(projectId, p.scene as any, i);
    if (!photo) return; // No Unsplash photo for this scene — nothing to credit
    if (!seen.has(photo.hash)) {
      seen.add(photo.hash);
      credits.push(photo);
    }
  });
  return credits;
}

/**
 * First-letter initials for an engineer's avatar circle.
 * Handles both Arabic and Latin names; falls back to '?' if empty.
 */
function getInitials(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return first + last;
}
