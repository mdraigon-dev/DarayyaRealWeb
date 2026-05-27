import { useState, useEffect } from 'react';
import { t, fmtNum, fmtMoney, loc, type Lang } from '../i18n/strings';
import { loadDonations } from '../data/demo-donations';
import { applyDemoToProjects, displayStatus } from '../data/donation-math';
import ReportUploader from './ReportUploader';

type Bilingual = { ar: string; en: string };
type Sub = { id: string; budgetUSD: number; raisedUSD: number };
type Project = {
  id: string;
  status: string;
  category: string;
  title: Bilingual;
  location: Bilingual;
  budgetUSD: number;
  raisedUSD: number;
  donors: number;
  daysLeft: number;
  subs?: Sub[];
};

export type TransparencyCircular = {
  id: string;
  title: Bilingual;
  description?: { ar?: string; en?: string };
  category: string;
  date: string;
  file: string;
  fileSize: number;
  fileType: string;
};

type Props = {
  projects: Project[];
  lang: Lang;
  /** Circulars from the content collection — used to populate the reports section.
   *  Falls back to static sample data when empty. */
  circulars?: TransparencyCircular[];
};

export default function TransparencyContent({ projects: rawProjects, lang, circulars = [] }: Props) {
  const [currency] = useState<'USD' | 'SYP'>('USD');
  const [deletedReportIds, setDeletedReportIds] = useState<Set<string>>(new Set());
  const handleReportDeleted = (id: string) => setDeletedReportIds(prev => new Set([...prev, id]));

  // Same architecture as HomeContent: hold raw donations in state,
  // derive everything per-render. Guarantees the totals here match
  // the home page and the PDF (all three use applyDemoToProjects now).
  const [donations, setDonations] = useState<{ projectId: string; subId?: string; amountUSD: number }[]>([]);
  useEffect(() => {
    const refresh = () => setDonations(loadDonations().donations);
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const projects = applyDemoToProjects(rawProjects, donations);

  const totalRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalBudget = projects.reduce((s, p) => s + p.budgetUSD, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donors, 0);
  const completed = projects.filter(p => p.status === 'completed').length;

  // Generate a CSV of current project data and trigger a download.
  // Pure client-side — no backend needed.
  const downloadProjectsCSV = () => {
    const headers = lang === 'ar'
      ? ['المعرف', 'العنوان', 'القطاع', 'الموقع', 'الحالة', 'الميزانية USD', 'المحصّل USD', 'النسبة %', 'عدد المتبرعين', 'الأيام المتبقية']
      : ['ID', 'Title', 'Category', 'Location', 'Status', 'Budget USD', 'Raised USD', 'Percent %', 'Donors', 'Days Left'];
    const rows = projects.map(p => {
      const pct = p.budgetUSD > 0 ? Math.round((p.raisedUSD / p.budgetUSD) * 100) : 0;
      return [
        p.id,
        loc(lang, p.title),
        p.category,
        loc(lang, p.location),
        displayStatus(p),
        String(p.budgetUSD),
        String(p.raisedUSD),
        String(pct),
        String(p.donors),
        String(p.daysLeft),
      ];
    });
    const csv = [headers, ...rows]
      .map(row => row.map(escapeCSVCell).join(','))
      .join('\n');
    // BOM prefix so Excel opens UTF-8 Arabic correctly
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `darayya-projects-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Click on a sample report row → download a text summary of current data
  const downloadSampleReport = (reportTitle: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const fundingRate = totalBudget > 0 ? Math.round((totalRaised / totalBudget) * 100) : 0;
    const header = lang === 'ar'
      ? `تقرير: ${reportTitle}\nتاريخ التوليد: ${today}\n${'─'.repeat(50)}\n\n`
      : `Report: ${reportTitle}\nGenerated: ${today}\n${'─'.repeat(50)}\n\n`;
    const summary = lang === 'ar'
      ? `إجمالي المشاريع: ${projects.length}
الميزانية الإجمالية: $${totalBudget.toLocaleString()}
المبلغ المحصّل: $${totalRaised.toLocaleString()}
نسبة التمويل: ${fundingRate}%
عدد المتبرعين: ${totalDonors}
المشاريع المكتملة: ${completed}

تفاصيل المشاريع:
`
      : `Total projects: ${projects.length}
Total budget: $${totalBudget.toLocaleString()}
Raised: $${totalRaised.toLocaleString()}
Funding rate: ${fundingRate}%
Donors: ${totalDonors}
Completed projects: ${completed}

Project details:
`;
    const details = projects.map(p => {
      const pct = p.budgetUSD > 0 ? Math.round((p.raisedUSD / p.budgetUSD) * 100) : 0;
      return `  • ${loc(lang, p.title)} — $${p.raisedUSD.toLocaleString()} / $${p.budgetUSD.toLocaleString()} (${pct}%)`;
    }).join('\n');
    const footer = lang === 'ar'
      ? `\n\n${'─'.repeat(50)}\nملاحظة: هذا تقرير تجريبي مُولَّد من البيانات الحالية على الموقع. التقارير المالية الرسمية المعتمدة ستكون متاحة كملفات PDF عند صدورها.`
      : `\n\n${'─'.repeat(50)}\nNote: This is a demo report generated from current site data. Official audited financial reports will be available as PDFs when published.`;
    const content = header + summary + details + footer;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = reportTitle.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '-').slice(0, 40);
    a.href = url;
    a.download = `${safeTitle}-${today}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Reports section ──────────────────────────────────────────────────────
  // Use real circulars (report + policy + decision categories) when we have
  // them; fall back to static sample data so the section isn't blank on a
  // fresh install.
  const REPORT_CATEGORIES = new Set(['report', 'policy', 'decision', 'minutes']);

  type ReportRow = {
    id: string;
    title: string;
    date: string;
    size: string;
    type: string;
    file?: string;
    isReal: boolean;
  };

  function formatFileSizeKB(bytes: number): string {
    if (!bytes) return '';
    const KB = 1024, MB = KB * 1024;
    if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
    return `${Math.round((bytes / MB) * 10) / 10} MB`;
  }

  function cirCategoryLabel(cat: string, l: Lang): string {
    const map: Record<string, { ar: string; en: string }> = {
      report:       { ar: 'تقرير',    en: 'Report' },
      policy:       { ar: 'سياسة',   en: 'Policy' },
      decision:     { ar: 'قرار',    en: 'Decision' },
      minutes:      { ar: 'محضر',    en: 'Minutes' },
      announcement: { ar: 'إعلان',   en: 'Announcement' },
      other:        { ar: 'أخرى',    en: 'Other' },
    };
    return map[cat]?.[l] ?? cat;
  }

  function formatISODate(iso: string, l: Lang): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d.getTime())) return iso;
    if (l === 'ar') {
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  const realReports: ReportRow[] = circulars
    .filter(c => REPORT_CATEGORIES.has(c.category))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(c => ({
      id: c.id,
      title: loc(lang, c.title),
      date: lang === 'ar'
        ? `تم النشر في ${formatISODate(c.date, lang)}`
        : `Published ${formatISODate(c.date, lang)}`,
      size: formatFileSizeKB(c.fileSize),
      type: cirCategoryLabel(c.category, lang),
      file: c.file,
      isReal: true,
    }));

  const STATIC_REPORTS_AR: ReportRow[] = [
    { id: 's1', title: 'التقرير المالي الشهري — نيسان 2026', date: 'تم النشر في 1 أيار 2026', size: '2.4 MB', type: 'مالي', isReal: false },
    { id: 's2', title: 'تقرير المراجعة الخارجية ربع السنوي', date: 'تم النشر في 15 نيسان 2026', size: '5.1 MB', type: 'مراجعة', isReal: false },
    { id: 's3', title: 'بيان مفصّل بالمصروفات — آذار 2026', date: 'تم النشر في 3 نيسان 2026', size: '1.8 MB', type: 'مالي', isReal: false },
    { id: 's4', title: 'تقرير اللجنة المجتمعية المستقلة', date: 'تم النشر في 1 نيسان 2026', size: '900 KB', type: 'حوكمة', isReal: false },
  ];
  const STATIC_REPORTS_EN: ReportRow[] = [
    { id: 's1', title: 'Monthly Financial Report — April 2026', date: 'Published May 1, 2026', size: '2.4 MB', type: 'Financial', isReal: false },
    { id: 's2', title: 'Quarterly External Audit Report', date: 'Published April 15, 2026', size: '5.1 MB', type: 'Audit', isReal: false },
    { id: 's3', title: 'Detailed Expenses Statement — March 2026', date: 'Published April 3, 2026', size: '1.8 MB', type: 'Financial', isReal: false },
    { id: 's4', title: 'Independent Community Committee Report', date: 'Published April 1, 2026', size: '900 KB', type: 'Governance', isReal: false },
  ];

  const reports: ReportRow[] = realReports.length > 0
    ? realReports
    : (lang === 'en' ? STATIC_REPORTS_EN : STATIC_REPORTS_AR);
  const usingRealReports = realReports.length > 0;
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <section className="section">
      <div className="section-header">
        <div className="section-eyebrow">{t(lang, 'trans_eyebrow')}</div>
        <h2 className="section-title">{t(lang, 'trans_title')}</h2>
        <p className="section-desc">{t(lang, 'trans_desc')}</p>
      </div>

      <div className="transparency-grid">
        <div className="trans-card">
          <div className="trans-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}>
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="trans-card-val">{fmtMoney(lang, currency, totalRaised)}</div>
          <div className="trans-card-label">{t(lang, 'trans_target_of')} {fmtMoney(lang, currency, totalBudget)} {t(lang, 'trans_target_label')}</div>
        </div>
        <div className="trans-card">
          <div className="trans-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
          </div>
          <div className="trans-card-val">{fmtNum(lang, totalDonors)}</div>
          <div className="trans-card-label">{t(lang, 'trans_donors')}</div>
        </div>
        <div className="trans-card">
          <div className="trans-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}>
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="trans-card-val">{fmtNum(lang, completed)}<br /><span className="unit">{t(lang, 'trans_completed')}</span></div>
          <div className="trans-card-label">{t(lang, 'trans_completed_since')}</div>
        </div>
      </div>

      <div className="section-header" style={{ marginTop: '3rem' }}>
        <h2 className="section-title" style={{ fontSize: '1.6rem' }}>
          {lang === 'ar' ? 'التقارير الرسمية' : 'Official Reports'}
        </h2>
        <div className="transparency-export-actions">
          <button
            type="button"
            className="btn-export-pdf"
            onClick={() => {
              const base = (import.meta as any).env?.BASE_URL ?? '/';
              const url = `${base}${lang}/transparency/print/`.replace(/\/{2,}/g, '/');
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            title={lang === 'ar' ? 'فتح تقرير الشفافية في نافذة جديدة للطباعة أو الحفظ كـ PDF' : 'Open transparency report in a new window for printing or saving as PDF'}
          >
            🖨 {lang === 'ar' ? 'تصدير تقرير PDF' : 'Export PDF report'}
          </button>
          <button
            type="button"
            className="btn-download-csv"
            onClick={downloadProjectsCSV}
            title={lang === 'ar' ? 'تنزيل جميع بيانات المشاريع بصيغة CSV' : 'Download all project data as CSV'}
          >
            ↓ {lang === 'ar' ? 'تنزيل CSV' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* Admin-only uploader — ReportUploader self-hides when not signed in */}
      <ReportUploader lang={lang} />

      <div className="reports-list">
        {reports.filter(r => !deletedReportIds.has(r.id)).map((r, i) => (
          r.isReal && r.file ? (
            <div key={r.id} className="report-item-wrap">
              <a
                className="report-item report-item-real"
                href={r.file}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                <div className="report-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div className="report-info">
                  <div className="report-title">{r.title}</div>
                  <div className="report-meta">{r.date}{r.size ? ` • ${r.size}` : ''} • {r.type}</div>
                </div>
                <div className="report-action">{lang === 'ar' ? 'تحميل ↓' : 'Download ↓'}</div>
              </a>
              <ReportDeleteBtn id={r.id} title={r.title} lang={lang} onDeleted={handleReportDeleted} />
            </div>
          ) : (
            <button
              type="button"
              className="report-item"
              key={i}
              onClick={() => downloadSampleReport(r.title)}
            >
              <div className="report-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div className="report-info">
                <div className="report-title">{r.title}</div>
                <div className="report-meta">{r.date} • {r.size} • {r.type}</div>
              </div>
              <div className="report-action">{lang === 'ar' ? 'تحميل ↓' : 'Download ↓'}</div>
            </button>
          )
        ))}
      </div>
      <p className="reports-disclaimer">
        {usingRealReports
          ? (lang === 'ar'
              ? '★ هذه وثائق رسمية صادرة عن مجلس المدينة. اضغط على أي وثيقة لتحميلها مباشرةً.'
              : '★ These are official documents published by the City Council. Click any document to download.')
          : (lang === 'ar'
              ? '★ هذه التقارير المسماة هي عيّنة لما سيكون متاحاً عند إصدار التقارير الرسمية المعتمدة. الضغط عليها ينزّل ملخصاً نصياً مولّداً من البيانات الحالية للمشاريع.'
              : '★ The named reports are samples showing what will be available when official audited reports are published. Clicking downloads a generated text summary based on current project data.')}
      </p>
    </section>
  );
}

/**
 * Properly escape a value for CSV.
 * Wraps in double quotes if the cell contains comma, quote, or newline.
 */
function escapeCSVCell(value: string): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Small delete button rendered beside a real report row — admin-only, self-hides when not signed in */
function ReportDeleteBtn({ id, title, lang, onDeleted }: { id: string; title: string; lang: Lang; onDeleted: (id: string) => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let tries = 0;
    const poll = () => {
      const ni = (window as any).netlifyIdentity;
      if (ni) { setIsAdmin(!!ni.currentUser()); ni.on('login', () => setIsAdmin(true)); ni.on('logout', () => setIsAdmin(false)); }
      else if (++tries < 30) setTimeout(poll, 200);
    };
    poll();
  }, []);
  if (!isAdmin) return null;
  const handleDelete = async () => {
    const msg = lang === 'ar' ? `حذف «${title}»؟` : `Delete "${title}"?`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      const { deleteFile } = await import('../data/git-gateway');
      await deleteFile(`src/content/circulars/${id}.md`, lang === 'ar' ? `حذف تقرير: ${title}` : `Delete report: ${title}`);
      onDeleted(id);
    } catch (e: any) { alert(e?.message || 'Delete failed'); setDeleting(false); }
  };
  return (
    <button type="button" className="report-delete-btn" onClick={handleDelete} disabled={deleting} title={lang === 'ar' ? 'حذف' : 'Delete'}>
      {deleting ? '…' : '×'}
    </button>
  );
}
