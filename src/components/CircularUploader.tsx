import { useState, useRef } from 'react';
import { stringify as stringifyYaml } from 'yaml';
import { t, type Lang } from '../i18n/strings';
import { commitFile, commitBinaryFile } from '../data/git-gateway';

type Props = {
  lang: Lang;
  onClose: () => void;
};

type SaveState =
  | { kind: 'idle' }
  | { kind: 'uploading'; step: string }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/plain',
];

/**
 * Slugify a title into a safe filename component. ASCII letters/numbers
 * and hyphens only; Arabic-only titles produce empty strings, so we
 * append a random suffix to guarantee uniqueness.
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Pick an extension for the uploaded file based on its MIME type. We don't
 * trust the original filename because users sometimes rename incorrectly.
 */
function extForMime(mime: string, fallbackName: string): string {
  const m: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
  };
  if (m[mime]) return m[mime];
  const fromName = fallbackName.split('.').pop()?.toLowerCase();
  return fromName && /^[a-z0-9]{2,5}$/.test(fromName) ? fromName : 'bin';
}

/**
 * Read a File as base64 (data-URL form, then strip the "data:..;base64," prefix).
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * CircularUploader
 *
 * Admin-only form for uploading a new council document. On submit:
 *   1. Validate (file size, type, required fields)
 *   2. Encode the file as base64 and commit to public/circulars/files/{id}.{ext}
 *   3. Commit a metadata .md file to src/content/circulars/{id}.md
 *   4. Show success state; Netlify rebuilds and the document appears
 *
 * The two commits are sequential (file first, metadata last). If the
 * metadata commit fails, we leave an orphan file behind — harmless because
 * it's not referenced anywhere. The user can retry; on retry the same
 * file URL is used (idempotent for that specific content).
 */
