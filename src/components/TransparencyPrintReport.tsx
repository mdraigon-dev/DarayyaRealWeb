import { useEffect } from 'react';
import { loc, fmtMoney, fmtNum, type Lang } from '../i18n/strings';

type Bilingual = { ar: string; en: string };
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
 * Two purposes:
 *   1. Looks good on screen — branded layout, Syrian palette, decent typography
 *   2. Prints to PDF cleanly via the browser's "Save as PDF" feature
 *
 * The page auto-calls window.print() shortly after mount so opening the URL
 * in a new tab pops the print dialog. Users without auto-print just click the
 * "Print / Save as PDF" button at the top.
 *
 * The @media print CSS in global.css hides browser chrome and tightens
 * margins for a clean PDF output.
 */
export default function TransparencyPrintReport({ projects, lang, emblemSvg }: Props) {
  const currency: 'USD' | 'SYP' = 'USD';
  const totalRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalBudget = projects.reduce((s, p) => s + p.budgetUSD, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donors, 0);
  const completed = projects.filter(p => p.status === 'completed').length;
  const active = projects.filter(p => p.status === 'active').length;
  const open = projects.filter(p => p.status === 'funding').length;
  const fundingRate = totalBudget > 0 ? Math.round((totalRaised / totalBudget) * 100) : 0;

  const now = new Date();
  const generatedDate = now.toLocaleDateString(
    lang === 'ar' ? 'ar-EG' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  // Auto-trigger the print dialog ~700ms after mount so the page has time
  // to render fully. Users can also click the Print button manually.
  useEffect(() => {
    const t = setTimeout(() => {
      try { window.print(); } catch {}
    }, 700);
    return () => clearTimeout(t);
  }, []);

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
          href={lang === 'ar' ? '/ar/transparency/' : '/en/transparency/'}
        >
          {lang === 'ar' ? '← العودة إلى صفحة الشفافية' : '← Back to transparency page'}
        </a>
        <span className="print-toolbar-hint">
          {lang === 'ar'
            ? 'في نافذة الطباعة، اختر "حفظ كـ PDF"'
            : 'In the print dialog, choose "Save as PDF"'}
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
              {lang === 'ar' ? 'مجلس مدينة داريّا — معاً نَبْنِي داريّا' : 'Darayya City Council — Together We Rebuild Darayya'}
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
              <div className="print-stat-label">{lang === 'ar' ? 'عدد المتبرعين' : 'Donors'}</div>
              <div className="print-stat-value">{fmtNum(lang, totalDonors)}</div>
              <div className="print-stat-sub">
                {lang === 'ar' ? 'عبر جميع المشاريع' : 'across all projects'}
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
                <th className="print-table-num">{lang === 'ar' ? 'متبرعون' : 'Donors'}</th>
                <th>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map(p => {
                const pct = p.budgetUSD > 0 ? Math.round((p.raisedUSD / p.budgetUSD) * 100) : 0;
                return (
                  <tr key={p.id}>
                    <td><strong>{loc(lang, p.title)}</strong></td>
                    <td className="print-table-secondary">{loc(lang, p.location)}</td>
                    <td className="print-table-num">{fmtMoney(lang, currency, p.budgetUSD)}</td>
                    <td className="print-table-num">{fmtMoney(lang, currency, p.raisedUSD)}</td>
                    <td className="print-table-num"><strong>{fmtNum(lang, pct)}%</strong></td>
                    <td className="print-table-num">{fmtNum(lang, p.donors)}</td>
                    <td>
                      <span className={`print-status print-status-${p.status}`}>
                        {statusLabel(lang, p.status)}
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
                <td className="print-table-num"><strong>{fmtNum(lang, totalDonors)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </section>

        <footer className="print-footer">
          <p>
            {lang === 'ar'
              ? 'هذا التقرير مُولَّد من البيانات الحالية على المنصة. للتقارير الرسمية المعتمدة، تواصل مع المجلس.'
              : 'This report is generated from current platform data. For official audited reports, contact the council.'}
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
      funding: 'مفتوح للتبرع',
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
