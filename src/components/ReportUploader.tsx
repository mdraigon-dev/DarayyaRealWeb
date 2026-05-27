import { useState, useRef, useEffect } from 'react';
import { stringify as stringifyYaml } from 'yaml';
import { type Lang } from '../i18n/strings';
import { commitFile, commitBinaryFile } from '../data/git-gateway';

declare global { interface Window { netlifyIdentity: any; } }

type Props = { lang: Lang; };

type SaveState =
  | { kind: 'idle' }
  | { kind: 'uploading'; step: string }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
const ALLOWED_EXT = /\.(pdf|doc|docx|xls|xlsx|txt)$/i;

const REPORT_CATEGORIES = [
  { value: 'report',   ar: 'تقرير مالي',   en: 'Financial Report' },
  { value: 'policy',   ar: 'سياسة',         en: 'Policy' },
  { value: 'decision', ar: 'قرار',          en: 'Decision' },
  { value: 'minutes',  ar: 'محضر اجتماع',   en: 'Meeting Minutes' },
  { value: 'other',    ar: 'أخرى',          en: 'Other' },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
function randomSuffix(): string { return Math.random().toString(36).slice(2, 8); }
function extForMime(mime: string, fallbackName: string): string {
  const m: Record<string,string> = {
    'application/pdf': 'pdf',
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
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

export default function ReportUploader({ lang }: Props) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [category, setCategory] = useState('report');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ar = lang === 'ar';

  // Check Netlify Identity for admin status
  useEffect(() => {
    const check = () => {
      const ni = window.netlifyIdentity;
      if (!ni) return;
      const u = ni.currentUser?.();
      if (u) setIsAdmin(true);
      ni.on('login', () => setIsAdmin(true));
      ni.on('logout', () => { setIsAdmin(false); setOpen(false); });
    };
    let tries = 0;
    const poll = () => { if (window.netlifyIdentity) check(); else if (++tries < 30) setTimeout(poll, 200); };
    poll();
  }, []);

  const reset = () => {
    setTitleAr(''); setTitleEn(''); setCategory('report');
    setDate(new Date().toISOString().slice(0, 10));
    setFile(null); setSave({ kind: 'idle' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (f.size > MAX_FILE_BYTES) {
      setSave({ kind: 'error', message: ar ? 'الملف أكبر من 15 MB.' : 'File exceeds 15 MB.' });
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type) && !ALLOWED_EXT.test(f.name)) {
      setSave({ kind: 'error', message: ar ? 'نوع الملف غير مدعوم. يُقبل: PDF, Word, Excel.' : 'Unsupported file type. Accepted: PDF, Word, Excel.' });
      return;
    }
    setFile(f); setSave({ kind: 'idle' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim()) {
      setSave({ kind: 'error', message: ar ? 'العنوان بالعربية مطلوب.' : 'Arabic title is required.' });
      return;
    }
    if (!file) {
      setSave({ kind: 'error', message: ar ? 'يرجى اختيار ملف.' : 'Please select a file.' });
      return;
    }

    try {
      const slug = slugify(titleEn || titleAr);
      const id = `${date}-${slug || 'report'}-${randomSuffix()}`;
      const ext = extForMime(file.type, file.name);
      const repoFilePath = `public/circulars/files/${id}.${ext}`;
      const publicFilePath = `/circulars/files/${id}.${ext}`;
      const metadataPath = `src/content/circulars/${id}.md`;

      setSave({ kind: 'uploading', step: ar ? 'تحويل الملف…' : 'Encoding file…' });
      const base64 = await fileToBase64(file);

      setSave({ kind: 'uploading', step: ar ? 'رفع الملف…' : 'Uploading file…' });
      await commitBinaryFile(repoFilePath, base64,
        ar ? `رفع تقرير: ${titleAr}` : `Upload report: ${titleEn || titleAr}`);

      setSave({ kind: 'uploading', step: ar ? 'حفظ البيانات…' : 'Saving metadata…' });
      const uploadedBy = (() => {
        try { const u = window.netlifyIdentity?.currentUser?.(); return u?.user_metadata?.full_name || u?.email || ''; }
        catch { return ''; }
      })();

      const fm: Record<string, unknown> = {
        id, title: { ar: titleAr.trim(), en: titleEn.trim() },
        category, date, file: publicFilePath,
        fileSize: file.size, fileType: file.type,
        ...(uploadedBy ? { uploadedBy } : {}),
      };

      const frontmatterYaml = stringifyYaml(fm, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' });
      await commitFile(metadataPath, `---\n${frontmatterYaml}---\n`,
        ar ? `بيانات تقرير: ${titleAr}` : `Report metadata: ${titleEn || titleAr}`);

      setSave({ kind: 'success' });
      setTimeout(() => { reset(); setOpen(false); }, 3000);
    } catch (err: any) {
      setSave({ kind: 'error', message: err?.message || (ar ? 'فشل الرفع.' : 'Upload failed.') });
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="report-uploader-wrap">
      {!open ? (
        <button type="button" className="report-uploader-trigger" onClick={() => setOpen(true)}>
          <span>+</span>
          {ar ? 'رفع تقرير جديد' : 'Upload New Report'}
        </button>
      ) : (
        <div className={`report-uploader-panel ${ar ? 'rtl' : 'ltr'}`} dir={ar ? 'rtl' : 'ltr'}>
          <div className="rup-header">
            <span className="rup-title">{ar ? '📄 رفع تقرير مالي أو وثيقة' : '📄 Upload Financial Report or Document'}</span>
            <button type="button" className="rup-close" onClick={() => { reset(); setOpen(false); }}>×</button>
          </div>

          <form onSubmit={handleSubmit} className="rup-form">
            <div className="rup-row">
              <label className="rup-label">{ar ? 'العنوان بالعربية *' : 'Arabic Title *'}</label>
              <input className="rup-input" dir="rtl" value={titleAr}
                onChange={e => setTitleAr(e.target.value)}
                placeholder={ar ? 'مثال: التقرير المالي الشهري — أيار 2026' : 'e.g. Monthly Financial Report — May 2026'}
                maxLength={120} />
            </div>
            <div className="rup-row">
              <label className="rup-label">{ar ? 'العنوان بالإنجليزية' : 'English Title'}</label>
              <input className="rup-input" dir="ltr" value={titleEn}
                onChange={e => setTitleEn(e.target.value)}
                placeholder="e.g. Monthly Financial Report — May 2026"
                maxLength={120} />
            </div>
            <div className="rup-row-2col">
              <div className="rup-row">
                <label className="rup-label">{ar ? 'النوع' : 'Category'}</label>
                <select className="rup-select" value={category} onChange={e => setCategory(e.target.value)}>
                  {REPORT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{ar ? c.ar : c.en}</option>
                  ))}
                </select>
              </div>
              <div className="rup-row">
                <label className="rup-label">{ar ? 'تاريخ الوثيقة' : 'Document Date'}</label>
                <input className="rup-input" type="date" value={date}
                  onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="rup-row">
              <label className="rup-label">{ar ? 'الملف (PDF, Word, Excel — حد أقصى 15 MB)' : 'File (PDF, Word, Excel — max 15 MB)'}</label>
              <div className="rup-file-zone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0] || null); }}>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={e => handleFile(e.target.files?.[0] || null)} />
                {file
                  ? <span className="rup-file-name">📎 {file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
                  : <span className="rup-file-placeholder">{ar ? 'اضغط أو اسحب الملف هنا' : 'Click or drag file here'}</span>
                }
              </div>
            </div>

            {save.kind === 'error' && (
              <div className="rup-msg rup-msg-error">{save.message}</div>
            )}
            {save.kind === 'uploading' && (
              <div className="rup-msg rup-msg-uploading">⏳ {save.step}</div>
            )}
            {save.kind === 'success' && (
              <div className="rup-msg rup-msg-success">
                {ar ? '✓ تم رفع التقرير بنجاح. سيظهر بعد إعادة البناء.' : '✓ Report uploaded successfully. It will appear after the next build.'}
              </div>
            )}

            <div className="rup-actions">
              <button type="submit" className="rup-btn-submit"
                disabled={save.kind === 'uploading' || save.kind === 'success'}>
                {save.kind === 'uploading' ? (ar ? 'جارٍ الرفع…' : 'Uploading…') : (ar ? 'رفع الوثيقة' : 'Upload Document')}
              </button>
              <button type="button" className="rup-btn-cancel"
                onClick={() => { reset(); setOpen(false); }}>
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
