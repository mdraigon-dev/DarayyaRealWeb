import { useState, useEffect, useMemo, useRef } from 'react';
import { t, loc, fmtMoney, fmtNum, type Lang } from '../i18n/strings';
import { commitProjectFile, loadProjectForEdit } from '../data/project-file-edit';
import { loadPrefs, defaultPrefs, preferredAuthorName, type AdminPrefs } from '../data/admin-prefs';
import { loadDirectory, useStaff, type TeamMember } from '../data/team-directory';
import StaffAccountSelect from './StaffAccountSelect';
import { atForPickedDay, localToday } from '../data/time';
import LocationPicker from './LocationPicker';
import AccessNotice from './AccessNotice';
import { can, type AuthUser } from '../data/permissions';
import { saveErrorMessage, GitConflictError } from '../data/repo';
import { identityStarted } from '../data/identity-ready';

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
  /** Optional public contact number */
  phone?: string;
  /** Identity account that may post on the project */
  userId?: string;
  /**
   * Legacy: an entry saved before accounts were linked by ID. Never shown or
   * edited; kept on save only so that person keeps access until the
   * "Link existing project teams" migration replaces it with a userId.
   */
  email?: string;
};

type Comment = {
  author: Bilingual;
  body: Bilingual;
  at?: string;
  /** legacy */
  date?: string;
};

