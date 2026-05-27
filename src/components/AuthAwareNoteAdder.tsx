import { useState, useEffect } from 'react';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { type Lang } from '../i18n/strings';
import { getFileContent, commitFile } from '../data/git-gateway';
import { classifyUser, canPost, roleLabel, type ProjectEngineer, type AuthUser } from '../data/permissions';

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
  /** Engineers on this project — used to authorize posting */
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
 * AuthAwareNoteAdder
 *
 * Inline "Add quick note" form. Visible only to:
 *   - admins (Identity user_metadata.roles includes 'admin')
 *   - engineers listed on THIS project (email match against engineers[].email)
 *
 * Other logged-in users and anonymous visitors see nothing. The form
 * reads/modifies/writes the project's markdown file via Git Gateway.
 */

export default function AuthAwareNoteAdder({ projectId, lang, engineers }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [authorOverride, setAuthorOverride] = useState('');
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
  const profileName = getProfileDisplayName();
  const defaultAuthor = profileName || auth.user.user_metadata?.full_name || auth.user.email;
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
      const path = `src/content/projects/${projectId}.md`;
      const file = await getFileContent(path);
      if (!file) {
        throw new Error(lang === 'ar' ? 'لم يتم العثور على ملف المشروع' : 'Project file not found');
      }

      // Split YAML frontmatter from markdown body
      const m = file.content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!m) throw new Error(lang === 'ar' ? 'تنسيق ملف غير صالح' : 'Invalid file format');
      const [, frontmatterText, markdownBody] = m;
      const frontmatter = parseYaml(frontmatterText) as Record<string, unknown>;

      // Build the new comment. Store the body in both AR and EN so it
      // renders for readers in either language immediately. The build-time
      // auto-translator will replace the non-native side with a real
      // translation on the next Netlify build.
      const existing = Array.isArray(frontmatter.comments) ? frontmatter.comments : [];
      const newComment = {
        author: { ar: effectiveAuthor, en: effectiveAuthor },
        body: {
          ar: trimmed,
          en: trimmed,
        },
        date: new Date().toISOString().slice(0, 10),
      };
      frontmatter.comments = [...existing, newComment];

      const newFrontmatter = stringifyYaml(frontmatter, {
        lineWidth: 0,
        defaultStringType: 'QUOTE_DOUBLE',
        defaultKeyType: 'PLAIN',
      });
      const newFileContent = `---\n${newFrontmatter}---\n${markdownBody}`;

      const commitMessage = lang === 'ar'
        ? `إضافة ملاحظة على ${projectId} بواسطة ${effectiveAuthor}`
        : `Add note on ${projectId} by ${effectiveAuthor}`;
      await commitFile(path, newFileContent, commitMessage, 'main', file.sha);

      setSave({ kind: 'success' });
      setBody('');
      setAuthorOverride('');
      // Auto-collapse back to ready after a moment. We don't reload — the
      // note won't appear until Netlify rebuilds.
      setTimeout(() => {
        setSave({ kind: 'idle' });
        setExpanded(false);
      }, 6000);
    } catch (err: any) {
      setSave({ kind: 'error', message: err?.message || 'Save failed' });
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

      {!expanded && save.kind !== 'success' && (
        <div className="auth-note-actions">
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

      {expanded && save.kind !== 'success' && (
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
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
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

      {save.kind === 'success' && (
        <div className="auth-note-success">
          <span className="auth-note-success-icon">✓</span>
          <div>
            <strong>
              {lang === 'ar' ? 'تم حفظ الملاحظة' : 'Note saved'}
            </strong>
            <div className="auth-note-success-sub">
              {lang === 'ar'
                ? 'الموقع يُعاد بناؤه. ستظهر الملاحظة خلال ١–٣ دقائق.'
                : 'Site is rebuilding. The note will appear in 1–3 minutes.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
