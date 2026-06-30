import { useState, useEffect, useRef } from 'react';
import { type Lang } from '../i18n/strings';
import { appendProjectItem, type ProjectFileCache } from '../data/project-file-edit';
import { classifyUser, canPost, type ProjectEngineer, type AuthUser } from '../data/permissions';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Bilingual = { ar: string; en: string };
type NewUpdate = { date: Bilingual; author: Bilingual; body: Bilingual };

type Props = {
  projectId: string;
  lang: Lang;
  /** The project's engineers, used to authorize them as posters */
  engineers: ProjectEngineer[];
  /** Called after an update commits, so the page can show it without waiting for the rebuild */
  onAdded?: (update: NewUpdate) => void;
};

type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous' }
  | { kind: 'authenticated'; user: AuthUser };

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
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
export default function AuthAwareUpdateAdder({ projectId, lang, engineers, onAdded }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [authorOverride, setAuthorOverride] = useState('');
  const [dateOverride, setDateOverride] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [flash, setFlash] = useState(false);

  // See AuthAwareNoteAdder / project-file-edit.ts — chains the file SHA across
  // submits so rapid updates don't hit GitHub's read-after-write lag.
  const cacheRef = useRef<ProjectFileCache | null>(null);

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

  const defaultAuthor = auth.user.user_metadata?.full_name || auth.user.email;
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
    const effectiveDate = (dateOverride.trim() || todayLabel);
    setSave({ kind: 'saving' });

    try {
      // Body/date go in the language the user typed; the other side is left
      // empty for the build-time auto-translator to fill.
      const newUpdate: NewUpdate = {
        date: {
          ar: lang === 'ar' ? effectiveDate : '',
          en: lang === 'en' ? effectiveDate : '',
        },
        author: { ar: effectiveAuthor, en: effectiveAuthor },
        body: {
          ar: lang === 'ar' ? trimmed : '',
          en: lang === 'en' ? trimmed : '',
        },
      };

      const commitMessage = lang === 'ar'
        ? `تحديث ميداني على ${projectId} بواسطة ${effectiveAuthor}`
        : `Field update on ${projectId} by ${effectiveAuthor}`;

      // Prepend so newest appears first in the timeline.
      const { cache } = await appendProjectItem({
        projectId,
        field: 'updates',
        item: newUpdate,
        position: 'start',
        message: commitMessage,
        cache: cacheRef.current,
      });
      cacheRef.current = cache;

      onAdded?.(newUpdate);
      setSave({ kind: 'idle' });
      setBody('');
      setAuthorOverride('');
      setDateOverride('');
      setFlash(true);
      setTimeout(() => setFlash(false), 4000);
    } catch (err: any) {
      const message = err?.message === 'NOT_FOUND'
        ? (lang === 'ar' ? 'لم يتم العثور على ملف المشروع' : 'Project file not found')
        : err?.message === 'INVALID_FORMAT'
          ? (lang === 'ar' ? 'تنسيق ملف غير صالح' : 'Invalid file format')
          : (err?.message || 'Save failed');
      setSave({ kind: 'error', message });
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

      {!expanded && (
        <div className="auth-update-actions">
          {flash && (
            <span className="auth-update-flash">
              ✓ {lang === 'ar' ? 'نُشر التحديث' : 'Update added'}
            </span>
          )}
          <button
            type="button"
            className="auth-update-btn-inline"
            onClick={() => setExpanded(true)}
          >
            + {lang === 'ar' ? 'إضافة تحديث' : 'Add update'}
          </button>
        </div>
      )}

      {expanded && (
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
          {flash && save.kind !== 'error' && (
            <div className="auth-update-form-flash">
              ✓ {lang === 'ar'
                ? 'نُشر التحديث ويظهر في الجدول الزمني أعلاه. يمكنك إضافة آخر أو الضغط على «تم».'
                : 'Update published and shown in the timeline above. Add another or press Done.'}
            </div>
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
              {flash
                ? (lang === 'ar' ? 'تم' : 'Done')
                : (lang === 'ar' ? 'إلغاء' : 'Cancel')}
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
    </div>
  );
}
