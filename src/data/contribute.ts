/**
 * contribute.ts — the "How to contribute" page's data.
 *
 * One JSON file in the repo (src/content/contribute/page.json) holds the
 * intro text and an ordered list of contact methods. Admins edit it in place
 * on the page; the save is a single Git Gateway commit (plus one commit per
 * new QR image), and the public page updates on the next deploy.
 *
 * Because this page tells people where to send money, every link it renders
 * is built here from a validated value — never an arbitrary href.
 */
import { commitBinaryFile, commitFile, deleteFile, getFileContent } from './git-gateway';
import { isAllowedImage, MAX_IMAGE_BYTES } from './image-upload';

export const CONTRIBUTE_PATH = 'src/content/contribute/page.json';

export type Bi = { ar: string; en: string };
export type MethodType = 'phone' | 'whatsapp' | 'email' | 'link' | 'address' | 'text' | 'qr';
export const METHOD_TYPES: MethodType[] = ['phone', 'whatsapp', 'email', 'link', 'address', 'text', 'qr'];

export type ContactMethod = {
  id: string;
  type: MethodType;
  label?: Bi;
  value?: string;
  text?: Bi;
  image?: string;
  note?: Bi;
};

export type ContributePage = {
  intro?: Bi;
  methods: ContactMethod[];
  updatedAt?: string;
  updatedBy?: string;
};

const bi = (v: unknown): Bi => (v && typeof v === 'object'
  ? { ar: String((v as any).ar ?? ''), en: String((v as any).en ?? '') }
  : { ar: '', en: '' });
export const hasText = (b?: Partial<Bi>) => !!((b?.ar || '').trim() || (b?.en || '').trim());

/** Coerce whatever is in the file into a clean page; unknown types are dropped. */
export function normalizePage(raw: unknown): ContributePage {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const methods = Array.isArray(r.methods) ? r.methods : [];
  return {
    intro: bi(r.intro),
    methods: methods
      .filter((m: any) => m && METHOD_TYPES.includes(m.type))
      .map((m: any, i: number) => ({
        id: String(m.id || `m${i + 1}`),
        type: m.type as MethodType,
        label: bi(m.label),
        value: typeof m.value === 'string' ? m.value : '',
        text: bi(m.text),
        image: typeof m.image === 'string' ? m.image : '',
        note: bi(m.note),
      })),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    updatedBy: typeof r.updatedBy === 'string' ? r.updatedBy : undefined,
  };
}

// ── Values and the links built from them ────────────────────────────────

/** Arabic-Indic / Persian digits → ASCII, so tel: and wa.me links work. */
export function asciiDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

/** https://… or http://… only. Adds https:// when the scheme was left off. */
export function normalizeUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function phoneDigits(value: string): string {
  return asciiDigits(value).replace(/[^\d+]/g, '');
}

export type ValidationError = 'phone' | 'email' | 'link' | 'text' | 'qr';

/** Why a method can't be saved, or null if it's fine. */
export function validateMethod(m: ContactMethod, pendingImage?: File | null): ValidationError | null {
  switch (m.type) {
    case 'phone':
    case 'whatsapp': {
      const d = phoneDigits(m.value || '').replace(/^\+/, '');
      return /^\d{6,15}$/.test(d) ? null : 'phone';
    }
    case 'email':
      return EMAIL_RE.test((m.value || '').trim()) ? null : 'email';
    case 'link':
      return normalizeUrl(m.value || '') ? null : 'link';
    case 'address':
    case 'text':
      return hasText(m.text) ? null : 'text';
    case 'qr':
      return m.image || pendingImage ? null : 'qr';
  }
}

/** The action link for a method (or null when it has none). */
export function methodHref(m: ContactMethod): string | null {
  const v = (m.value || '').trim();
  switch (m.type) {
    case 'phone': {
      const d = phoneDigits(v);
      return d ? `tel:${d}` : null;
    }
    case 'whatsapp': {
      // wa.me wants the full international number, digits only
      const d = phoneDigits(v).replace(/^\+/, '').replace(/^00/, '');
      return d ? `https://wa.me/${d}` : null;
    }
    case 'email':
      return EMAIL_RE.test(v) ? `mailto:${v}` : null;
    case 'link':
      return normalizeUrl(v);
    case 'address': {
      const q = (m.text?.ar || m.text?.en || '').trim().replace(/\s*\n\s*/g, ', ');
      return q ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}` : null;
    }
    default:
      return null;
  }
}

/** Only images we uploaded ourselves are shown. */
export function safeImageSrc(src?: string): string | null {
  return src && /^\/uploads\/contribute\/[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(src) ? src : null;
}

// ── Saving ──────────────────────────────────────────────────────────────

export async function loadLivePage(): Promise<{ page: ContributePage; sha: string | null } | null> {
  const f = await getFileContent(CONTRIBUTE_PATH);
  if (!f) return null;
  try {
    return { page: normalizePage(JSON.parse(f.content)), sha: f.sha };
  } catch {
    return { page: normalizePage({}), sha: f.sha };
  }
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export async function uploadContributeImage(file: File, message: string): Promise<string> {
  if (!isAllowedImage(file)) throw new Error('IMAGE_TYPE');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('IMAGE_SIZE');
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[file.type]}`;
  await commitBinaryFile(`public/uploads/contribute/${name}`, await fileToBase64(file), message);
  return `/uploads/contribute/${name}`;
}

/** Strip a method down to the fields its type uses, with clean values. */
function cleanMethod(m: ContactMethod): ContactMethod {
  const out: ContactMethod = { id: m.id, type: m.type };
  if (hasText(m.label)) out.label = { ar: m.label!.ar.trim(), en: m.label!.en.trim() };
  if (m.type === 'phone' || m.type === 'whatsapp') out.value = asciiDigits((m.value || '').trim());
  if (m.type === 'email') out.value = (m.value || '').trim();
  if (m.type === 'link') out.value = normalizeUrl(m.value || '') || '';
  if (m.type === 'address' || m.type === 'text') out.text = { ar: m.text!.ar.trim(), en: m.text!.en.trim() };
  if (m.type === 'qr') out.image = m.image;
  if (hasText(m.note)) out.note = { ar: m.note!.ar.trim(), en: m.note!.en.trim() };
  return out;
}

/**
 * Commit the page. `sha` pins the version the editor started from, so two
 * admins editing at once can't silently overwrite each other (GitConflictError).
 * Images no longer used afterwards are removed, best effort.
 */
export async function saveContributePage(opts: {
  page: ContributePage;
  previous: ContributePage;
  sha: string | null;
  by: string;
}): Promise<ContributePage> {
  const next: ContributePage = {
    intro: { ar: (opts.page.intro?.ar || '').trim(), en: (opts.page.intro?.en || '').trim() },
    methods: opts.page.methods.map(cleanMethod),
    updatedAt: new Date().toISOString(),
    updatedBy: opts.by || undefined,
  };
  const json = JSON.stringify(next, null, 2) + '\n';
  await commitFile(CONTRIBUTE_PATH, json, `Update "How to contribute" page by ${opts.by || 'admin'}`, 'main', opts.sha ?? undefined);

  const kept = new Set(next.methods.map((m) => m.image).filter(Boolean));
  for (const m of opts.previous.methods) {
    const src = safeImageSrc(m.image);
    if (src && !kept.has(src)) {
      deleteFile(`public${src}`, `Remove unused contribution image ${src}`).catch(() => {});
    }
  }
  return next;
}
