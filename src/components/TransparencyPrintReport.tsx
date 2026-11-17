import { useEffect, useState } from 'react';
import { loc, fmtMoney, fmtNum, type Lang } from '../i18n/strings';
import { displayStatus } from '../data/donation-math';
import { lastActivityAt, type ActivityProject } from '../data/activity-feed';
import { formatAbsolute } from '../data/time';

type Bilingual = { ar: string; en: string };
type Sub = { id: string; budgetUSD: number; raisedUSD: number };
type Project = Omit<ActivityProject, 'title' | 'subs'> & {
  id: string;
  status: string;
  category: string;
  title: Bilingual;
  location: Bilingual;
  budgetUSD: number;
  raisedUSD: number;
  subs?: Sub[];
};

type Props = {
  projects: Project[];
  lang: Lang;
  /** Inline SVG markup for the Darayya emblem (passed in by Astro via ?raw import) */
  emblemSvg: string;
};

/**
 * TransparencyPrintReport
 *
 * Single-page printable transparency report. Rendered at /xx/transparency/print/.
 *
 * Figures come straight from the recorded project data. Auto-calls
 * window.print() shortly after mount.
 */
export default function TransparencyPrintReport({ projects: rawProjects, lang, emblemSvg }: Props) {
  const currency: 'USD' | 'SYP' = 'USD';

  const projects = rawProjects;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const totalRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalBudget = projects.reduce((s, p) => s + p.budgetUSD, 0);
  const gap = Math.max(0, totalBudget - totalRaised);
  const completed = projects.filter(p => p.status === 'completed').length;
  const active = projects.filter(p => displayStatus(p) === 'active').length;
  const open = projects.filter(p => displayStatus(p) === 'funding').length;
  const fundingRate = totalBudget > 0 ? Math.round((totalRaised / totalBudget) * 100) : 0;

  const now = new Date();
  const generatedDate = now.toLocaleDateString(
    lang === 'ar' ? 'ar-SY' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  // Auto-trigger the print dialog once the page has rendered. Some browsers block window.print() shortly after
  // navigation (popup-blocker heuristic), so we also leave a very
  // obvious manual "Print" button at the top of the page.
  // Two requestAnimationFrame calls + a small delay give the browser time
  // to commit the React-rendered DOM before printing — without these,
  // print previews sometimes captured the page mid-render.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        setTimeout(() => {
          if (cancelled) return;
          try { window.print(); } catch {}
        }, 500);
      });
    });
    return () => { cancelled = true; };
  }, [mounted]);

  const sortedProjects = [...projects].sort((a, b) => b.raisedUSD - a.raisedUSD);

  return (
    <div className="print-page">
      {/* On-screen toolbar — hidden in print via @media print */}
      <div className="print-toolbar no-print">
        <button
          type="button"
          className="print-btn-primary"
          onClick={() => window.print()}
        >
          {lang === 'ar' ? '🖨 طباعة / حفظ كـ PDF' : '🖨 Print / Save as PDF'}
        </button>
        <a
          className="print-btn-secondary"
          href={(() => {
            const base = (import.meta as any).env?.BASE_URL ?? '/';
            return `${base}${lang}/transparency/`.replace(/\/{2,}/g, '/');
          })()}
        >
          {lang === 'ar' ? '← العودة إلى صفحة الشفافية' : '← Back to transparency page'}
        </a>
        <span className="print-toolbar-hint">
          {lang === 'ar'
            ? 'إذا لم تظهر نافذة الطباعة تلقائياً، اضغط زر "طباعة" أعلاه. اختر "حفظ كـ PDF" من قائمة الطابعات.'
            : 'If the print dialog didn\'t open automatically, click the Print button above. Choose "Save as PDF" from the printer list.'}
        </span>
      </div>

      <div className="print-sheet">
        {/* Cover/header block */}
        <header className="print-header">
          <div className="print-header-emblem" dangerouslySetInnerHTML={{ __html: emblemSvg }} />
          <div className="print-header-text">
            <h1 className="print-title">
              {lang === 'ar' ? 'تقرير الشفافية المالي' : 'Financial Transparency Report'}
            </h1>
            <p className="print-subtitle">
              {lang === 'ar' ? 'مجلس مدينة داريّا — نماء' : 'Darayya City Council — Namaa'}
            </p>
            <p className="print-meta">
              {lang === 'ar' ? 'تاريخ التوليد: ' : 'Generated: '}{generatedDate}
            </p>
          </div>
        </header>

        {/* Top-level stats card grid */}
        <section className="print-section">
          <h2 className="print-section-heading">
            {lang === 'ar' ? 'الأرقام الأساسية' : 'Key Figures'}
          </h2>
          <div className="print-stats-grid">
            <div className="print-stat-card">
              <div className="print-stat-label">{lang === 'ar' ? 'إجمالي المحصّل' : 'Total Raised'}</div>
              <div className="print-stat-value">{fmtMoney(lang, currency, totalRaised)}</div>
              <div className="print-stat-sub">
                {lang === 'ar' ? 'من أصل' : 'of'} {fmtMoney(lang, currency, totalBudget)}
              </div>
            </div>
            <div className="print-stat-card">
              <div className="print-stat-label">{lang === 'ar' ? 'نسبة التمويل' : 'Funding Rate'}</div>
              <div className="print-stat-value">{fmtNum(lang, fundingRate)}%</div>
              <div className="print-stat-sub">
                {lang === 'ar' ? 'من الميزانية الإجمالية' : 'of total budget'}
              </div>
            </div>
            <div className="print-stat-card">
              <div className="print-stat-label">{lang === 'ar' ? 'المتبقّي المطلوب' : 'Still Needed'}</div>
              <div className="print-stat-value">{fmtMoney(lang, currency, gap)}</div>
              <div className="print-stat-sub">
                {lang === 'ar' ? 'لاستكمال تمويل جميع المشاريع' : 'to fully fund every project'}
              </div>
            </div>
            <div className="print-stat-card">
              <div className="print-stat-label">{lang === 'ar' ? 'عدد المشاريع' : 'Projects'}</div>
              <div className="print-stat-value">{fmtNum(lang, projects.length)}</div>
              <div className="print-stat-sub">
                {fmtNum(lang, completed)} {lang === 'ar' ? 'مكتمل' : 'completed'} · {fmtNum(lang, active)} {lang === 'ar' ? 'نشط' : 'active'} · {fmtNum(lang, open)} {lang === 'ar' ? 'مفتوح' : 'open'}
              </div>
            </div>
          </div>
        </section>

        {/* Per-project table — the substance of the report */}
        <section className="print-section">
          <h2 className="print-section-heading">
            {lang === 'ar' ? 'تفاصيل المشاريع' : 'Project Details'}
          </h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>{lang === 'ar' ? 'المشروع' : 'Project'}</th>
                <th>{lang === 'ar' ? 'الموقع' : 'Location'}</th>
                <th className="print-table-num">{lang === 'ar' ? 'الميزانية' : 'Budget'}</th>
                <th className="print-table-num">{lang === 'ar' ? 'المحصّل' : 'Raised'}</th>
                <th className="print-table-num">%</th>
                <th>{lang === 'ar' ? 'آخر تحديث' : 'Last update'}</th>
                <th>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map(p => {
                const pct = p.budgetUSD > 0 ? Math.round((p.raisedUSD / p.budgetUSD) * 100) : 0;
                const effStatus = displayStatus(p);
                return (
                  <tr key={p.id}>
                    <td><strong>{loc(lang, p.title)}</strong></td>
                    <td className="print-table-secondary">{loc(lang, p.location)}</td>
                    <td className="print-table-num">{fmtMoney(lang, currency, p.budgetUSD)}</td>
                    <td className="print-table-num">{fmtMoney(lang, currency, p.raisedUSD)}</td>
                    <td className="print-table-num"><strong>{fmtNum(lang, pct)}%</strong></td>
                    <td className="print-table-secondary">
                      {(() => { const at = lastActivityAt(p); return at ? formatAbsolute(at.slice(0, 10), lang) : '—'; })()}
                    </td>
                    <td>
                      <span className={`print-status print-status-${effStatus}`}>
                        {statusLabel(lang, effStatus)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><strong>{lang === 'ar' ? 'المجموع' : 'Total'}</strong></td>
                <td className="print-table-num"><strong>{fmtMoney(lang, currency, totalBudget)}</strong></td>
                <td className="print-table-num"><strong>{fmtMoney(lang, currency, totalRaised)}</strong></td>
                <td className="print-table-num"><strong>{fmtNum(lang, fundingRate)}%</strong></td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </section>

        <footer className="print-footer">
          <p>
            {lang === 'ar'
              ? 'هذا التقرير مُولَّد من البيانات الحالية على المنصة. للتقارير الرسمية المعتمدة، تواصل مع المجلس.'
              : 'This report is generated from current platform data. For official audited reports, contact the City Council.'}
          </p>
          <p className="print-footer-url">
            {lang === 'ar' ? 'الموقع: ' : 'Site: '}
            {typeof window !== 'undefined' ? window.location.origin : ''}{lang === 'ar' ? '/ar/' : '/en/'}
          </p>
        </footer>
      </div>
    </div>
  );
}

function statusLabel(lang: Lang, status: string): string {
  if (lang === 'ar') {
    return ({
      funding: 'مفتوح للتمويل',
      active: 'قيد التنفيذ',
      completed: 'مكتمل',
      planning: 'قيد التخطيط',
    } as Record<string, string>)[status] || status;
  }
  return ({
    funding: 'Open',
    active: 'Active',
    completed: 'Completed',
    planning: 'Planning',
  } as Record<string, string>)[status] || status;
}
