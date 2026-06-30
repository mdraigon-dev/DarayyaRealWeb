import { useState, useEffect, useRef } from 'react';
import { type Lang } from '../i18n/strings';
import { appendProjectItem, type ProjectFileCache } from '../data/project-file-edit';
import { classifyUser, canPost, roleLabel, type ProjectEngineer, type AuthUser } from '../data/permissions';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Bilingual = { ar: string; en: string };
type NewComment = { author: Bilingual; body: Bilingual; date: string };

type Props = {
  projectId: string;
  lang: Lang;
  /** Engineers on this project — used to authorize posting */
  engineers: ProjectEngineer[];
  /** Called after a note commits, so the page can show it without waiting for the rebuild */
  onAdded?: (comment: NewComment) => void;
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
 * AuthAwareNoteAdder
 *
 * Inline "Add quick note" form. Visible only to:
 *   - admins (Identity user_metadata.roles includes 'admin')
 *   - engineers listed on THIS project (email match against engineers[].email)
 *
 * Other logged-in users and anonymous visitors see nothing. The form
 * reads/modifies/writes the project's markdown file via Git Gateway.
 */

export default function AuthAwareNoteAdder({ projectId, lang, engineers, onAdded }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [authorOverride, setAuthorOverride] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [flash, setFlash] = useState(false);

  // Cached {content, sha} of the project file, carried across successive
  // submits so rapid notes chain off the last commit's SHA instead of a
  // laggy re-read. See data/project-file-edit.ts.
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
        if (tries < maxTries) {
          setTimeout(init, 100);
          return;
        }
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

  // Permission gate: only admins and engineers-of-this-project may post.
  const role = classifyUser(auth.user, engineers);
  if (!canPost(role)) return null;

  const isAdmin = role === 'admin';
  const lang_seg = lang === 'ar' ? 'ar' : 'en';
  const editUrl = `/${lang_seg}/admin/edit/${projectId}/`;
  const defaultAuthor = auth.user.user_metadata?.full_name || auth.user.email;
  const myRoleLabel = roleLabel(role, lang);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setSave({
        kind: 'error',
        message: lang === 'ar' ? 'يرجى كتابة نص الملاحظة.' : 'Please enter note text.',
      });
      return;
    }
    const effectiveAuthor = (authorOverride.trim() || defaultAuthor);
    setSave({ kind: 'saving' });

    try {
      // Body goes in the language the user typed; the other side is left
      // empty for the build-time auto-translator to fill.
      const newComment: NewComment = {
        author: { ar: effectiveAuthor, en: effectiveAuthor },
        body: {
          ar: lang === 'ar' ? trimmed : '',
          en: lang === 'en' ? trimmed : '',
        },
        date: new Date().toISOString().slice(0, 10),
      };

      const commitMessage = lang === 'ar'
        ? `إضافة ملاحظة على ${projectId} بواسطة ${effectiveAuthor}`
        : `Add note on ${projectId} by ${effectiveAuthor}`;

      const { cache } = await appendProjectItem({
        projectId,
        field: 'comments',
        item: newComment,
        position: 'end',
        message: commitMessage,
        cache: cacheRef.current,
      });
      cacheRef.current = cache;

      // Show it on the page right away, and keep the form open with cleared
      // text so another note can be added immediately — no waiting on rebuild.
      onAdded?.(newComment);
      setSave({ kind: 'idle' });
      setBody('');
      setAuthorOverride('');
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
    <div className="auth-note-bar">
      <span className="auth-note-info">
        <span className="auth-note-dot"></span>
        {lang === 'ar'
          ? <>مسجّل دخوله كـ <strong>{defaultAuthor}</strong> <span className="auth-note-role">({myRoleLabel})</span></>
          : <>Signed in as <strong>{defaultAuthor}</strong> <span className="auth-note-role">({myRoleLabel})</span></>}
      </span>

      {!expanded && (
        <div className="auth-note-actions">
          {flash && (
            <span className="auth-note-flash">
              ✓ {lang === 'ar' ? 'أُضيفت الملاحظة' : 'Note added'}
            </span>
          )}
          <button
            type="button"
            className="auth-note-btn-inline"
            onClick={() => setExpanded(true)}
          >
            ✎ {lang === 'ar' ? 'إضافة ملاحظة سريعة' : 'Add quick note'}
          </button>
          {/* Full editor access is for admins only — engineers can post via
              the inline forms but not modify budgets, status, team members, etc. */}
          {isAdmin && (
            <a className="auth-note-btn-secondary" href={editUrl}>
              {lang === 'ar' ? 'تعديل كامل ←' : 'Full edit →'}
            </a>
          )}
        </div>
      )}

      {expanded && (
        <form className="auth-note-form" onSubmit={handleSubmit}>
          <div className="auth-note-form-row">
            <input
              type="text"
              className="auth-note-form-author"
              value={authorOverride}
              onChange={(e) => setAuthorOverride(e.target.value)}
              placeholder={defaultAuthor}
              maxLength={80}
              disabled={save.kind === 'saving'}
            />
            <span className="auth-note-form-hint">
              {lang === 'ar' ? '(الاسم الذي سيظهر مع الملاحظة)' : '(name shown with the note)'}
            </span>
          </div>
          <textarea
            className="auth-note-form-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={lang === 'ar' ? 'اكتب الملاحظة هنا…' : 'Write your note here…'}
            rows={3}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            maxLength={500}
            disabled={save.kind === 'saving'}
            autoFocus
          />
          {save.kind === 'error' && (
            <div className="auth-note-form-error">⚠ {save.message}</div>
          )}
          {flash && save.kind !== 'error' && (
            <div className="auth-note-form-flash">
              ✓ {lang === 'ar'
                ? 'أُضيفت الملاحظة وتظهر أدناه. يمكنك إضافة أخرى أو الضغط على «تم».'
                : 'Note added and shown below. Add another or press Done.'}
            </div>
          )}
          <div className="auth-note-form-actions">
            <button
              type="button"
              className="auth-note-form-cancel"
              onClick={() => {
                setExpanded(false);
                setBody('');
                setAuthorOverride('');
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
              className="auth-note-form-save"
              disabled={save.kind === 'saving' || !body.trim()}
            >
              {save.kind === 'saving'
                ? (lang === 'ar' ? 'جاري الحفظ…' : 'Saving…')
                : (lang === 'ar' ? 'حفظ ونشر' : 'Save & publish')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
