import { useState, useEffect, useMemo } from 'react';
import { stringify as stringifyYaml } from 'yaml';
import { t, loc, fmtMoney, type Lang } from '../i18n/strings';
import { commitFile } from '../data/git-gateway';

// ────────────────────────────────────────────────────────────────────
// Types — mirror the Zod schema so the form state matches what gets
// written back to the Markdown frontmatter
// ────────────────────────────────────────────────────────────────────

type Bilingual = { ar: string; en: string };

type Sub = {
  id: string;
  title: Bilingual;
  length: Bilingual;
  budgetUSD: number;
  raisedUSD: number;
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

type Update = {
  date: Bilingual;
  author: Bilingual;
  body: Bilingual;
};

export type ProjectFormState = {
  id: string;
  order: number;
  featured: boolean;
  category: 'roads' | 'water' | 'sewer' | 'lighting' | 'communications' | 'facilities';
  status: 'funding' | 'active' | 'completed' | 'planning';
  health: 'healthy' | 'warning' | 'stalled' | 'completed';
  title: Bilingual;
  location: Bilingual;
  description: Bilingual;
  budgetUSD: number;
  raisedUSD: number;
  donors: number;
  daysLeft: number;
  lat: number;
  lng: number;
  subs: Sub[];
  updates: Update[];
  engineers: Engineer[];
  comments: Comment[];
};

type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; user: { email: string; user_metadata?: { full_name?: string } } };

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

type Props = {
  initial: ProjectFormState;
  lang: Lang;
  basePath: string;
  /** Where to send the user after a successful save */
  returnTo: string;
  /** True when creating a new project rather than editing an existing one */
  isNew?: boolean;
};

// ────────────────────────────────────────────────────────────────────
// Status / health / category configurations — match the public site
// ────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: ProjectFormState['status']; ar: string; en: string; emoji: string }> = [
  { value: 'funding',   ar: 'مفتوح للتبرع', en: 'Open for funding', emoji: '🟡' },
  { value: 'active',    ar: 'قيد التنفيذ',   en: 'Active',           emoji: '🟢' },
  { value: 'completed', ar: 'مكتمل',         en: 'Completed',        emoji: '⚫' },
  { value: 'planning',  ar: 'قيد التخطيط',   en: 'Planning',         emoji: '⚪' },
];

const HEALTH_OPTIONS: Array<{ value: ProjectFormState['health']; ar: string; en: string; emoji: string }> = [
  { value: 'healthy',   ar: 'يسير بشكل ممتاز', en: 'Healthy',   emoji: '🟢' },
  { value: 'warning',   ar: 'يحتاج متابعة',     en: 'Warning',   emoji: '🟡' },
  { value: 'stalled',   ar: 'متعثّر',           en: 'Stalled',   emoji: '🔴' },
  { value: 'completed', ar: 'مكتمل',            en: 'Completed', emoji: '⚫' },
];

const CATEGORY_OPTIONS: Array<{ value: ProjectFormState['category']; ar: string; en: string; emoji: string }> = [
  { value: 'roads',          ar: 'الطرقات والتعبيد', en: 'Roads',          emoji: '🛣️' },
  { value: 'water',          ar: 'المياه النظيفة',    en: 'Water',          emoji: '💧' },
  { value: 'sewer',          ar: 'الصرف الصحي',      en: 'Sewer',          emoji: '🚿' },
  { value: 'lighting',       ar: 'الإنارة',           en: 'Lighting',       emoji: '💡' },
  { value: 'communications', ar: 'الاتصالات',         en: 'Communications', emoji: '📡' },
  { value: 'facilities',     ar: 'المرافق العامة',    en: 'Facilities',     emoji: '🏛️' },
];

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────