export default function CircularUploader({ lang, onClose }: Props) {
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [category, setCategory] = useState<string>('decision');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Random ID suffix, generated once per form session. Keeping it stable
  // across submit attempts means a retry after a mid-upload failure reuses
  // the same file path (idempotent) instead of leaving an orphan file from
  // the first attempt and uploading a duplicate under a new name.
  const suffixRef = useRef<string>(randomSuffix());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim() || !file) {
      setSave({ kind: 'error', message: t(lang, 'circ_err_required') });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setSave({ kind: 'error', message: t(lang, 'circ_err_size') });
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
      setSave({ kind: 'error', message: t(lang, 'circ_err_type') });
      return;
    }

    try {
      // Build a unique ID: date + slug + random suffix. The slug can be
      // empty (Arabic-only titles), so the random suffix guarantees uniqueness.
      const slug = slugify(titleEn || titleAr);
      const id = `${date}-${slug || 'doc'}-${suffixRef.current}`;
      const ext = extForMime(file.type, file.name);
      const publicFilePath = `/circulars/files/${id}.${ext}`;
      const repoFilePath = `public/circulars/files/${id}.${ext}`;
      const metadataPath = `src/content/circulars/${id}.md`;

      // STEP 1: Commit the binary file
      setSave({ kind: 'uploading', step: lang === 'ar' ? 'تحويل الملف…' : 'Encoding file…' });
      const base64 = await fileToBase64(file);

      setSave({ kind: 'uploading', step: lang === 'ar' ? 'رفع الملف إلى المستودع…' : 'Committing file to repo…' });
      await commitBinaryFile(
        repoFilePath,
        base64,
        lang === 'ar' ? `رفع وثيقة: ${titleAr}` : `Upload circular: ${titleEn || titleAr}`,
      );

      // STEP 2: Commit the metadata .md
      setSave({ kind: 'uploading', step: lang === 'ar' ? 'حفظ بيانات الوثيقة…' : 'Saving metadata…' });
      const uploadedBy = (() => {
        try {
          const u = (window as any).netlifyIdentity?.currentUser?.();
          return u?.user_metadata?.full_name || u?.email || '';
        } catch { return ''; }
      })();

      // Build the frontmatter — omit empty optional fields entirely so
      // the schema's defaults kick in. Specifically, an empty description
      // would be `{ ar: "", en: "" }` which is fine under the optional
      // schema, but cleaner to just leave the key out.
      const frontmatter: Record<string, unknown> = {
        id,
        title: { ar: titleAr.trim(), en: titleEn.trim() },
        category,
        date,
        file: publicFilePath,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        uploadedBy,
        order: 0,
      };
      const descAr_t = descAr.trim();
      const descEn_t = descEn.trim();
      if (descAr_t || descEn_t) {
        frontmatter.description = { ar: descAr_t, en: descEn_t };
      }

      const fmYaml = stringifyYaml(frontmatter, {
        lineWidth: 0,
        defaultStringType: 'QUOTE_DOUBLE',
        defaultKeyType: 'PLAIN',
      });
      const mdContent = `---\n${fmYaml}---\n\n(Uploaded ${date} by ${uploadedBy || 'council'})\n`;

      await commitFile(
        metadataPath,
        mdContent,
        lang === 'ar' ? `ميتاداتا وثيقة: ${titleAr}` : `Metadata for circular: ${titleEn || titleAr}`,
      );

      setSave({ kind: 'success' });
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 4000);
    } catch (err: any) {
      setSave({ kind: 'error', message: err?.message || 'Upload failed' });
    }
  };

  const inUploading = save.kind === 'uploading';

  if (save.kind === 'success') {
    return (
      <div className="circ-uploader-success">
        <span className="circ-uploader-success-icon">✓</span>
        <div>
          <strong>{t(lang, 'circ_success')}</strong>
          <div className="circ-uploader-success-sub">{t(lang, 'circ_success_sub')}</div>
        </div>
      </div>
    );
  }

  return (
    <form className="circ-uploader" onSubmit={handleSubmit}>
      <div className="circ-uploader-header">
        <h3>{t(lang, 'circ_upload_title')}</h3>
        <p className="circ-uploader-desc">{t(lang, 'circ_upload_desc')}</p>
      </div>

      <div className="circ-uploader-grid">
        <div className="circ-uploader-field">
          <label>{t(lang, 'circ_field_title')}</label>
          <input
            type="text"
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            required
            maxLength={200}
            disabled={inUploading}
            dir="rtl"
          />
        </div>
        <div className="circ-uploader-field">
          <label>{t(lang, 'circ_field_title_en')}</label>
          <input
            type="text"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            maxLength={200}
            disabled={inUploading}
            dir="ltr"
          />
        </div>
        <div className="circ-uploader-field">
          <label>{t(lang, 'circ_field_category')}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={inUploading}
          >
            <option value="decision">{t(lang, 'circ_cat_decision')}</option>
            <option value="announcement">{t(lang, 'circ_cat_announcement')}</option>
            <option value="report">{t(lang, 'circ_cat_report')}</option>
            <option value="policy">{t(lang, 'circ_cat_policy')}</option>
            <option value="minutes">{t(lang, 'circ_cat_minutes')}</option>
            <option value="other">{t(lang, 'circ_cat_other')}</option>
          </select>
        </div>
        <div className="circ-uploader-field">
          <label>{t(lang, 'circ_field_date')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={inUploading}
          />
        </div>
        <div className="circ-uploader-field circ-uploader-field-wide">
          <label>{t(lang, 'circ_field_desc')}</label>
          <textarea
            value={descAr}
            onChange={(e) => setDescAr(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={inUploading}
            dir="rtl"
          />
        </div>
        <div className="circ-uploader-field circ-uploader-field-wide">
          <label>{t(lang, 'circ_field_desc_en')}</label>
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={inUploading}
            dir="ltr"
          />
        </div>
        <div className="circ-uploader-field circ-uploader-field-wide">
          <label>{t(lang, 'circ_field_file')}</label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={inUploading}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.doc,.docx,.xls,.xlsx,.txt"
          />
          <div className="circ-uploader-field-hint">
            {t(lang, 'circ_field_file_hint')}
          </div>
          {file && (
            <div className="circ-uploader-file-preview">
              📎 {file.name} — {(file.size / 1024).toFixed(0)} KB
            </div>
          )}
        </div>
      </div>

      {save.kind === 'error' && (
        <div className="circ-uploader-error">⚠ {save.message}</div>
      )}
      {inUploading && (
        <div className="circ-uploader-progress">
          <span className="circ-uploader-spinner"></span>
          {save.step}
        </div>
      )}

      <div className="circ-uploader-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}
          disabled={inUploading}
        >
          {t(lang, 'circ_btn_cancel')}
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={inUploading || !titleAr.trim() || !file}
        >
          {inUploading ? t(lang, 'circ_uploading') : t(lang, 'circ_btn_upload')}
        </button>
      </div>
    </form>
  );
}
