import { useState, useEffect } from 'react';
import { t, fmtNum, fmtMoney, loc, type Lang } from '../i18n/strings';
import { sumAll, loadDonations } from '../data/demo-donations';

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
};

const REPORTS_AR = [
  { title: 'التقرير المالي الشهري — نيسان ٢٠٢٦', date: 'تم النشر في ١ أيار ٢٠٢٦', size: '٢٫٤ MB', type: 'مالي' },
  { title: 'تقرير المراجعة الخارجية ربع السنوي', date: 'تم النشر في ١٥ نيسان ٢٠٢٦', size: '٥٫١ MB', type: 'مراجعة' },
  { title: 'بيان مفصّل بالمصروفات — آذار ٢٠٢٦', date: 'تم النشر في ٣ نيسان ٢٠٢٦', size: '١٫٨ MB', type: 'مالي' },
  { title: 'تقرير اللجنة المجتمعية المستقلة', date: 'تم النشر في ١ نيسان ٢٠٢٦', size: '٩٠٠ KB', type: 'حوكمة' },
];
const REPORTS_EN = [
  { title: 'Monthly Financial Report — April 2026', date: 'Published May 1, 2026', size: '2.4 MB', type: 'Financial' },
  { title: 'Quarterly External Audit Report',       date: 'Published April 15, 2026', size: '5.1 MB', type: 'Audit' },
  { title: 'Detailed Expenses Statement — March 2026', date: 'Published April 3, 2026', size: '1.8 MB', type: 'Financial' },
  { title: 'Independent Community Committee Report', date: 'Published April 1, 2026', size: '900 KB', type: 'Governance' },
];

export default function TransparencyContent({ projects, lang }: Props) {
  const [currency] = useState<'USD' | 'SYP'>('USD');

  // Pull demo donations into the totals so this browser sees its full
  // contributions reflected. SSR shows just the baseline; values pop in
  // after hydration.
  const [demo, setDemo] = useState<{ amount: number; count: number; uniqueProjects: number }>({
    amount: 0, count: 0, uniqueProjects: 0,
  });
  useEffect(() => {
    setDemo(sumAll());
    const onVis = () => setDemo(sumAll());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const baseRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalRaised = baseRaised + demo.amount;
  const totalBudget = projects.reduce((s, p) => s + p.budgetUSD, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donors, 0) + demo.count;
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
        p.status,
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

  const reports = lang === 'en' ? REPORTS_EN : REPORTS_AR;

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

      <div className="reports-list">
        {reports.map((r, i) => (
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
        ))}
      </div>
      <p className="reports-disclaimer">
        {lang === 'ar'
          ? '★ هذه التقارير المسماة هي عيّنة لما سيكون متاحاً عند إصدار التقارير الرسمية المعتمدة. الضغط عليها ينزّل ملخصاً نصياً مولّداً من البيانات الحالية للمشاريع.'
          : '★ The named reports are samples showing what will be available when official audited reports are published. Clicking downloads a generated text summary based on current project data.'}
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
