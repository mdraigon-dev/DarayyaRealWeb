import { useState, useEffect } from 'react';
import HealthPill from './HealthPill';
import ProjectPhoto from './ProjectPhoto';
import AuthAwareNoteAdder from './AuthAwareNoteAdder';
import AuthAwareUpdateAdder from './AuthAwareUpdateAdder';
import DonationModal from './DonationModal';
import { pickPhoto } from '../data/unsplash-photos';
import { loadDonations, sumForProject, clearAllDonations, type DemoDonation } from '../data/demo-donations';
import { computeSubRaised, computeProjectRaised, type DemoBreakdown } from '../data/donation-math';
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
  const [modalOpen, setModalOpen] = useState(false);
  // All demo donations for THIS project loaded on mount. We derive everything
  // (project totals, sub-project waterfall, donor count) from this single
  // array so the math stays consistent across the page and the modal.
  const [allDemo, setAllDemo] = useState<DemoDonation[]>([]);

  const refreshDemoDelta = () => {
    const all = loadDonations().donations.filter(d => d.projectId === project.id);
    setAllDemo(all);
  };

  useEffect(() => {
    refreshDemoDelta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Build the breakdown: targeted-by-sub map + undirected total
  const demoBreakdown: DemoBreakdown = (() => {
    const targetedBySub: Record<string, number> = {};
    let undirectedTotal = 0;
    for (const d of allDemo) {
      if (d.subId) {
        targetedBySub[d.subId] = (targetedBySub[d.subId] || 0) + d.amountUSD;
      } else {
        undirectedTotal += d.amountUSD;
      }
    }
    return { targetedBySub, undirectedTotal };
  })();

  // Waterfall-allocated displayed amount per sub
  const subRaisedDisplayed = computeSubRaised(project.subs || [], demoBreakdown);
  // True project-level total (= sum of waterfall'd sub totals, or fallback)
  const displayedRaised = computeProjectRaised(project.raisedUSD, project.subs || [], demoBreakdown);
  // Donor count is just the count of donations on this device
  const displayedDonors = project.donors + allDemo.length;
  // Total project budget = sum of subs when present, else project.budgetUSD
  const totalBudget = (project.subs && project.subs.length > 0)
    ? project.subs.reduce((s, x) => s + x.budgetUSD, 0)
    : project.budgetUSD;
  const pct = Math.min(
    100,
    Math.round((displayedRaised / Math.max(1, totalBudget)) * 100)
  );
  const totalDemoAmount = allDemo.reduce((s, d) => s + d.amountUSD, 0);

  const handleResetDemo = () => {
    if (typeof window === 'undefined') return;
    const confirmMsg = lang === 'ar'
      ? 'هل تريد حذف جميع التبرعات التجريبية من هذا الجهاز؟'
      : 'Clear all demo donations from this device?';
    if (window.confirm(confirmMsg)) {
      clearAllDonations();
      refreshDemoDelta();
    }
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
        <div className="project-card-header">
          <span className="project-category">{t(lang, `cat_${project.category}` as any)}</span>
          <span className={`project-status status-${project.status}`}>{t(lang, `status_${project.status}` as any)}</span>
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

          <div className="hierarchy">
            <div className="hierarchy-title">
              <span style={{ color: 'var(--sy-gold)' }}>◆</span>
              {t(lang, 'hierarchy_title')}
            </div>
            <div className="tree">
              {project.subs.map((s, i) => {
                // Waterfall-applied raised amount (handles both targeted
                // and undirected demo donations correctly)
                const subDisplayedRaised = subRaisedDisplayed[s.id] ?? s.raisedUSD;
                const subDemoDelta = subDisplayedRaised - s.raisedUSD;
                const targetedDelta = demoBreakdown.targetedBySub[s.id] || 0;
                const fromWaterfall = subDemoDelta - targetedDelta;
                const subPct = Math.min(
                  100,
                  Math.round((subDisplayedRaised / Math.max(1, s.budgetUSD)) * 100)
                );
                const isLast = i === project.subs.length - 1;
                return (
                  <div key={s.id} className={`tree-node ${isLast ? 'last' : 'continues'}`}>
                    <div className="tree-line"></div>
                    <div className="tree-node-content">
                      <div className="tree-node-row">
                        <div>
                          <div className="tree-node-title">{loc(lang, s.title)}</div>
                          <div className="tree-node-meta">
                            {loc(lang, s.length)} • {t(lang, 'hierarchy_collected')} {fmtNum(lang, subPct)}%
                            {subDemoDelta > 0 && (
                              <span className="tree-node-demo-tag" title={
                                fromWaterfall > 0 && targetedDelta > 0
                                  ? (lang === 'ar'
                                      ? `موجّه: ${fmtMoney(lang, currency, targetedDelta)} • تلقائي: ${fmtMoney(lang, currency, fromWaterfall)}`
                                      : `Targeted: ${fmtMoney(lang, currency, targetedDelta)} • Auto-fill: ${fmtMoney(lang, currency, fromWaterfall)}`)
                                  : fromWaterfall > 0
                                    ? (lang === 'ar' ? 'تم التعبئة تلقائياً من تبرعات المشروع العامة' : 'Auto-filled from project-wide donations')
                                    : (lang === 'ar' ? 'تبرع موجّه لهذا البند' : 'Targeted to this item')
                              }>
                                ★ +{fmtMoney(lang, currency, subDemoDelta)} {lang === 'ar' ? 'تجريبي' : 'demo'}
                              </span>
                            )}
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

          {project.photos && project.photos.length > 0 && (
            <div className="photo-section">
              <div className="photo-section-title">
                <span style={{ color: 'var(--sy-gold)' }}>◆</span>
                {t(lang, 'photos_title')}
              </div>
              <div className="photo-grid">
                {project.photos.map((photo, i) => (
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

          {project.updates && project.updates.length > 0 && (
            <>
              <h3>{t(lang, 'updates_title')}</h3>
              <div className="timeline">
                {project.updates.map((u, i) => (
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
              ones. Hidden for everyone else. */}
          <AuthAwareUpdateAdder
            projectId={project.id}
            lang={lang}
            engineers={project.engineers || []}
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
              shows who's signed in and their role. */}
          <AuthAwareNoteAdder
            projectId={project.id}
            lang={lang}
            engineers={project.engineers || []}
          />

          {project.comments && project.comments.length > 0 && (
            <>
              <h3>{t(lang, 'comments_title')}</h3>
              <div className="comments-list">
                {project.comments.map((c, i) => (
                  <div className="comment" key={i}>
                    <div className="comment-head">
                      <span className="comment-author">{loc(lang, c.author)}</span>
                      {c.date && <span className="comment-date">{c.date}</span>}
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
            <h3>{t(lang, 'donate_title')}</h3>
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
                  <span className="progress-amount">
                    {fmtNum(lang, displayedDonors)}{' '}
                    {displayedDonors === 1 ? t(lang, 'progress_donor') : t(lang, 'progress_donors')}
                  </span>
                </div>
              </div>
            </div>

            <button
              className="btn-donate-full"
              onClick={() => setModalOpen(true)}
              disabled={displayedRaised >= totalBudget}
            >
              {displayedRaised >= totalBudget
                ? (lang === 'ar' ? '✓ ممول بالكامل' : '✓ Fully funded')
                : t(lang, 'donate_btn')}
            </button>

            <div className="donate-options donate-demo-note">
              <span className="donate-demo-pill">★ {lang === 'ar' ? 'وضع تجريبي' : 'Demo Mode'}</span>{' '}
              {lang === 'ar'
                ? 'التبرعات تُحفظ في متصفحك فقط — للعرض التجريبي'
                : 'Donations are saved in your browser only — for demonstration'}
            </div>

            {totalDemoAmount > 0 && (
              <div className="donate-reset-row">
                <span className="donate-reset-note">
                  {lang === 'ar'
                    ? `أضفت ${fmtMoney(lang, currency, totalDemoAmount)} تجريبياً (${fmtNum(lang, allDemo.length)} تبرع)`
                    : `You've added ${fmtMoney(lang, currency, totalDemoAmount)} in demo donations (${fmtNum(lang, allDemo.length)})`}
                </span>
                <button
                  type="button"
                  className="donate-reset-btn"
                  onClick={handleResetDemo}
                >
                  ↺ {lang === 'ar' ? 'إعادة تعيين' : 'Reset'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Demo donation modal */}
      <DonationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDonated={refreshDemoDelta}
        projectId={project.id}
        projectTitle={project.title}
        projectBudgetUSD={project.budgetUSD}
        projectRaisedUSD={project.raisedUSD}
        subs={project.subs}
        demoBreakdown={demoBreakdown}
        lang={lang}
        currency={currency}
      />
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
