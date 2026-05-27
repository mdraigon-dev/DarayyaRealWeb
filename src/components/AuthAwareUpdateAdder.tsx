import { useState, useEffect } from 'react';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { type Lang } from '../i18n/strings';
import { getFileContent, commitFile } from '../data/git-gateway';
import { classifyUser, canPost, type ProjectEngineer, type AuthUser } from '../data/permissions';

// Read profile preference set via the nav dropdown — preferred display name
// overrides the Netlify Identity full_name / email fallback.
function getProfileDisplayName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('darayya-user-profile-v1');
    if (!raw) return '';
    return JSON.parse(raw)?.displayName || '';
  } catch { return ''; }
}

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Props = {
  projectId: string;
  lang: Lang;
  /** The project's engineers, used to authorize them as posters */
  engineers: ProjectEngineer[];
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

/**
 * AuthAwareUpdateAdder
 *
 * Inline "Add field update" form for the project page, parallel to
 * AuthAwareNoteAdder but writes to `updates[]` instead of `comments[]`.
 *
 * Field updates differ from comments:
 *   - They have a date (free text, bilingual): "منذ ٣ أيام" / "3 days ago"
 *   - They appear in the project timeline AND the dashboard activity log
 *   - They're for substantive progress reports, not casual remarks
 *
 * Permission gating: visible only to users classified as 'admin' or
 * 'engineer-of-project' for this specific project (via classifyUser).
 * Logged-in users who aren't an engineer on this project see nothing.
 */
export default function AuthAwareUpdateAdder({ projectId, lang, engineers }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [authorOverride, setAuthorOverride] = useState('');
  const [dateOverride, setDateOverride] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const maxTries = 40;
    const init = () => {
      if (cancelled) return;
      const ni = window.netlifyIdentity;
      if (!ni) {
        tries++;
        if (tries < maxTries) { setTimeout(init, 100); return; }
        setAuth({ kind: 'anonymous' });
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

  if (auth.kind !== 'authenticated') return null;

  // Permission check: only admins and engineers-of-this-project can post
  const role = classifyUser(auth.user, engineers);
  if (!canPost(role)) return null;

  const profileName = getProfileDisplayName();
  const defaultAuthor = profileName || auth.user.user_metadata?.full_name || auth.user.email;
  const todayLabel = lang === 'ar' ? 'اليوم' : 'today';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setSave({
        kind: 'error',
        message: lang === 'ar' ? 'يرجى كتابة نص التحديث.' : 'Please enter the update text.',
      });
      return;
    }
    const effectiveAuthor = (authorOverride.trim() || defaultAuthor);
    const now = new Date();
    const isoTimestamp = now.toISOString();
    const effectiveDateAr = dateOverride.trim() || isoTimestamp;
    const effectiveDateEn = dateOverride.trim() || isoTimestamp;
    setSave({ kind: 'saving' });

    try {
      const path = `src/content/projects/${projectId}.md`;
      const file = await getFileContent(path);
      if (!file) {
        throw new Error(lang === 'ar' ? 'لم يتم العثور على ملف المشروع' : 'Project file not found');
      }
      const m = file.content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!m) throw new Error(lang === 'ar' ? 'تنسيق ملف غير صالح' : 'Invalid file format');
      const [, frontmatterText, markdownBody] = m;
      const frontmatter = parseYaml(frontmatterText) as Record<string, unknown>;

      const existing = Array.isArray(frontmatter.updates) ? frontmatter.updates : [];
      const newUpdate = {
        date: {
          ar: effectiveDateAr,
          en: effectiveDateEn,
        },
        author: { ar: effectiveAuthor, en: effectiveAuthor },
        body: {
          ar: trimmed,
          en: trimmed,
        },
      };
      // Prepend so newest appears first in the timeline
      frontmatter.updates = [newUpdate, ...existing];

      const newFrontmatter = stringifyYaml(frontmatter, {
        lineWidth: 0,
        defaultStringType: 'QUOTE_DOUBLE',
        defaultKeyType: 'PLAIN',
      });
      const newFileContent = `---\n${newFrontmatter}---\n${markdownBody}`;

      const commitMessage = lang === 'ar'
        ? `تحديث ميداني على ${projectId} بواسطة ${effectiveAuthor}`
        : `Field update on ${projectId} by ${effectiveAuthor}`;
      await commitFile(path, newFileContent, commitMessage, 'main', file.sha);

      setSave({ kind: 'success' });
      setBody('');
      setAuthorOverride('');
      setDateOverride('');
      setTimeout(() => {
        setSave({ kind: 'idle' });
        setExpanded(false);
      }, 6000);
    } catch (err: any) {
      setSave({ kind: 'error', message: err?.message || 'Save failed' });
    }
  };

  return (
    <div className="auth-update-bar">
      <div className="auth-update-header">
        <span className="auth-update-icon">📰</span>
        <div>
          <strong>
            {lang === 'ar' ? 'إضافة تحديث ميداني جديد' : 'Add a new field update'}
          </strong>
          <div className="auth-update-subtitle">
            {lang === 'ar'
              ? 'يظهر هذا التحديث في الجدول الزمني للمشروع وفي لوحة المجلس'
              : 'Appears on the project timeline and in the council dashboard'}
          </div>
        </div>
      </div>

      {!expanded && save.kind !== 'success' && (
        <div className="auth-update-actions">
          <button
            type="button"
            className="auth-update-btn-inline"
            onClick={() => setExpanded(true)}
          >
            + {lang === 'ar' ? 'إضافة تحديث' : 'Add update'}
          </button>
        </div>
      )}

      {expanded && save.kind !== 'success' && (
        <form className="auth-update-form" onSubmit={handleSubmit}>
          <div className="auth-update-form-row">
            <div className="auth-update-form-field">
              <label className="auth-update-form-label">
                {lang === 'ar' ? 'الكاتب' : 'Author'}
              </label>
              <input
                type="text"
                className="auth-update-form-author"
                value={authorOverride}
                onChange={(e) => setAuthorOverride(e.target.value)}
                placeholder={defaultAuthor}
                maxLength={80}
                disabled={save.kind === 'saving'}
              />
            </div>
            <div className="auth-update-form-field">
              <label className="auth-update-form-label">
                {lang === 'ar' ? 'التاريخ' : 'Date'}
              </label>
              <input
                type="text"
                className="auth-update-form-date"
                value={dateOverride}
                onChange={(e) => setDateOverride(e.target.value)}
                placeholder={todayLabel}
                maxLength={40}
                disabled={save.kind === 'saving'}
              />
            </div>
          </div>
          <textarea
            className="auth-update-form-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={lang === 'ar' ? 'ماذا حدث على الأرض؟ (مثلاً: تم الانتهاء من ٧٥٪ من تزفيت الشارع الرئيسي)' : 'What happened on the ground? (e.g. 75% of paving on the main street is complete)'}
            rows={4}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            maxLength={800}
            disabled={save.kind === 'saving'}
            autoFocus
          />
          {save.kind === 'error' && (
            <div className="auth-update-form-error">⚠ {save.message}</div>
          )}
          <div className="auth-update-form-actions">
            <button
              type="button"
              className="auth-update-form-cancel"
              onClick={() => {
                setExpanded(false);
                setBody('');
                setAuthorOverride('');
                setDateOverride('');
                setSave({ kind: 'idle' });
              }}
              disabled={save.kind === 'saving'}
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="auth-update-form-save"
              disabled={save.kind === 'saving' || !body.trim()}
            >
              {save.kind === 'saving'
                ? (lang === 'ar' ? 'جاري النشر…' : 'Publishing…')
                : (lang === 'ar' ? 'نشر التحديث' : 'Publish update')}
            </button>
          </div>
        </form>
      )}

      {save.kind === 'success' && (
        <div className="auth-update-success">
          <span className="auth-update-success-icon">✓</span>
          <div>
            <strong>
              {lang === 'ar' ? 'تم نشر التحديث' : 'Update published'}
            </strong>
            <div className="auth-update-success-sub">
              {lang === 'ar'
                ? 'الموقع يُعاد بناؤه. سيظهر التحديث خلال ١–٣ دقائق.'
                : 'Site is rebuilding. Your update will appear in 1–3 minutes.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
