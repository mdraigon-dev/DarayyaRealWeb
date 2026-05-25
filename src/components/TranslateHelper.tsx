import { useState } from 'react';
import { t, type Lang } from '../i18n/strings';

type Props = { lang: Lang };

/**
 * Small Arabic → English translation tool that lives in the admin dashboard.
 *
 * Calls MyMemory's free public API directly from the browser. Each visitor's
 * IP gets its own daily quota (5,000 chars), so this won't share quota with
 * the build-time translator.
 *
 * Useful for:
 *   - Spot-checking how MyMemory would translate something before saving
 *   - Translating ad-hoc text (e.g. a new alert message) without opening
 *     a separate translation tab
 *   - Reviewing the quality of past auto-translations
 */
export default function TranslateHelper({ lang }: Props) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const translate = async () => {
    const text = input.trim();
    if (!text) return;
    setStatus('loading');
    setError('');
    setOutput('');
    try {
      // Truncate to MyMemory's 500-byte limit
      let q = text;
      // Rough chars→bytes for UTF-8 Arabic (2 bytes/char average)
      if (q.length > 240) q = q.slice(0, 240) + '…';

      const params = new URLSearchParams({
        q,
        langpair: 'ar|en',
      });
      const url = `https://api.mymemory.translated.net/get?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.responseStatus !== 200) {
        throw new Error(data.responseDetails || `API status ${data.responseStatus}`);
      }
      const translated = data.responseData?.translatedText;
      if (!translated || translated.toUpperCase().startsWith('MYMEMORY WARNING')) {
        throw new Error(lang === 'ar' ? 'لا توجد ترجمة' : 'No translation available');
      }
      setOutput(translated);
      setStatus('idle');
    } catch (err: any) {
      setError(err?.message || 'Translation failed');
      setStatus('error');
    }
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block clipboard from non-secure contexts; ignore
    }
  };

  return (
    <div className="translate-helper">
      <div className="translate-helper-header">
        <span style={{ color: 'var(--sy-gold)' }}>◆</span>
        <h3>{lang === 'ar' ? 'مساعد الترجمة (عربي → إنجليزي)' : 'Translation Helper (AR → EN)'}</h3>
      </div>
      <p className="translate-helper-desc">
        {lang === 'ar'
          ? 'الصق نصاً بالعربية لتتلقى ترجمة سريعة بالإنجليزية. هذه ترجمة آلية للمساعدة فقط — راجعها قبل النشر.'
          : 'Paste Arabic text to get a quick English translation. Machine-translated for assistance only — please review before publishing.'}
      </p>

      <div className="translate-helper-grid">
        <div className="translate-helper-col">
          <label>{lang === 'ar' ? 'النص العربي' : 'Arabic text'}</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={lang === 'ar' ? 'اكتب أو الصق هنا…' : 'Type or paste here…'}
            dir="rtl"
            rows={4}
            maxLength={240}
          />
          <div className="translate-helper-meta">
            <span>{input.length} / 240</span>
            <button
              className="btn-primary translate-helper-btn"
              onClick={translate}
              disabled={!input.trim() || status === 'loading'}
            >
              {status === 'loading'
                ? (lang === 'ar' ? 'جاري…' : 'Translating…')
                : (lang === 'ar' ? 'ترجم ←' : 'Translate →')}
            </button>
          </div>
        </div>

        <div className="translate-helper-col">
          <label>{lang === 'ar' ? 'الترجمة الإنجليزية' : 'English translation'}</label>
          <textarea
            value={output}
            readOnly
            placeholder={lang === 'ar' ? '(ستظهر هنا)' : '(will appear here)'}
            dir="ltr"
            rows={4}
          />
          <div className="translate-helper-meta">
            {status === 'error' && <span style={{ color: 'var(--sy-red)' }}>✗ {error}</span>}
            {output && (
              <button
                className="btn-secondary translate-helper-btn"
                onClick={copyOutput}
              >
                {copied
                  ? (lang === 'ar' ? '✓ نُسخ' : '✓ Copied')
                  : (lang === 'ar' ? '📋 نسخ' : '📋 Copy')}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="translate-helper-footer">
        {lang === 'ar'
          ? 'مدعوم بـ MyMemory (مجاني). الحد اليومي ٥٠٠٠ حرف لكل عنوان IP.'
          : 'Powered by MyMemory (free tier). Daily limit: 5,000 chars per IP.'}
      </p>
    </div>
  );
}
