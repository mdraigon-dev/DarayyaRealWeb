import { useMemo, useState } from 'react';
import { t, fmtNum, fmtMoney, loc, type Lang } from '../i18n/strings';
import { displayStatus } from '../data/donation-math';
import { lastActivityAt, type ActivityProject } from '../data/activity-feed';
import { can } from '../data/permissions';
import { useIdentity } from '../data/use-identity';
import { deleteDocument } from '../data/documents';
import { formatAbsolute } from '../data/time';
import { govFundingOf } from '../data/gov-funding';
import { formatFileSize, type Circular } from './CircularsContent';
import AdminDeleteButton from './AdminDeleteButton';
import { commitName } from '../data/admin-prefs';

type Bilingual = { ar: string; en?: string };
type Project = ActivityProject & {
  status: 'funding' | 'active' | 'completed' | 'planning';
  category: string;
  title: Bilingual;
  location: Bilingual;
  budgetUSD: number;
  raisedUSD: number;
  deadline?: string;
  govFunding?: unknown;
};

type Props = {
  projects: Project[];
  /** All published circulars; the ones in the "report" category are listed here */
  documents?: Circular[];
  lang: Lang;
  basePath: string;
};

/**
 * Transparency page: totals from recorded project data, the official reports
 * actually published under Circulars (category "report"), and a CSV export.
 * Admins can delete a report here as on the Circulars page.
 */
export default function TransparencyContent({ projects, documents = [], lang, basePath }: Props) {
  const currency = 'USD' as const;
  const identity = useIdentity();
  const isAdmin = identity.kind === 'authenticated' && can(identity.user, 'delete-documents');
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState(false);

  const totalRaised = projects.reduce((s, p) => s + Math.min(p.raisedUSD, p.budgetUSD), 0);
  const totalBudget = projects.reduce((s, p) => s + p.budgetUSD, 0);
  const gap = Math.max(0, totalBudget - totalRaised);
  const completed = projects.filter((p) => p.status === 'completed').length;

  const reports = useMemo(
    () => documents
      .filter((d) => d.category === 'report' && !deletedIds.has(d.id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [documents, deletedIds],
  );

  const removeReport = async (d: Circular) => {
    await deleteDocument({
      source: d.source || `${d.id}.md`,
      file: d.file,
      message: `Delete report ${d.id} by ${commitName(identity.kind === 'authenticated' ? identity.user : null)}`,
    });
    setDeletedIds((s) => new Set(s).add(d.id));
    setToast(true);
    setTimeout(() => setToast(false), 5000);
  };

  // CSV of current project data, generated in the browser.
  const downloadProjectsCSV = () => {
    const headers = lang === 'ar'
      ? ['المعرف', 'العنوان', 'القطاع', 'الموقع', 'الحالة', 'الميزانية USD', 'المحصّل USD', 'النسبة %', 'المتبقّي USD', 'آخر تحديث', 'الموعد النهائي', 'التمويل الحكومي', 'ملاحظة التمويل الحكومي']
      : ['ID', 'Title', 'Category', 'Location', 'Status', 'Budget USD', 'Raised USD', 'Percent %', 'Still needed USD', 'Last update', 'Deadline', 'Government funding', 'Government funding note'];
    const rows = projects.map((p) => {
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
        String(Math.max(0, p.budgetUSD - p.raisedUSD)),
        (lastActivityAt(p) || '').slice(0, 10),
        p.deadline || '',
        (() => { const g = govFundingOf(p); return g.type === 'none' ? '' : t(lang, g.type === 'full' ? 'gov_badge_full' : 'gov_badge_partial'); })(),
        (() => { const g = govFundingOf(p); return g.type === 'none' ? '' : loc(lang, g.note); })(),
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map(escapeCSVCell).join(',')).join('\n');
    // BOM prefix so Excel opens UTF-8 Arabic correctly
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darayya-projects-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="trans-card-val">{fmtMoney(lang, currency, gap)}</div>
          <div className="trans-card-label">{t(lang, 'trans_gap_label')}</div>
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
        <h2 className="section-title" style={{ fontSize: '1.6rem' }}>{t(lang, 'trans_reports_title')}</h2>
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

      {reports.length === 0 ? (
        <div className="activity-feed-empty">{t(lang, 'trans_reports_empty')}</div>
      ) : (
        <div className="reports-list">
          {reports.map((r) => (
            <div className="report-item" key={r.id}>
              <div className="report-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div className="report-info">
                <div className="report-title">{loc(lang, r.title)}</div>
                <div className="report-meta">
                  {[formatAbsolute(r.date, lang), formatFileSize(r.fileSize, lang), r.uploadedBy].filter(Boolean).join(' • ')}
                </div>
              </div>
              <a className="report-action" href={r.file} download>
                {lang === 'ar' ? 'تحميل ↓' : 'Download ↓'}
              </a>
              {isAdmin && (
                <AdminDeleteButton
                  lang={lang}
                  what={lang === 'ar' ? 'التقرير' : 'report'}
                  warning={t(lang, 'activity_del_doc_warning')}
                  onConfirm={() => removeReport(r)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <p className="reports-disclaimer">
        {t(lang, 'trans_reports_note')}{' '}
        <a href={`${basePath}/circulars/`}>{t(lang, 'trans_reports_all')}</a>
      </p>

      {toast && <div className="admin-toast" role="status">✓ {t(lang, 'activity_deleted_toast')}</div>}
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
