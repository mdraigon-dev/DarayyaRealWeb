import { useState, useEffect, useRef } from 'react';
import { type Lang } from '../i18n/strings';
import { appendProjectItems } from '../data/project-file-edit';
import { loadPrefs, preferredAuthorName, defaultPrefs, type AdminPrefs } from '../data/admin-prefs';
import {
  uploadProjectPhoto,
  isAllowedImage,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_UPDATE,
} from '../data/image-upload';
import { classifyUser, canPost, type ProjectEngineer, type AuthUser } from '../data/permissions';

declare global {
  interface Window {
    netlifyIdentity: any;
  }
}

type Bilingual = { ar: string; en: string };
type Health = 'healthy' | 'warning' | 'stalled' | 'completed';
type NewUpdate = { date: Bilingual; author: Bilingual; body: Bilingual };
type NewPhoto = { src: string; status: Health; caption: Bilingual; date: Bilingual };
/** A photo plus a local preview URL, so the page can show it before rebuild. */
export type PendingPhoto = NewPhoto & { previewUrl: string };

type PickedImage = { file: File; url: string };

type Props = {
  projectId: string;
  lang: Lang;
  /** The project's engineers, used to authorize them as posters */
  engineers: ProjectEngineer[];
  /** Current project health — stamped onto uploaded photos as their status */
  projectHealth: Health;
  /** Called after the update commits, so the page can show it before rebuild */
  onAdded?: (payload: { update: NewUpdate; photos: PendingPhoto[] }) => void;
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
export default function AuthAwareUpdateAdder({ projectId, lang, engineers, projectHealth, onAdded }: Props) {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [authorOverride, setAuthorOverride] = useState('');
  const [dateOverride, setDateOverride] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [flash, setFlash] = useState(false);
  const [prefs, setPrefs] = useState<AdminPrefs>(defaultPrefs());

  // Track the picked images in a ref so the unmount cleanup revokes whatever
  // is current, without re-running (and prematurely revoking) on every change.
  const imagesRef = useRef<PickedImage[]>([]);
  imagesRef.current = images;
  useEffect(() => () => { imagesRef.current.forEach((im) => URL.revokeObjectURL(im.url)); }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setSave({ kind: 'idle' });
    const picked: PickedImage[] = [];
    for (const file of Array.from(fileList)) {
      if (!isAllowedImage(file) || file.size > MAX_IMAGE_BYTES) {
        setSave({
          kind: 'error',
          message: lang === 'ar'
            ? 'الصور المقبولة: JPG أو PNG أو WebP أو GIF، وبحجم أقصاه ٨ ميغابايت.'
            : 'Allowed images: JPG, PNG, WebP or GIF, up to 8 MB each.',
        });
        continue;
      }
      picked.push({ file, url: URL.createObjectURL(file) });
    }
    setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES_PER_UPDATE));
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  useEffect(() => {
    if (auth.kind === 'authenticated') setPrefs(loadPrefs(auth.user.email));
  }, [auth]);

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

  const defaultAuthor = preferredAuthorName(auth.user, prefs);
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

      // 1) Upload each image as its own binary commit, collecting the served
      //    paths. Photos carry the update's text as caption and the project's
      //    current health as their status badge.
      const pendingPhotos: PendingPhoto[] = [];
      const photoOps: Array<{ field: 'photos'; item: NewPhoto; position: 'end' }> = [];
      for (const im of images) {
        const { src } = await uploadProjectPhoto(projectId, im.file, `${commitMessage} (photo)`);
        const photo: NewPhoto = {
          src,
          status: projectHealth,
          caption: { ar: lang === 'ar' ? trimmed : '', en: lang === 'en' ? trimmed : '' },
          date: { ar: lang === 'ar' ? effectiveDate : '', en: lang === 'en' ? effectiveDate : '' },
        };
        photoOps.push({ field: 'photos', item: photo, position: 'end' });
        pendingPhotos.push({ ...photo, previewUrl: im.url });
      }

      // 2) Commit the update (+ any photo entries) to the project file in one go.
      //    Prepend the update so newest appears first in the timeline.
      await appendProjectItems({
        projectId,
        ops: [
          { field: 'updates', item: newUpdate, position: 'start' },
          ...photoOps,
        ],
        message: commitMessage,
      });

      onAdded?.({ update: newUpdate, photos: pendingPhotos });
      setSave({ kind: 'idle' });
      setBody('');
      setAuthorOverride('');
      setDateOverride('');
      setImages([]); // preview URLs now owned by the parent for optimistic display
      setFlash(true);
      setTimeout(() => setFlash(false), 4000);
    } catch (err: any) {
      const message = err?.message === 'NOT_FOUND'
        ? (lang === 'ar' ? 'لم يتم العثور على ملف المشروع' : 'Project file not found')
        : err?.message === 'INVALID_FORMAT'
          ? (lang === 'ar' ? 'تنسيق ملف غير صالح' : 'Invalid file format')
          : err?.message === 'IMAGE_TYPE'
            ? (lang === 'ar' ? 'نوع صورة غير مدعوم.' : 'Unsupported image type.')
            : err?.message === 'IMAGE_SIZE'
              ? (lang === 'ar' ? 'حجم الصورة يتجاوز ٨ ميغابايت.' : 'Image exceeds 8 MB.')
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

          {/* Site photos — engineers attach progress images with the update. */}
          <div className="auth-update-photos">
            <label className="auth-update-photo-add">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                disabled={save.kind === 'saving' || images.length >= MAX_IMAGES_PER_UPDATE}
                style={{ display: 'none' }}
              />
              <span>📷 {lang === 'ar' ? 'إضافة صور من موقع العمل' : 'Add site photos'}</span>
            </label>
            <span className="auth-update-photo-hint">
              {lang === 'ar'
                ? `حتى ${MAX_IMAGES_PER_UPDATE} صور · JPG/PNG/WebP/GIF · ٨ ميغابايت للصورة`
                : `Up to ${MAX_IMAGES_PER_UPDATE} · JPG/PNG/WebP/GIF · 8 MB each`}
            </span>

            {images.length > 0 && (
              <div className="auth-update-thumbs">
                {images.map((im, i) => (
                  <div className="auth-update-thumb" key={i}>
                    <img src={im.url} alt="" />
                    {save.kind !== 'saving' && (
                      <button
                        type="button"
                        className="auth-update-thumb-remove"
                        onClick={() => removeImage(i)}
                        aria-label={lang === 'ar' ? 'إزالة' : 'Remove'}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
