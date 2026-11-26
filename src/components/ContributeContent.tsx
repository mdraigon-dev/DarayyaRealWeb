import { useEffect, useMemo, useRef, useState } from 'react';
import { t, loc, type Lang, type StringKey } from '../i18n/strings';
import { can } from '../data/permissions';
import { useIdentity } from '../data/use-identity';
import { GitConflictError, saveErrorMessage, type Change } from '../data/repo';
import { isAllowedImage, MAX_IMAGE_BYTES } from '../data/image-upload';
import {
  METHOD_TYPES, hasText, loadLivePage, methodHref, normalizePage, safeImageSrc,
  saveContributePage, prepareContributeImage, validateMethod,
  type Bi, type ContactMethod, type ContributePage, type MethodType, type ValidationError,
} from '../data/contribute';
import { scrollBehavior } from '../data/user-settings';
import TimeStamp from './TimeStamp';
import PhotoLightbox from './PhotoLightbox';

type Props = {
  lang: Lang;
  /** The page as published in this build */
  page: unknown;
};

const EMPTY_BI: Bi = { ar: '', en: '' };

/**
 * "How to contribute": public contact and payment details for the
 * Development Committee, edited in place by admins.
 */
export default function ContributeContent({ lang, page: built }: Props) {
  const identity = useIdentity();
  const isAdmin = identity.kind === 'authenticated' && can(identity.user, 'edit-contribute-page');
  const [page, setPage] = useState<ContributePage>(() => normalizePage(built));
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState(false);
  // Images uploaded this session aren't served until the rebuild; show the
  // local copy meanwhile.
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<number | null>(null);

  const methods = page.methods;
  const qrs = methods.filter((m) => m.type === 'qr' && (localImages[m.image || ''] || safeImageSrc(m.image)));
  const imgSrc = (m: ContactMethod) => localImages[m.image || ''] || safeImageSrc(m.image) || '';

  return (
    <section className="section contribute-page">
      <div className="section-header contribute-header">
        <div>
          <div className="section-eyebrow">{t(lang, 'contrib_eyebrow')}</div>
          <h1 className="section-title">{t(lang, 'contrib_title')}</h1>
          <p className="section-desc">{t(lang, 'contrib_desc')}</p>
        </div>
        {isAdmin && !editing && (
          <button type="button" className="contrib-edit-btn" onClick={() => setEditing(true)}>
            ✎ {t(lang, 'contrib_edit')}
          </button>
        )}
      </div>

      {editing && identity.kind === 'authenticated' ? (
        <ContributeEditor
          lang={lang}
          fallback={page}
          localImages={localImages}
          by={displayName(identity.user)}
          onCancel={() => setEditing(false)}
          onSaved={(next, newLocal) => {
            setPage(next);
            setLocalImages((s) => ({ ...s, ...newLocal }));
            setEditing(false);
            setFlash(true);
            setTimeout(() => setFlash(false), 8000);
            window.scrollTo({ top: 0, behavior: scrollBehavior() });
          }}
        />
      ) : (
        <>
          {flash && <div className="contrib-flash" role="status">✓ {t(lang, 'contrib_saved')}</div>}

          {hasText(page.intro) && <p className="contrib-intro" dir="auto">{loc(lang, page.intro)}</p>}

          {methods.length === 0 ? (
            <div className="contrib-empty">
              <p>
                {t(lang, 'contribute_msg_before')}{' '}
                <strong className="committee-name">{t(lang, 'committee_name')}</strong>{' '}
                {t(lang, 'contribute_msg_after')}
              </p>
              <p className="contrib-empty-sub">{t(lang, 'contrib_empty')}</p>
            </div>
          ) : (
            <div className="contrib-grid">
              {methods.map((m) => (
                <MethodCard
                  key={m.id}
                  m={m}
                  lang={lang}
                  img={imgSrc(m)}
                  onEnlarge={() => setLightbox(qrs.findIndex((q) => q.id === m.id))}
                />
              ))}
            </div>
          )}

          <div className="contrib-footer">
            <p className="contrib-safety" role="note">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" /><path d="M12 8v4M12 16h.01" /></svg>
              <span>{t(lang, 'contrib_safety')}</span>
            </p>
            {page.updatedAt && (
              <p className="contrib-updated">
                {t(lang, 'contrib_updated')}: <TimeStamp at={page.updatedAt} lang={lang} />
                {isAdmin && page.updatedBy ? ` · ${page.updatedBy}` : ''}
              </p>
            )}
          </div>
        </>
      )}

      {lightbox !== null && lightbox >= 0 && qrs[lightbox] && (
        <PhotoLightbox
          items={qrs.map((q) => ({ url: imgSrc(q), caption: loc(lang, q.label) || t(lang, 'contrib_type_qr'), date: '' }))}
          index={lightbox}
          lang={lang}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

function displayName(user: { email: string; user_metadata?: { full_name?: string } }): string {
  const n = (user.user_metadata?.full_name || '').trim();
  return n && !n.includes('@') ? n : '';
}

// ── Public card ─────────────────────────────────────────────────────────

const ACTION: Partial<Record<MethodType, StringKey>> = {
  phone: 'contrib_act_call',
  whatsapp: 'contrib_act_whatsapp',
  email: 'contrib_act_email',
  link: 'contrib_act_link',
  address: 'contrib_act_map',
};

function MethodCard({ m, lang, img, onEnlarge }: { m: ContactMethod; lang: Lang; img: string; onEnlarge: () => void }) {
  const [copied, setCopied] = useState(false);
  const label = loc(lang, m.label) || t(lang, `contrib_type_${m.type}` as StringKey);
  const href = methodHref(m);
  const external = m.type === 'link' || m.type === 'whatsapp' || m.type === 'address';
  const raw = m.type === 'address' || m.type === 'text' ? loc(lang, m.text) : (m.value || '');
  // Links read better without the scheme; copying still gives the full URL.
  const shown = m.type === 'link' ? raw.replace(/^https?:\/\//, '').replace(/\/$/, '') : raw;
  const copyable = m.type !== 'text' && m.type !== 'qr' && !!shown;
  const ltr = m.type === 'phone' || m.type === 'whatsapp' || m.type === 'email' || m.type === 'link';

  if ((m.type === 'qr' && !img) || (!shown && m.type !== 'qr')) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked; the text is selectable anyway */ }
  };

  return (
    <article className={`contrib-card contrib-card--${m.type}`}>
      <div className="contrib-card-head">
        <span className="contrib-icon" aria-hidden="true"><TypeIcon type={m.type} /></span>
        <div>
          <div className="contrib-type">{t(lang, `contrib_type_${m.type}` as StringKey)}</div>
          {label !== t(lang, `contrib_type_${m.type}` as StringKey) && <h2 className="contrib-label" dir="auto">{label}</h2>}
        </div>
      </div>

      {m.type === 'qr' ? (
        <button type="button" className="contrib-qr" onClick={onEnlarge} aria-label={`${t(lang, 'contrib_act_enlarge')}: ${label}`}>
          <img src={img} alt={label} loading="lazy" />
        </button>
      ) : (
        <div className={`contrib-value${ltr ? ' is-ltr' : ''}`} dir={ltr ? 'ltr' : 'auto'}>{shown}</div>
      )}

      {hasText(m.note) && <p className="contrib-note" dir="auto">{loc(lang, m.note)}</p>}

      <div className="contrib-actions">
        {href && ACTION[m.type] && (
          <a className="contrib-action primary" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {t(lang, ACTION[m.type]!)}
          </a>
        )}
        {copyable && (
          <button type="button" className="contrib-action" onClick={copy} aria-live="polite">
            {copied ? `✓ ${t(lang, 'contrib_act_copied')}` : t(lang, 'contrib_act_copy')}
          </button>
        )}
        {m.type === 'qr' && (
          <>
            <button type="button" className="contrib-action primary" onClick={onEnlarge}>{t(lang, 'contrib_act_enlarge')}</button>
            <a className="contrib-action" href={img} download>{t(lang, 'contrib_act_download')}</a>
          </>
        )}
      </div>
    </article>
  );
}

function TypeIcon({ type }: { type: MethodType }) {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'phone':
      return <svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>;
    case 'whatsapp':
      return <svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" /><path d="M9 9.5c.3 2 2.2 4 4.5 4.5" /></svg>;
    case 'email':
      return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>;
    case 'link':
      return <svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>;
    case 'address':
      return <svg {...p}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
    case 'text':
      return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
    case 'qr':
      return <svg {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></svg>;
  }
}

// ── Admin editor ────────────────────────────────────────────────────────

type Draft = ContactMethod & { file?: File | null; preview?: string };

const ERR: Record<ValidationError, StringKey> = {
  phone: 'contrib_err_phone',
  email: 'contrib_err_email',
  link: 'contrib_err_link',
  text: 'contrib_err_text',
  qr: 'contrib_err_qr',
};

function newMethod(type: MethodType): Draft {
  return {
    id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    type, label: { ...EMPTY_BI }, value: '', text: { ...EMPTY_BI }, image: '', note: { ...EMPTY_BI },
  };
}

function ContributeEditor({ lang, fallback, localImages, by, onCancel, onSaved }: {
  lang: Lang;
  fallback: ContributePage;
  localImages: Record<string, string>;
  by: string;
  onCancel: () => void;
  onSaved: (page: ContributePage, localImages: Record<string, string>) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<ContributePage>(fallback);
  const [sha, setSha] = useState<string | null>(null);
  const [intro, setIntro] = useState<Bi>(fallback.intro || EMPTY_BI);
  const [items, setItems] = useState<Draft[]>(fallback.methods);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstField = useRef<HTMLTextAreaElement>(null);

  // Start from the latest saved version, not this build's copy: a save made
  // a minute ago may not be deployed yet.
  useEffect(() => {
    let cancelled = false;
    loadLivePage()
      .then((live) => {
        if (cancelled || !live) return;
        setBase(live.page);
        setSha(live.sha);
        setIntro(live.page.intro || EMPTY_BI);
        setItems(live.page.methods);
      })
      .catch(() => { /* keep the build's copy; the save will re-check */ })
      .finally(() => { if (!cancelled) { setLoading(false); firstField.current?.focus(); } });
    return () => { cancelled = true; };
  }, []);

  const errors = useMemo(
    () => items.map((m) => (m.file && (!isAllowedImage(m.file) || m.file.size > MAX_IMAGE_BYTES)
      ? 'image' as const
      : validateMethod(m, m.file))),
    [items],
  );
  const invalid = errors.some(Boolean);

  const patch = (i: number, p: Partial<Draft>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => setItems((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const c = xs.slice();
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });

  const save = async () => {
    setShowErrors(true);
    setError('');
    if (invalid) { setError(t(lang, 'contrib_err_fix')); return; }
    setSaving(true);
    try {
      const newLocal: Record<string, string> = {};
      const images: Change[] = [];
      const ready: ContactMethod[] = [];
      for (const m of items) {
        let image = m.image;
        if (m.type === 'qr' && m.file) {
          const prepared = prepareContributeImage(m.file);
          image = prepared.src;
          images.push(prepared.change);
          if (m.preview) newLocal[image] = m.preview;
        }
        const { file, preview, ...rest } = m;
        ready.push({ ...rest, image });
      }
      const next = await saveContributePage({ page: { intro, methods: ready }, previous: base, sha, by, images });
      onSaved(next, newLocal);
    } catch (e) {
      setError(e instanceof GitConflictError ? t(lang, 'contrib_err_conflict') : saveErrorMessage(e, lang));
      setSaving(false);
    }
  };

  const biField = (value: Bi | undefined, onChange: (v: Bi) => void, opts: { rows?: number; placeholder?: string; invalid?: boolean; firstRef?: boolean } = {}) => (
    <div className="contrib-bi">
      {(['ar', 'en'] as const).map((l) => (
        <label key={l} className="contrib-bi-col">
          <span className="contrib-bi-lang">{t(lang, l === 'ar' ? 'contrib_lang_ar' : 'contrib_lang_en')}</span>
          {opts.rows ? (
            <textarea
              ref={opts.firstRef && l === 'ar' ? firstField : undefined}
              className={`editor-text-input${opts.invalid ? ' is-invalid' : ''}`}
              dir={l === 'ar' ? 'rtl' : 'ltr'}
              rows={opts.rows}
              value={value?.[l] || ''}
              placeholder={opts.placeholder && l === lang ? opts.placeholder : undefined}
              onChange={(e) => onChange({ ...(value || EMPTY_BI), [l]: e.target.value })}
            />
          ) : (
            <input
              className={`editor-text-input${opts.invalid ? ' is-invalid' : ''}`}
              dir={l === 'ar' ? 'rtl' : 'ltr'}
              value={value?.[l] || ''}
              placeholder={opts.placeholder && l === lang ? opts.placeholder : undefined}
              onChange={(e) => onChange({ ...(value || EMPTY_BI), [l]: e.target.value })}
            />
          )}
        </label>
      ))}
    </div>
  );

  return (
    <div className="contrib-editor" aria-busy={loading || saving}>
      <h2 className="editor-card-title">{t(lang, 'contrib_edit_title')}</h2>
      <p className="editor-field-hint">{t(lang, 'contrib_edit_hint')}</p>
      <p className="contrib-risk" role="note">⚠ {t(lang, 'contrib_edit_risk')}</p>
      {loading && <p className="editor-field-hint">{t(lang, 'contrib_loading')}</p>}

      <div className="editor-card">
        <div className="editor-field">
          <span className="contrib-field-label">{t(lang, 'contrib_intro')}</span>
          {biField(intro, setIntro, { rows: 4, firstRef: true })}
        </div>
      </div>

      <div className="editor-card">
        <div className="contrib-field-label">{t(lang, 'contrib_methods')}</div>
        {items.map((m, i) => {
          const err = showErrors ? errors[i] : null;
          const isValue = m.type === 'phone' || m.type === 'whatsapp' || m.type === 'email' || m.type === 'link';
          const preview = m.preview || localImages[m.image || ''] || safeImageSrc(m.image) || '';
          return (
            <div key={m.id} className={`editor-list-item contrib-edit-item${err ? ' has-error' : ''}`}>
              <div className="contrib-edit-head">
                <span className="contrib-type-badge"><TypeIcon type={m.type} /> {t(lang, `contrib_type_${m.type}` as StringKey)}</span>
                <div className="contrib-edit-tools">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t(lang, 'contrib_up')} title={t(lang, 'contrib_up')}>↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={t(lang, 'contrib_down')} title={t(lang, 'contrib_down')}>↓</button>
                  <button type="button" className="danger" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>✕ {t(lang, 'contrib_remove')}</button>
                </div>
              </div>

              <div className="editor-field">
                <span className="contrib-field-label">{t(lang, 'contrib_label')}</span>
                {biField(m.label, (v) => patch(i, { label: v }), { placeholder: t(lang, 'contrib_label_ph_phone') })}
              </div>

              {isValue && (
                <label className="editor-field">
                  <span className="contrib-field-label">{t(lang, `contrib_value_${m.type}` as StringKey)}</span>
                  <input
                    className={`editor-text-input${err ? ' is-invalid' : ''}`}
                    dir="ltr"
                    inputMode={m.type === 'email' ? 'email' : m.type === 'link' ? 'url' : 'tel'}
                    value={m.value || ''}
                    placeholder={m.type === 'email' ? 'name@example.org' : m.type === 'link' ? 'https://' : '+963 …'}
                    onChange={(e) => patch(i, { value: e.target.value })}
                  />
                </label>
              )}

              {(m.type === 'address' || m.type === 'text') && (
                <div className="editor-field">
                  <span className="contrib-field-label">{t(lang, `contrib_value_${m.type}` as StringKey)}</span>
                  {biField(m.text, (v) => patch(i, { text: v }), { rows: m.type === 'text' ? 5 : 3, invalid: !!err })}
                </div>
              )}

              {m.type === 'qr' && (
                <div className="editor-field">
                  <span className="contrib-field-label">{t(lang, 'contrib_value_qr')}</span>
                  <div className="contrib-qr-edit">
                    {preview && <img src={preview} alt="" />}
                    <div>
                      <label className="contrib-file-btn">
                        {preview ? t(lang, 'contrib_replace_image') : t(lang, 'contrib_choose_image')}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            if (f) patch(i, { file: f, preview: URL.createObjectURL(f) });
                          }}
                        />
                      </label>
                      <p className="editor-field-hint">{t(lang, 'contrib_image_hint')}</p>
                    </div>
                  </div>
                </div>
              )}

              {m.type !== 'text' && (
                <div className="editor-field">
                  <span className="contrib-field-label">{t(lang, 'contrib_note')}</span>
                  {biField(m.note, (v) => patch(i, { note: v }), { placeholder: t(lang, 'contrib_note_ph') })}
                </div>
              )}

              {err && <p className="contrib-field-error" role="alert">{t(lang, err === 'image' ? 'contrib_err_image' : ERR[err])}</p>}
            </div>
          );
        })}

        <div className="contrib-add-row">
          <span>{t(lang, 'contrib_add')}</span>
          {METHOD_TYPES.map((type) => (
            <button key={type} type="button" className="contrib-add-btn" onClick={() => setItems((xs) => [...xs, newMethod(type)])}>
              <TypeIcon type={type} /> {t(lang, `contrib_type_${type}` as StringKey)}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="contrib-field-error" role="alert">{error}</p>}
      <div className="contrib-editor-actions">
        <button type="button" className="editor-save-btn" onClick={save} disabled={saving || loading}>
          {saving ? t(lang, 'contrib_saving') : t(lang, 'contrib_save')}
        </button>
        <button type="button" className="contrib-cancel-btn" onClick={onCancel} disabled={saving}>{t(lang, 'contrib_cancel')}</button>
      </div>
    </div>
  );
}
