import { useState, useEffect, useMemo } from 'react';
import { stringify as stringifyYaml } from 'yaml';
import { t, loc, fmtMoney, type Lang } from '../i18n/strings';
import { commitFile, getFileSha } from '../data/git-gateway';

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

  /* SHA of the file when this editor session started, used to detect
   * concurrent edits. Fetched after auth completes (we need the user's
   * token to read via Git Gateway). For new projects (isNew), stays
   * null — there's no existing file to race against. */
  const [editingSha, setEditingSha] = useState<string | null | undefined>(undefined);

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

  // Once authenticated, fetch the current file SHA so we can detect
  // concurrent edits at save time. For new projects there's nothing to
  // fetch — editingSha stays null and commitFile will create the file.
  useEffect(() => {
    if (auth.kind !== 'authenticated') return;
    if (isNew) {
      setEditingSha(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const path = `src/content/projects/${initial.id}.md`;
        const sha = await getFileSha(path);
        if (!cancelled) setEditingSha(sha);
      } catch {
        // Network/auth failure — fall back to letting commitFile fetch
        // the SHA itself (the old behavior). Worst case is the
        // concurrent-edit detection is disabled for this session.
        if (!cancelled) setEditingSha(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.kind, isNew, initial.id]);

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

      // Concurrent-edit protection: if we have the SHA from when this
      // editor session started, pass it so commitFile can detect that
      // someone else saved in the meantime.
      //
      // editingSha values:
      //   undefined → still loading OR fetch failed (no protection;
      //               fall back to commitFile's own SHA fetch)
      //   null      → file didn't exist at start (new project case)
      //   string    → the SHA to pin against
      //
      // For new projects (isNew) we always let commitFile fetch — there
      // shouldn't be an existing file to pin against, but if there is
      // (unlikely ID collision), we don't want to clobber it silently.
      const sha: string | undefined = isNew
        ? undefined
        : (typeof editingSha === 'string' ? editingSha : undefined);
      await commitFile(path, content, commitMessage, 'main', sha);

      setSave({ kind: 'success' });
      // IMPORTANT: do NOT auto-redirect to the project's public page.
      // Netlify rebuilds take 1-3 minutes after a commit; the new page
      // simply does not exist yet. Instead, the success screen below
      // explains what's happening and gives the user choices.
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
  // If a save just succeeded, show a success screen with options instead
  // of the form. We don't auto-redirect to the project page because Netlify
  // needs 1-3 minutes to rebuild after a commit, and going to the URL too
  // early would 404.
  if (save.kind === 'success') {
    const dashboardHref = returnTo;
    // For edits we also link the public page (which exists, even if its
    // *content* is briefly stale until rebuild). For new projects we don't,
    // because the page genuinely doesn't exist yet.
    const publicHref = isNew ? null : `${basePath}/projects/${state.id}/`;
    return (
      <section className="editor-section">
        <div className="editor-success-card">
          <div className="editor-success-icon">✓</div>
          <h2>
            {isNew
              ? (lang === 'ar' ? 'تم إنشاء المشروع' : 'Project created')
              : (lang === 'ar' ? 'تم حفظ التغييرات' : 'Changes saved')}
          </h2>
          <p>
            {lang === 'ar'
              ? <>تم حفظ <strong>{state.title.ar || state.id}</strong> في المستودع بنجاح.</>
              : <>Saved <strong>{state.title.ar || state.id}</strong> to the repository.</>}
          </p>
          <div className="editor-success-build-note">
            <span className="editor-success-build-spinner">⟳</span>
            <span>
              {lang === 'ar'
                ? 'الموقع يُعاد بناؤه الآن. ستظهر التغييرات خلال ١–٣ دقائق.'
                : 'The site is rebuilding now. Changes will appear in 1–3 minutes.'}
            </span>
          </div>
          <div className="editor-success-actions">
            <a href={dashboardHref} className="btn-primary">
              {lang === 'ar' ? '← العودة إلى لوحة المجلس' : '← Back to dashboard'}
            </a>
            {publicHref && (
              <a href={publicHref} className="btn-secondary" target="_blank" rel="noopener noreferrer">
                {lang === 'ar' ? 'فتح صفحة المشروع (قد تكون قديمة قليلاً)' : 'Open project page (may be briefly stale)'}
              </a>
            )}
            {isNew && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.location.reload()}
              >
                {lang === 'ar' ? '+ إنشاء مشروع آخر' : '+ Create another project'}
              </button>
            )}
          </div>
          <p className="editor-success-hint">
            {lang === 'ar'
              ? '★ يستغرق Netlify دقيقة إلى ثلاث لإعادة بناء الموقع بعد كل حفظ. لا حاجة للضغط على «حفظ» مرة أخرى.'
              : '★ Netlify takes 1–3 minutes to rebuild after each save. No need to click Save again.'}
          </p>
        </div>
      </section>
    );
  }

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
            disabled={save.kind === 'saving'}
          >
            {save.kind === 'saving' && (lang === 'ar' ? 'جاري الحفظ…' : 'Saving…')}
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

      {/* Map coordinates — small section because most projects use the default */}
      <div className="editor-card">
        <h3 className="editor-card-title">
          <span className="editor-card-icon">📍</span>
          {lang === 'ar' ? 'إحداثيات الموقع' : 'Map coordinates'}
        </h3>
        <p className="editor-field-hint" style={{ marginTop: 0, marginBottom: '0.85rem' }}>
          {lang === 'ar'
            ? 'القيم الافتراضية تشير إلى مركز داريّا. عدّلها إذا كان المشروع في موقع محدد.'
            : 'Defaults point to the center of Darayya. Change them if the project has a specific location.'}
        </p>
        <div className="editor-row">
          <div className="editor-field editor-field-half">
            <label>{lang === 'ar' ? 'خط العرض (Latitude)' : 'Latitude'}</label>
            <input
              type="number"
              step="0.0001"
              className="editor-number-input"
              value={state.lat}
              onChange={(e) => update('lat', parseFloat(e.target.value) || 33.45)}
            />
          </div>
          <div className="editor-field editor-field-half">
            <label>{lang === 'ar' ? 'خط الطول (Longitude)' : 'Longitude'}</label>
            <input
              type="number"
              step="0.0001"
              className="editor-number-input"
              value={state.lng}
              onChange={(e) => update('lng', parseFloat(e.target.value) || 36.25)}
            />
          </div>
        </div>
      </div>

      {/* Sub-projects — the bands of work that make up the whole project */}
      <div className="editor-card">
        <h3 className="editor-card-title">
          <span className="editor-card-icon">◆</span>
          {lang === 'ar' ? 'المشاريع الفرعية والبنود' : 'Sub-projects & line items'}
        </h3>
        <p className="editor-field-hint" style={{ marginTop: 0, marginBottom: '0.85rem' }}>
          {lang === 'ar'
            ? 'قسّم المشروع إلى بنود تنفيذية. كل بند له ميزانية مستقلة وشريط تقدم خاص. المتبرعون يمكنهم اختيار التبرع لبند محدد.'
            : 'Split the project into executable line items. Each has its own budget and progress bar. Donors can choose to fund a specific item.'}
        </p>
        {state.subs.length === 0 && (
          <p className="editor-empty-note">
            {lang === 'ar' ? 'لا توجد بنود فرعية بعد.' : 'No sub-projects yet.'}
          </p>
        )}
        {state.subs.map((s, i) => (
          <div key={i} className="editor-list-item">
            <div className="editor-list-item-head">
              <input
                type="text"
                className="editor-text-input editor-id-input"
                value={s.id}
                placeholder="id (e.g. paving)"
                onChange={(e) => {
                  const next = [...state.subs];
                  next[i] = { ...s, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30) };
                  update('subs', next);
                }}
              />
              <button
                type="button"
                className="editor-remove-btn"
                onClick={() => update('subs', state.subs.filter((_, j) => j !== i))}
                aria-label={lang === 'ar' ? 'حذف' : 'Delete'}
              >
                ✕
              </button>
            </div>
            <BilingualField
              label={lang === 'ar' ? 'اسم البند' : 'Item name'}
              value={s.title}
              onChange={(side, v) => {
                const next = [...state.subs];
                next[i] = { ...s, title: { ...s.title, [side]: v } };
                update('subs', next);
              }}
              arPlaceholder={lang === 'ar' ? 'مثلاً: تزفيت الشارع' : ''}
            />
            <BilingualField
              label={lang === 'ar' ? 'الكمية/الطول' : 'Quantity/length'}
              value={s.length}
              onChange={(side, v) => {
                const next = [...state.subs];
                next[i] = { ...s, length: { ...s.length, [side]: v } };
                update('subs', next);
              }}
              arPlaceholder={lang === 'ar' ? 'مثلاً: ٣٠٠ متر' : ''}
            />
            <div className="editor-row">
              <div className="editor-field editor-field-half">
                <label>{lang === 'ar' ? 'الميزانية USD' : 'Budget USD'}</label>
                <input
                  type="number"
                  className="editor-number-input"
                  min={1}
                  value={s.budgetUSD}
                  onChange={(e) => {
                    const next = [...state.subs];
                    next[i] = { ...s, budgetUSD: Math.max(0, parseInt(e.target.value, 10) || 0) };
                    update('subs', next);
                  }}
                />
              </div>
              <div className="editor-field editor-field-half">
                <label>{lang === 'ar' ? 'المحصّل USD' : 'Raised USD'}</label>
                <input
                  type="number"
                  className="editor-number-input"
                  min={0}
                  value={s.raisedUSD}
                  onChange={(e) => {
                    const next = [...state.subs];
                    next[i] = { ...s, raisedUSD: Math.max(0, parseInt(e.target.value, 10) || 0) };
                    update('subs', next);
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="editor-add-btn"
          onClick={() => update('subs', [
            ...state.subs,
            {
              id: `item-${state.subs.length + 1}`,
              title: { ar: '', en: '' },
              length: { ar: '', en: '' },
              budgetUSD: 1000,
              raisedUSD: 0,
            },
          ])}
        >
          + {lang === 'ar' ? 'إضافة بند فرعي' : 'Add sub-project'}
        </button>
      </div>

      {/* Engineers & team */}
      <div className="editor-card">
        <h3 className="editor-card-title">
          <span className="editor-card-icon">👷</span>
          {lang === 'ar' ? 'الفريق والمهندسون' : 'Engineers & team'}
        </h3>
        {state.engineers.length === 0 && (
          <p className="editor-empty-note">
            {lang === 'ar' ? 'لا يوجد أعضاء فريق بعد.' : 'No team members yet.'}
          </p>
        )}
        {state.engineers.map((e, i) => (
          <div key={i} className="editor-list-item">
            <div className="editor-list-item-head">
              <BilingualField
                label={lang === 'ar' ? 'الاسم' : 'Name'}
                value={e.name}
                onChange={(side, v) => {
                  const next = [...state.engineers];
                  next[i] = { ...e, name: { ...e.name, [side]: v } };
                  update('engineers', next);
                }}
                arPlaceholder={lang === 'ar' ? 'مثلاً: م. أحمد' : ''}
              />
              <button
                type="button"
                className="editor-remove-btn"
                onClick={() => update('engineers', state.engineers.filter((_, j) => j !== i))}
                aria-label={lang === 'ar' ? 'حذف' : 'Delete'}
              >
                ✕
              </button>
            </div>
            <BilingualField
              label={lang === 'ar' ? 'الدور / التخصص' : 'Role / discipline'}
              value={e.role}
              onChange={(side, v) => {
                const next = [...state.engineers];
                next[i] = { ...e, role: { ...e.role, [side]: v } };
                update('engineers', next);
              }}
              arPlaceholder={lang === 'ar' ? 'مثلاً: مهندس مدني' : ''}
            />
            <div className="editor-row">
              <div className="editor-field editor-field-half">
                <label>{lang === 'ar' ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}</label>
                <input
                  type="email"
                  className="editor-text-input"
                  dir="ltr"
                  value={e.email || ''}
                  onChange={(ev) => {
                    const next = [...state.engineers];
                    next[i] = { ...e, email: ev.target.value };
                    update('engineers', next);
                  }}
                />
              </div>
              <div className="editor-field editor-field-half">
                <label>{lang === 'ar' ? 'الهاتف (اختياري)' : 'Phone (optional)'}</label>
                <input
                  type="tel"
                  className="editor-text-input"
                  dir="ltr"
                  value={e.phone || ''}
                  onChange={(ev) => {
                    const next = [...state.engineers];
                    next[i] = { ...e, phone: ev.target.value };
                    update('engineers', next);
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="editor-add-btn"
          onClick={() => update('engineers', [
            ...state.engineers,
            { name: { ar: '', en: '' }, role: { ar: '', en: '' }, email: '', phone: '' },
          ])}
        >
          + {lang === 'ar' ? 'إضافة عضو فريق' : 'Add team member'}
        </button>
      </div>

      {/* Field updates (dated) — different from comments; these go on the timeline */}
      <div className="editor-card">
        <h3 className="editor-card-title">
          <span className="editor-card-icon">📰</span>
          {lang === 'ar' ? 'التحديثات الميدانية' : 'Field updates'}
        </h3>
        <p className="editor-field-hint" style={{ marginTop: 0, marginBottom: '0.85rem' }}>
          {lang === 'ar'
            ? 'تظهر هذه التحديثات في الجدول الزمني على صفحة المشروع. استخدمها لإعلام المتبرعين بالتقدم.'
            : 'These appear in the timeline on the project page. Use them to inform donors of progress.'}
        </p>
        {state.updates.length === 0 && (
          <p className="editor-empty-note">
            {lang === 'ar' ? 'لا توجد تحديثات بعد.' : 'No updates yet.'}
          </p>
        )}
        {state.updates.map((u, i) => (
          <div key={i} className="editor-list-item">
            <div className="editor-list-item-head">
              <BilingualField
                label={lang === 'ar' ? 'الكاتب' : 'Author'}
                value={u.author}
                onChange={(side, v) => {
                  const next = [...state.updates];
                  next[i] = { ...u, author: { ...u.author, [side]: v } };
                  update('updates', next);
                }}
                arPlaceholder={lang === 'ar' ? 'مثلاً: رئيس بلدية داريا' : ''}
              />
              <button
                type="button"
                className="editor-remove-btn"
                onClick={() => update('updates', state.updates.filter((_, j) => j !== i))}
                aria-label={lang === 'ar' ? 'حذف' : 'Delete'}
              >
                ✕
              </button>
            </div>
            <BilingualField
              label={lang === 'ar' ? 'التاريخ (نص حر)' : 'Date (free text)'}
              value={u.date}
              onChange={(side, v) => {
                const next = [...state.updates];
                next[i] = { ...u, date: { ...u.date, [side]: v } };
                update('updates', next);
              }}
              arPlaceholder={lang === 'ar' ? 'مثلاً: ١٥ نيسان ٢٠٢٦' : ''}
              enPlaceholder="e.g. April 15, 2026"
            />
            <BilingualField
              label={lang === 'ar' ? 'نص التحديث' : 'Update text'}
              value={u.body}
              onChange={(side, v) => {
                const next = [...state.updates];
                next[i] = { ...u, body: { ...u.body, [side]: v } };
                update('updates', next);
              }}
              arPlaceholder={lang === 'ar' ? 'ماذا حدث على الأرض؟' : ''}
              multiline
            />
          </div>
        ))}
        <button
          type="button"
          className="editor-add-btn"
          onClick={() => update('updates', [
            ...state.updates,
            {
              date: { ar: lang === 'ar' ? 'اليوم' : '', en: lang === 'ar' ? '' : 'Today' },
              author: { ar: (auth as any).user?.user_metadata?.full_name || (auth as any).user?.email || '', en: '' },
              body: { ar: '', en: '' },
            },
          ])}
        >
          + {lang === 'ar' ? 'إضافة تحديث ميداني' : 'Add field update'}
        </button>
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

      {/* Pointer to classic editor — now only useful for photo uploads,
          which we still defer to Decap because they need file upload UI
          and atomic image+frontmatter commits. */}
      {!isNew && (
        <div className="editor-advanced-note">
          <p>
            {lang === 'ar'
              ? 'لرفع صور للمشروع (يتطلب رفع ملفات):'
              : 'To upload photos for this project (requires file upload):'}
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
              ? '★ يمكنك إضافة كل التفاصيل هنا. الصور تُرفع لاحقاً عبر المحرر الكلاسيكي.'
              : '★ You can add all details here. Photos are uploaded later via the classic editor.'}
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
