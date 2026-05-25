import { useState } from 'react';
import { t, fmtNum, fmtMoney, type Lang } from '../i18n/strings';

type Project = {
  status: string;
  budgetUSD: number;
  raisedUSD: number;
  donors: number;
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
  const totalRaised = projects.reduce((s, p) => s + p.raisedUSD, 0);
  const totalBudget = projects.reduce((s, p) => s + p.budgetUSD, 0);
  const totalDonors = projects.reduce((s, p) => s + p.donors, 0);
  const completed = projects.filter(p => p.status === 'completed').length;

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
      </div>

      <div className="reports-list">
        {reports.map((r, i) => (
          <div className="report-item" key={i}>
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
          </div>
        ))}
      </div>
    </section>
  );
}