type Update = {
  at?: string;
  /** legacy free-text date */
  date?: Bilingual;
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
  /** Optional funding deadline, YYYY-MM-DD ('' = none) */
  deadline: string;
  /** Government funding: a label and a public note (see src/data/gov-funding.ts) */
  govFunding: { type: 'none' | 'partial' | 'full'; note: Bilingual };
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
  | { kind: 'authenticated'; user: AuthUser };

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
  { value: 'funding',   ar: 'مفتوح للتمويل', en: 'Open for funding', emoji: '🟡' },
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
  // The total as written in the project file, kept only to spot a total that
  // disagrees with the line items (see the notice in the Funding card).
  const [recordedBudget, setRecordedBudget] = useState<number>(initial.budgetUSD);

  /* SHA of the file when this editor session started, used to detect
   * concurrent edits. Fetched after auth completes (we need the user's
   * token to read via Git Gateway). For new projects (isNew), stays
   * null — there's no existing file to race against. */
  const [editingSha, setEditingSha] = useState<string | null | undefined>(undefined);
  const [prefs, setPrefs] = useState<AdminPrefs>(defaultPrefs());

  // The project file as it is in the repo right now. Saving starts from this
  // and overlays only the fields this form edits, so everything else — photos,
  // the fund log, fields added later — survives an edit. (Before, the form
  // rebuilt the file from its own fields and silently dropped all photos.)
  const liveRef = useRef<Record<string, unknown> | null>(null);

  // Public author name for new entries: the admin's display name, never their email.
  const authorName = () => {
    if (auth.kind !== 'authenticated') return '';
    const n = preferredAuthorName(auth.user, prefs);
    return n.includes('@') ? '' : n;
  };

  // Auth setup
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const max = 40;
    const init = () => {
      if (cancelled) return;
      const ni = (window as any).netlifyIdentity;
      if (!ni || !identityStarted()) {
        if (++tries < max) setTimeout(init, 100);
        else setAuth({ kind: 'anonymous' });
        return;
      }
      const user = ni.currentUser();
      setAuth(user ? { kind: 'authenticated', user } : { kind: 'anonymous' });
      ni.on('login', (u: any) => setAuth({ kind: 'authenticated', user: u }));
      ni.on('logout', () => setAuth({ kind: 'anonymous' }));
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // This person's display name (for authoring new entries).
  useEffect(() => {
    if (auth.kind === 'authenticated') setPrefs(loadPrefs(auth.user.email));
  }, [auth]);

  // Team: the shared directory to pick members from, and the staff accounts
  // a member can be linked to. Only for people who can edit projects.
  const canEditTeam = auth.kind === 'authenticated' && can(auth.user, 'edit-projects');
  const { state: staff, reload: reloadStaff } = useStaff(lang, canEditTeam);
  const [directory, setDirectory] = useState<TeamMember[] | null>(null);
  useEffect(() => {
    if (!canEditTeam) return;
    let cancelled = false;
    loadDirectory().then(
      (d) => { if (!cancelled) setDirectory(d.members); },
      () => { if (!cancelled) setDirectory([]); },
    );
    return () => { cancelled = true; };
  }, [canEditTeam]);

  // Once authenticated, load the LIVE project file (not just the SHA). This
  // matters because notes/updates added inline since the last build live only
  // in the repo, not in the build-time props this editor was seeded with —
  // hydrating them here means a later save won't silently drop them. Also
  // seeds the shared SHA cache so the save pins correctly. New projects have
  // no file yet, so editingSha stays null (create mode).
  useEffect(() => {
    if (auth.kind !== 'authenticated') return;
    if (isNew) {
      setEditingSha(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const live = await loadProjectForEdit(initial.id);
        if (cancelled || !live) {
          if (!cancelled) setEditingSha(undefined);
          return;
        }
        liveRef.current = live;
        // Only pull the fields the inline forms can change out from under the
        // editor. Everything else stays as the user loaded it.
        // Money too: contributions recorded on the project page since the
        // last build exist only in the repo, and saving stale figures from
        // the build would quietly undo them.
        const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
        if (typeof live.budgetUSD === 'number') setRecordedBudget(live.budgetUSD);
        setState((s) => ({
          ...s,
          // The team as it is in the repo: the build drops legacy emails,
          // and saving without them would cut those engineers off.
          engineers: Array.isArray(live.engineers)
            ? (live.engineers as Array<Record<string, any>>)
                .filter((x) => x && typeof x === 'object')
                .map((x) => ({
                  name: { ar: String(x.name?.ar ?? ''), en: String(x.name?.en ?? '') },
                  role: { ar: String(x.role?.ar ?? ''), en: String(x.role?.en ?? '') },
                  phone: typeof x.phone === 'string' ? x.phone : '',
                  ...(typeof x.userId === 'string' && x.userId ? { userId: x.userId } : {}),
                  ...(typeof x.email === 'string' && x.email && !x.userId ? { email: x.email } : {}),
                }))
            : s.engineers,
          comments: Array.isArray(live.comments) ? (live.comments as typeof s.comments) : s.comments,
          updates: Array.isArray(live.updates) ? (live.updates as typeof s.updates) : s.updates,
          budgetUSD: num(live.budgetUSD, s.budgetUSD),
          raisedUSD: num(live.raisedUSD, s.raisedUSD),
          subs: Array.isArray(live.subs)
            ? (live.subs as Array<Record<string, unknown>>).map((x, i) => {
                const prev = s.subs.find((p) => p.id === x.id) || s.subs[i];
                const bl = (v: unknown) => (v && typeof v === 'object'
                  ? { ar: String((v as any).ar ?? ''), en: String((v as any).en ?? '') }
                  : { ar: '', en: '' });
                return {
                  ...prev,
                  id: String(x.id ?? prev?.id ?? `item-${i + 1}`),
                  title: bl(x.title),
                  length: bl(x.length),
                  budgetUSD: num(x.budgetUSD, prev?.budgetUSD ?? 0),
                  raisedUSD: num(x.raisedUSD, prev?.raisedUSD ?? 0),
                };
              })
            : s.subs,
        }));
        if (!cancelled) setEditingSha('loaded');
      } catch {
        // Network/auth failure — fall back to letting the commit helper sort
        // out the SHA via its retry path.
        if (!cancelled) setEditingSha(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [auth.kind, isNew, initial.id]);

  // With line items, the project's totals ARE the sum of its items: that's
  // what the project page, the fund recorder and its caps all use. The form
  // shows them read-only and writes them on save, so the list, the map and
  // the project page can never disagree again.
  const hasSubs = state.subs.length > 0;
  const subsBudget = state.subs.reduce((a, x) => a + (x.budgetUSD || 0), 0);
  const subsRaised = state.subs.reduce((a, x) => a + (x.raisedUSD || 0), 0);
  const totalBudget = hasSubs ? subsBudget : state.budgetUSD;
  const totalRaised = hasSubs ? subsRaised : state.raisedUSD;
  const totalsMismatch = hasSubs && !isNew && recordedBudget !== subsBudget;

  // Computed values for the budget slider
  const budgetMax = useMemo(() => {
    return Math.max(state.budgetUSD * 1.5, 1000);
  }, [state.budgetUSD]);

  const pct = totalBudget > 0
    ? Math.min(100, Math.round((totalRaised / totalBudget) * 100))
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
        if (totalBudget <= 0) {
          setSave({
            kind: 'error',
            message: lang === 'ar' ? 'الميزانية يجب أن تكون أكبر من صفر.' : 'Budget must be greater than zero.',
          });
          return;
        }
      }

      // Start from the live file and overlay the fields this form manages.
      const frontmatter: Record<string, unknown> = {
        ...(liveRef.current || {}),
        id: state.id,
        order: state.order,
        featured: state.featured,
        category: state.category,
        status: state.status,
        health: state.health,
        title: state.title,
        location: state.location,
        description: state.description,
        budgetUSD: totalBudget,
        raisedUSD: totalRaised,
        lat: state.lat,
        lng: state.lng,
      };
      // Legacy fields from the online-donation era are dropped on save.
      delete frontmatter.donors;
      delete frontmatter.daysLeft;
      if (state.deadline) frontmatter.deadline = state.deadline; else delete frontmatter.deadline;
      if (state.govFunding.type === 'none') delete frontmatter.govFunding;
      else frontmatter.govFunding = {
        type: state.govFunding.type,
        note: { ar: state.govFunding.note.ar.trim(), en: state.govFunding.note.en.trim() },
      };
      // Lists this form manages: written when non-empty, removed when emptied.
      // Rows left blank are dropped rather than saved: an empty entry would
      // fail the site's content check and stop the next deploy.
      const hasText = (b?: { ar?: string; en?: string }) => !!((b?.ar || '').trim() || (b?.en || '').trim());
      const lists: Array<[string, unknown[]]> = [
        ['subs', state.subs.filter((x) => hasText(x.title))],
        ['updates', state.updates.filter((x) => hasText(x.body))],
        ['engineers', state.engineers.filter((x) => hasText(x.name)).map((x) => ({
          name: x.name,
          role: x.role,
          ...(x.phone && x.phone.trim() ? { phone: x.phone.trim() } : {}),
          // A linked account replaces any legacy email.
          ...(x.userId ? { userId: x.userId } : x.email ? { email: x.email } : {}),
        }))],
        ['comments', state.comments.filter((x) => hasText(x.body))],
      ];
      for (const [key, list] of lists) {
        if (list.length > 0) frontmatter[key] = list; else delete frontmatter[key];
      }

      const commitMessage = isNew
        ? (lang === 'ar' ? `إنشاء مشروع: ${state.title.ar}` : `Create project: ${state.title.ar}`)
        : (lang === 'ar' ? `تعديل المشروع: ${state.title.ar}` : `Edit project: ${state.title.ar}`);

      // create until the file exists, then update. editingSha === 'loaded'
      // means either an existing project or a new one we already created this
      // session; anything else on a new project is still a create.
      const mode: 'create' | 'update' = (isNew && editingSha !== 'loaded') ? 'create' : 'update';

      const newSha = await commitProjectFile({
        projectId: state.id,
        frontmatter,
        message: commitMessage,
        mode,
      });

      // Pin the NEXT save to what we just wrote — this is what stops the
      // second save in a session from 409-ing on a stale SHA. (The shared
      // cache also holds it, but flipping to 'loaded' switches create→update.)
      void newSha;
      setEditingSha('loaded');

      setSave({ kind: 'success' });
      // IMPORTANT: do NOT auto-redirect to the project's public page.
      // Netlify rebuilds take 1-3 minutes after a commit; the new page
      // simply does not exist yet. Instead, the success screen below
      // explains what's happening and gives the user choices.
    } catch (err: any) {
      const raw = err?.message || 'Save failed';
      const message = raw === 'ID_EXISTS'
        ? (lang === 'ar'
            ? 'يوجد مشروع بهذا المعرف بالفعل. اختر معرفاً مختلفاً.'
            : 'A project with this ID already exists. Choose a different ID.')
        : raw === 'CONFLICT'
          ? (lang === 'ar'
              ? 'تعذّر الحفظ بسبب تعارض مستمر. حدّث الصفحة وحاول مجدداً.'
              : "Couldn't save due to a persistent conflict. Refresh and try again.")
          : (err instanceof GitConflictError || err?.name === 'PermissionError' || err?.name === 'SaveError')
            ? saveErrorMessage(err, lang)
            : raw;
      setSave({ kind: 'error', message });
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

  // Project managers and administrators only.
  if (!can(auth.user, 'edit-projects')) {
    return <AccessNotice lang={lang} state="no-access" roles={['admin', 'project-manager']} />;
  }
  // Raised amounts come from recorded contributions; only admins adjust them directly.
  const canAdjustRaised = can(auth.user, 'reverse-funds');

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

        {hasSubs ? (
          <div className="editor-field">
            <div className="editor-totals">
              <div>
                <div className="editor-totals-label">{lang === 'ar' ? 'الميزانية الإجمالية' : 'Total budget'}</div>
                <div className="editor-totals-val"><bdi>{fmtMoney(lang, 'USD', totalBudget)}</bdi></div>
              </div>
              <div>
                <div className="editor-totals-label">{lang === 'ar' ? 'المحصّل حتى الآن' : 'Raised so far'}</div>
                <div className="editor-totals-val"><bdi>{fmtMoney(lang, 'USD', totalRaised)}</bdi></div>
              </div>
            </div>
            <p className="editor-field-hint">
              {lang === 'ar'
                ? `مجموع ${fmtNum(lang, state.subs.length)} من البنود الفرعية أدناه. لتغيير الميزانية الإجمالية عدّل ميزانية البنود أو أضف بنداً.`
                : `Sum of the ${state.subs.length} line items below. To change the total, change an item's budget or add an item.`}
            </p>
            {totalsMismatch && (
              <div className="editor-notice" role="note">
                {lang === 'ar'
                  ? <>الميزانية الإجمالية المحفوظة سابقاً (<strong><bdi>{fmtMoney(lang, 'USD', recordedBudget)}</bdi></strong>) لا تساوي مجموع البنود (<strong><bdi>{fmtMoney(lang, 'USD', subsBudget)}</bdi></strong>). صفحة المشروع وكل المجاميع تعتمد على البنود، لذا عدّل ميزانيات البنود لتصل إلى المبلغ المطلوب ثم احفظ.</>
                  : <>The total saved earlier (<strong><bdi>{fmtMoney(lang, 'USD', recordedBudget)}</bdi></strong>) doesn't match the line items (<strong><bdi>{fmtMoney(lang, 'USD', subsBudget)}</bdi></strong>). The project page and every total use the line items, so adjust the item budgets to reach the amount you want, then save.</>}
              </div>
            )}
          </div>
        ) : (
          <>
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
                  disabled={!canAdjustRaised}
                  title={canAdjustRaised ? undefined : (lang === 'ar' ? 'يُسجَّل المحصّل من صفحة المشروع (المالية)' : 'Recorded from the project page by Finance')}
                  onChange={(e) => update('raisedUSD', Math.min(state.budgetUSD, Math.max(0, parseInt(e.target.value, 10) || 0)))}
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
                  disabled={!canAdjustRaised}
                  onChange={(e) => update('raisedUSD', parseInt(e.target.value, 10))}
                />
              </div>
            </div>
          </>
        )}

        <div className="editor-field">
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
            <label>{lang === 'ar' ? 'الموعد النهائي للتمويل (اختياري)' : 'Funding deadline (optional)'}</label>
            <input
              type="date"
              className="editor-text-input"
              value={state.deadline}
              onChange={(e) => update('deadline', e.target.value)}
            />
            <p className="editor-field-hint">
              {lang === 'ar'
                ? 'إن حُدِّد، يعرض الموقع عدد الأيام المتبقية ويحدّثه تلقائياً كل يوم.'
                : 'If set, the site shows the days remaining and keeps the count current.'}
            </p>
          </div>
        </div>

        <div className="editor-field">
          <label>{t(lang, 'gov_editor_label')}</label>
          <div className="gov-editor-choices" role="radiogroup" aria-label={t(lang, 'gov_editor_label')}>
            {(['none', 'partial', 'full'] as const).map((v) => (
              <label key={v} className={`gov-editor-choice${state.govFunding.type === v ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="gov-funding"
                  value={v}
                  checked={state.govFunding.type === v}
                  onChange={() => update('govFunding', { ...state.govFunding, type: v })}
                />
                {t(lang, v === 'none' ? 'gov_editor_none' : v === 'partial' ? 'gov_editor_partial' : 'gov_editor_full')}
              </label>
            ))}
          </div>
          {state.govFunding.type !== 'none' && (
            <div className="editor-row" style={{ marginTop: '0.75rem' }}>
              {(['ar', 'en'] as const).map((l) => (
                <div key={l} className="editor-field editor-field-half">
                  <label>{t(lang, 'gov_editor_note')} — {l === 'ar' ? 'العربية' : 'English'}</label>
                  <textarea
                    className="editor-text-input"
                    rows={2}
                    dir={l === 'ar' ? 'rtl' : 'ltr'}
                    placeholder={l === lang ? t(lang, 'gov_editor_note_ph') : undefined}
                    value={state.govFunding.note[l]}
                    onChange={(e) => update('govFunding', { ...state.govFunding, note: { ...state.govFunding.note, [l]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="editor-field-hint">{t(lang, 'gov_editor_hint')}</p>
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
        <LocationPicker
          lat={state.lat}
          lng={state.lng}
          lang={lang}
          onChange={(la, ln) => setState((s) => ({ ...s, lat: la, lng: ln }))}
        />
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
            ? 'قسّم المشروع إلى بنود تنفيذية. كل بند له ميزانية مستقلة وشريط تقدم خاص. يمكن تسجيل المساهمات على بند محدد.'
            : 'Split the project into executable line items. Each has its own budget and progress bar. Contributions can be recorded against a specific item.'}
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
                  max={s.budgetUSD}
                  value={s.raisedUSD}
                  onChange={(e) => {
                    const next = [...state.subs];
                    next[i] = { ...s, raisedUSD: Math.min(s.budgetUSD, Math.max(0, parseInt(e.target.value, 10) || 0)) };
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

        {canEditTeam && (
          <div className="editor-preset-bar">
            <span className="editor-preset-label">{t(lang, 'team_from_directory')}</span>
            <div className="editor-preset-chips">
              {directory === null && <span className="editor-field-hint">…</span>}
              {directory !== null && directory.length === 0 && (
                <span className="editor-field-hint">{t(lang, 'team_directory_none')}</span>
              )}
              {(directory || []).map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className="editor-preset-chip"
                  onClick={() => update('engineers', [
                    ...state.engineers,
                    {
                      name: { ...m.name },
                      role: { ...m.role },
                      phone: m.phone || '',
                      ...(m.userId ? { userId: m.userId } : {}),
                    },
                  ])}
                >
                  + {loc(lang, m.name) || '—'}
                </button>
              ))}
            </div>
            <a className="team-link-btn" href={`${basePath}/admin/team/`}>{t(lang, 'team_dir_link')}</a>
          </div>
        )}

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
                <StaffAccountSelect
                  lang={lang}
                  staff={staff}
                  onRetry={reloadStaff}
                  value={e.userId}
                  legacy={!!e.email}
                  onChange={(userId) => {
                    const next = [...state.engineers];
                    const { email: _legacy, userId: _old, ...rest } = e;
                    // Choosing (or clearing) the account replaces any legacy email.
                    next[i] = userId ? { ...rest, userId } : rest;
                    update('engineers', next);
                  }}
                />
              </div>
              <div className="editor-field editor-field-half">
                <label>{t(lang, 'team_phone')}</label>
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
                <p className="editor-field-hint">{t(lang, 'team_phone_hint')}</p>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="editor-add-btn"
          onClick={() => update('engineers', [
            ...state.engineers,
            { name: { ar: '', en: '' }, role: { ar: '', en: '' }, phone: '' },
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
            ? 'تظهر هذه التحديثات في الجدول الزمني على صفحة المشروع. استخدمها لإطلاع الأهالي والمساهمين على التقدّم.'
            : 'These appear in the timeline on the project page. Use them to keep residents and contributors informed.'}
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
            <div className="editor-field">
              <label>{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
              <input
                type="date"
                className="editor-text-input editor-date-input"
                value={(u.at || '').slice(0, 10)}
                max={localToday()}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const next = [...state.updates];
                  const { date: _legacy, ...rest } = u;
                  next[i] = { ...rest, at: atForPickedDay(e.target.value) };
                  update('updates', next);
                }}
              />
            </div>
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
              at: new Date().toISOString(),
              author: { ar: authorName(), en: '' },
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
                type="date"
                className="editor-text-input editor-date-input"
                value={(c.at || c.date || '').slice(0, 10)}
                max={localToday()}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const newComments = [...state.comments];
                  const { date: _legacy, ...rest } = c;
                  newComments[i] = { ...rest, at: atForPickedDay(e.target.value) };
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
              author: { ar: authorName(), en: '' },
              body: { ar: '', en: '' },
              at: new Date().toISOString(),
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