export default function ProjectEditor({ initial, lang, basePath, returnTo, isNew = false }: Props) {
  const [state, setState] = useState<ProjectFormState>(initial);
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [showSubItems, setShowSubItems] = useState(initial.subs.length > 0);

  // Auth setup
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const max = 40;
    const init = () => {
      if (cancelled) return;
      const ni = (window as any).netlifyIdentity;
      if (!ni) {
        if (++tries < max) setTimeout(init, 100);
        else setAuth({ kind: 'anonymous' });
        return;
      }
      try { ni.init(); } catch {}
      const user = ni.currentUser();
      setAuth(user ? { kind: 'authenticated', user } : { kind: 'anonymous' });
      ni.on('login', (u: any) => setAuth({ kind: 'authenticated', user: u }));
      ni.on('logout', () => setAuth({ kind: 'anonymous' }));
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Computed values for the budget slider
  const budgetMax = useMemo(() => {
    return Math.max(state.budgetUSD * 1.5, 1000);
  }, [state.budgetUSD]);

  const pct = state.budgetUSD > 0
    ? Math.min(100, Math.round((state.raisedUSD / state.budgetUSD) * 100))
    : 0;

  // ──────────────────────────────────────────────────────────────────
  // Form helpers
  // ──────────────────────────────────────────────────────────────────

  function update<K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function updateBilingual(key: 'title' | 'location' | 'description', subkey: 'ar' | 'en', value: string) {
    setState((s) => ({ ...s, [key]: { ...s[key], [subkey]: value } }));
  }

  // ──────────────────────────────────────────────────────────────────
  // Save — serialize state to Markdown frontmatter and commit
  // ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (auth.kind !== 'authenticated') {
      const ni = (window as any).netlifyIdentity;
      if (ni) ni.open();
      return;
    }

    setSave({ kind: 'saving' });

    try {
      // Validate when creating new
      if (isNew) {
        const idOk = /^[a-z0-9][a-z0-9-]{2,40}$/.test(state.id);
        if (!idOk) {
          setSave({
            kind: 'error',
            message: lang === 'ar'
              ? 'المعرف غير صالح. يجب أن يحتوي على ٣–٤٠ حرفاً، أحرف إنجليزية صغيرة وأرقام وشرطات فقط.'
              : 'Invalid ID. Must be 3–40 characters, lowercase letters / numbers / hyphens only.',
          });
          return;
        }
        if (!state.title.ar.trim()) {
          setSave({
            kind: 'error',
            message: lang === 'ar' ? 'الاسم العربي مطلوب.' : 'Arabic title is required.',
          });
          return;
        }
        if (state.budgetUSD <= 0) {
          setSave({
            kind: 'error',
            message: lang === 'ar' ? 'الميزانية يجب أن تكون أكبر من صفر.' : 'Budget must be greater than zero.',
          });
          return;
        }
      }

      // Build the frontmatter object matching the existing project file shape
      const frontmatter: Record<string, unknown> = {
        id: state.id,
        order: state.order,
        featured: state.featured,
        category: state.category,
        status: state.status,
        health: state.health,
        title: state.title,
        location: state.location,
        description: state.description,
        budgetUSD: state.budgetUSD,
        raisedUSD: state.raisedUSD,
        donors: state.donors,
        daysLeft: state.daysLeft,
        lat: state.lat,
        lng: state.lng,
      };
      if (state.subs.length > 0) frontmatter.subs = state.subs;
      if (state.updates.length > 0) frontmatter.updates = state.updates;
      if (state.engineers.length > 0) frontmatter.engineers = state.engineers;
      if (state.comments.length > 0) frontmatter.comments = state.comments;

      const yamlBlock = stringifyYaml(frontmatter, {
        lineWidth: 0,
        defaultStringType: 'QUOTE_DOUBLE',
      });
      const content = `---\n${yamlBlock}---\n`;

      const path = `src/content/projects/${state.id}.md`;
      const commitMessage = isNew
        ? (lang === 'ar' ? `إنشاء مشروع: ${state.title.ar}` : `Create project: ${state.title.ar}`)
        : (lang === 'ar' ? `تعديل المشروع: ${state.title.ar}` : `Edit project: ${state.title.ar}`);

      await commitFile(path, content, commitMessage);

      setSave({ kind: 'success' });
      // After a successful create, redirect to the new project's public page
      // so the clerk sees the result. After edit, go back to the dashboard.
      setTimeout(() => {
        if (isNew) {
          window.location.href = `${basePath}/projects/${state.id}/`;
        } else {
          window.location.href = returnTo;
        }
      }, 1500);
    } catch (err: any) {
      setSave({ kind: 'error', message: err?.message || 'Save failed' });
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────

  // Anonymous gate — show a sign-in CTA
  if (auth.kind === 'anonymous') {
    return (
      <section className="editor-section">
        <div className="editor-auth-gate">
          <div className="editor-auth-card">
            <h2>{lang === 'ar' ? 'تسجيل الدخول مطلوب' : 'Sign in required'}</h2>
            <p>{lang === 'ar'
              ? 'لتعديل المشاريع يجب أن تكون مسجلاً كعضو في المجلس.'
              : 'You must be signed in as a council member to edit projects.'}</p>
            <button
              className="btn-primary"
              onClick={() => { const ni = (window as any).netlifyIdentity; if (ni) ni.open(); }}
            >
              {lang === 'ar' ? 'تسجيل الدخول' : 'Sign in'}
            </button>
            <p className="editor-auth-fallback">
              <a href={`/admin/#/collections/projects/entries/${state.id}`}>
                ← {lang === 'ar' ? 'فتح في المحرر الكلاسيكي' : 'Open in classic editor'}
              </a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (auth.kind === 'loading') {
    return (
      <section className="editor-section">
        <div className="editor-loading">{lang === 'ar' ? 'جاري التحميل…' : 'Loading…'}</div>
      </section>
    );
  }

  // Authenticated — render the editor
  return (
    <section className="editor-section">
      {/* Sticky save bar at top */}
      <div className="editor-save-bar">
        <div className="editor-save-bar-left">
          <a href={returnTo} className="editor-back-link">
            ← {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </a>
          <span className="editor-title-preview">
            {isNew
              ? (lang === 'ar' ? 'مشروع جديد' : 'New project')
              : (loc(lang, state.title) || state.id)}
          </span>
        </div>
        <div className="editor-save-bar-right">
          {!isNew && (
            <a
              href={`/admin/#/collections/projects/entries/${state.id}`}
              className="editor-classic-link"
              title={lang === 'ar' ? 'فتح في Decap CMS لتعديل الحقول المتقدمة' : 'Open in Decap CMS for advanced fields'}
            >
              {lang === 'ar' ? 'المحرر الكلاسيكي' : 'Classic editor'} →
            </a>
          )}
          <button
            className="editor-save-btn"
            onClick={handleSave}
            disabled={save.kind === 'saving' || save.kind === 'success'}
          >
            {save.kind === 'saving' && (lang === 'ar' ? 'جاري الحفظ…' : 'Saving…')}
            {save.kind === 'success' && (lang === 'ar' ? '✓ تم الحفظ' : '✓ Saved')}
            {(save.kind === 'idle' || save.kind === 'error') && (
              isNew
                ? (lang === 'ar' ? 'إنشاء ونشر' : 'Create & publish')
                : (lang === 'ar' ? 'حفظ ونشر' : 'Save & publish')
            )}
          </button>
        </div>
        {save.kind === 'error' && (
          <div className="editor-save-error">⚠ {save.message}</div>
        )}
      </div>

      {/* ID picker — only when creating */}
      {isNew && (
        <div className="editor-card">
          <h3 className="editor-card-title">
            <span className="editor-card-icon">#</span>
            {lang === 'ar' ? 'معرف المشروع' : 'Project ID'}
          </h3>
          <div className="editor-field">
            <label>{lang === 'ar' ? 'المعرف (يستخدم في الرابط)' : 'ID (used in the URL)'}</label>
            <input
              type="text"
              className="editor-text-input"
              dir="ltr"
              value={state.id}
              onChange={(e) => update('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
              placeholder="e.g. roads-jalaa, water-east"
              maxLength={40}
            />
            <p className="editor-field-hint">
              {lang === 'ar'
                ? 'أحرف إنجليزية صغيرة وأرقام وشرطات فقط. مثال: roads-jalaa. لا يمكن تغييره بعد الإنشاء.'
                : 'Lowercase letters, numbers and hyphens only. E.g. roads-jalaa. Cannot be changed after creation.'}
            </p>
          </div>
        </div>
      )}

      {/* Title + description card */}
      <div className="editor-card">
        <h3 className="editor-card-title">
          <span className="editor-card-icon">★</span>
          {lang === 'ar' ? 'الاسم والوصف' : 'Name & description'}
        </h3>
        <BilingualField
          label={lang === 'ar' ? 'اسم المشروع' : 'Project name'}
          value={state.title}
          onChange={(side, v) => updateBilingual('title', side, v)}
          arPlaceholder="مثلاً: تأهيل شارع الجلاء الرئيسي"
          enPlaceholder="(optional)"
        />
        <BilingualField
          label={lang === 'ar' ? 'الموقع' : 'Location'}
          value={state.location}
          onChange={(side, v) => updateBilingual('location', side, v)}
          arPlaceholder="مثلاً: الحي الشرقي — داريّا"
          enPlaceholder="(optional)"
        />
        <BilingualField
          label={lang === 'ar' ? 'الوصف' : 'Description'}
          value={state.description}
          onChange={(side, v) => updateBilingual('description', side, v)}
          arPlaceholder="جملتان أو ثلاث: ماذا سيُبنى، لمن، وما الفائدة"
          enPlaceholder="(optional)"
          multiline
        />
      </div>

      {/* Category + status + health pills */}
      <div className="editor-card">
        <h3 className="editor-card-title">
          <span className="editor-card-icon">◆</span>
          {lang === 'ar' ? 'التصنيف والحالة' : 'Classification & status'}
        </h3>

        <div className="editor-field">
          <label>{lang === 'ar' ? 'القطاع' : 'Category'}</label>
          <div className="editor-pills">
            {CATEGORY_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={`editor-pill ${state.category === o.value ? 'active' : ''}`}
                onClick={() => update('category', o.value)}
              >
                <span className="editor-pill-emoji">{o.emoji}</span>
                {lang === 'ar' ? o.ar : o.en}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-field">
          <label>{lang === 'ar' ? 'حالة المشروع' : 'Status'}</label>
          <div className="editor-pills">
            {STATUS_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={`editor-pill editor-pill-status-${o.value} ${state.status === o.value ? 'active' : ''}`}
                onClick={() => update('status', o.value)}
              >
                <span className="editor-pill-emoji">{o.emoji}</span>
                {lang === 'ar' ? o.ar : o.en}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-field">
          <label>{lang === 'ar' ? 'صحة المشروع' : 'Health'}</label>
          <div className="editor-pills">
            {HEALTH_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={`editor-pill editor-pill-health-${o.value} ${state.health === o.value ? 'active' : ''}`}
                onClick={() => update('health', o.value)}
              >
                <span className="editor-pill-emoji">{o.emoji}</span>
                {lang === 'ar' ? o.ar : o.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Money: budget + raised with slider */}
      <div className="editor-card">
        <h3 className="editor-card-title">
          <span className="editor-card-icon">💰</span>
          {lang === 'ar' ? 'التمويل' : 'Funding'}
        </h3>

        <div className="editor-field">
          <label>{lang === 'ar' ? 'الميزانية المطلوبة (دولار)' : 'Budget (USD)'}</label>
          <div className="editor-slider-row">
            <input
              type="number"
              className="editor-number-input"
              value={state.budgetUSD}
              onChange={(e) => update('budgetUSD', Math.max(0, parseInt(e.target.value, 10) || 0))}
              min={0}
            />
            <input
              type="range"
              className="editor-slider"
              min={0}
              max={budgetMax}
              step={500}
              value={state.budgetUSD}
              onChange={(e) => update('budgetUSD', parseInt(e.target.value, 10))}
            />
          </div>
        </div>

        <div className="editor-field">
          <label>{lang === 'ar' ? 'المبلغ المحصّل (دولار)' : 'Raised (USD)'}</label>
          <div className="editor-slider-row">
            <input
              type="number"
              className="editor-number-input"
              value={state.raisedUSD}
              onChange={(e) => update('raisedUSD', Math.max(0, parseInt(e.target.value, 10) || 0))}
              min={0}
              max={state.budgetUSD}
            />
            <input
              type="range"
              className="editor-slider"
              min={0}
              max={Math.max(state.budgetUSD, 1)}
              step={100}
              value={Math.min(state.raisedUSD, state.budgetUSD)}
              onChange={(e) => update('raisedUSD', parseInt(e.target.value, 10))}
            />
          </div>
          {/* Live progress preview */}
          <div className="editor-progress">
            <div className="editor-progress-track">
              <div className="editor-progress-fill" style={{ width: `${pct}%` }}></div>
            </div>
            <span className="editor-progress-label">
              {pct}% {lang === 'ar' ? 'ممول' : 'funded'}
            </span>
          </div>
        </div>

        <div className="editor-row">
          <div className="editor-field editor-field-half">
            <label>{lang === 'ar' ? 'عدد المتبرعين' : 'Donor count'}</label>
            <input
              type="number"
              className="editor-number-input"
              value={state.donors}
              onChange={(e) => update('donors', Math.max(0, parseInt(e.target.value, 10) || 0))}
              min={0}
            />
          </div>
          <div className="editor-field editor-field-half">
            <label>{lang === 'ar' ? 'الأيام المتبقية' : 'Days left'}</label>
            <input
              type="number"
              className="editor-number-input"
              value={state.daysLeft}
              onChange={(e) => update('daysLeft', Math.max(0, parseInt(e.target.value, 10) || 0))}
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Comments — quick add/remove */}
      <div className="editor-card">
        <h3 className="editor-card-title">
          <span className="editor-card-icon">💬</span>
          {lang === 'ar' ? 'الملاحظات والتعليقات' : 'Comments'}
        </h3>
        {state.comments.length === 0 && (
          <p className="editor-empty-note">
            {lang === 'ar' ? 'لا توجد ملاحظات بعد.' : 'No comments yet.'}
          </p>
        )}
        {state.comments.map((c, i) => (
          <div key={i} className="editor-list-item">
            <div className="editor-list-item-head">
              <input
                type="text"
                className="editor-text-input"
                value={c.author.ar}
                placeholder={lang === 'ar' ? 'الكاتب (بالعربية)' : 'Author (Arabic)'}
                onChange={(e) => {
                  const newComments = [...state.comments];
                  newComments[i] = { ...c, author: { ...c.author, ar: e.target.value } };
                  update('comments', newComments);
                }}
              />
              <input
                type="text"
                className="editor-text-input editor-date-input"
                value={c.date || ''}
                placeholder="YYYY-MM-DD"
                onChange={(e) => {
                  const newComments = [...state.comments];
                  newComments[i] = { ...c, date: e.target.value };
                  update('comments', newComments);
                }}
              />
              <button
                type="button"
                className="editor-remove-btn"
                onClick={() => update('comments', state.comments.filter((_, j) => j !== i))}
                aria-label={lang === 'ar' ? 'حذف' : 'Delete'}
              >
                ✕
              </button>
            </div>
            <textarea
              className="editor-textarea"
              value={c.body.ar}
              placeholder={lang === 'ar' ? 'نص الملاحظة' : 'Note text'}
              rows={2}
              onChange={(e) => {
                const newComments = [...state.comments];
                newComments[i] = { ...c, body: { ...c.body, ar: e.target.value } };
                update('comments', newComments);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="editor-add-btn"
          onClick={() => update('comments', [
            ...state.comments,
            {
              author: { ar: (auth as any).user.user_metadata?.full_name || (auth as any).user.email, en: '' },
              body: { ar: '', en: '' },
              date: new Date().toISOString().slice(0, 10),
            },
          ])}
        >
          + {lang === 'ar' ? 'إضافة ملاحظة' : 'Add comment'}
        </button>
      </div>

      {/* Pointer to classic editor for advanced fields */}
      {!isNew && (
        <div className="editor-advanced-note">
          <p>
            {lang === 'ar'
              ? 'للتعديلات المتقدمة (المشاريع الفرعية، الفريق، الصور، الإحداثيات، التحديثات الميدانية المؤرّخة):'
              : 'For advanced fields (sub-projects, team, photos, coordinates, dated field updates):'}
          </p>
          <a
            href={`/admin/#/collections/projects/entries/${state.id}`}
            className="editor-classic-link-big"
          >
            {lang === 'ar' ? '⚙ افتح المحرر الكلاسيكي' : '⚙ Open classic editor'} →
          </a>
        </div>
      )}
      {isNew && (
        <div className="editor-advanced-note">
          <p>
            {lang === 'ar'
              ? '★ بعد إنشاء المشروع، يمكنك العودة لإضافة المشاريع الفرعية، الفريق، الصور، والمزيد من التفاصيل.'
              : '★ After creating the project, you can come back to add sub-projects, team members, photos, and more details.'}
          </p>
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function BilingualField({
  label,
  value,
  onChange,
  arPlaceholder,
  enPlaceholder,
  multiline = false,
}: {
  label: string;
  value: Bilingual;
  onChange: (side: 'ar' | 'en', v: string) => void;
  arPlaceholder?: string;
  enPlaceholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="editor-field">
      <label>{label}</label>
      <div className="editor-bilingual-row">
        <div className="editor-bilingual-col">
          <span className="editor-bilingual-flag">★ AR</span>
          {multiline ? (
            <textarea
              className="editor-textarea"
              dir="rtl"
              value={value.ar}
              onChange={(e) => onChange('ar', e.target.value)}
              placeholder={arPlaceholder}
              rows={3}
            />
          ) : (
            <input
              type="text"
              className="editor-text-input"
              dir="rtl"
              value={value.ar}
              onChange={(e) => onChange('ar', e.target.value)}
              placeholder={arPlaceholder}
            />
          )}
        </div>
        <div className="editor-bilingual-col">
          <span className="editor-bilingual-flag editor-bilingual-flag-optional">EN (optional)</span>
          {multiline ? (
            <textarea
              className="editor-textarea"
              dir="ltr"
              value={value.en}
              onChange={(e) => onChange('en', e.target.value)}
              placeholder={enPlaceholder}
              rows={3}
            />
          ) : (
            <input
              type="text"
              className="editor-text-input"
              dir="ltr"
              value={value.en}
              onChange={(e) => onChange('en', e.target.value)}
              placeholder={enPlaceholder}
            />
          )}
        </div>
      </div>
    </div>
  );
}
