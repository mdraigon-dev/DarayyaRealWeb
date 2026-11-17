import { useState } from 'react';
import type { Lang } from '../i18n/strings';

type Props = {
  lang: Lang;
  /** What is being deleted, for the button's accessible label ("note", "photo") */
  what: string;
  /** Performs the delete; reject to show an error and let the admin retry */
  onConfirm: () => Promise<void>;
  /** 'overlay' sits on top of a photo; 'inline' sits in a text row */
  variant?: 'overlay' | 'inline';
  /** Extra consequence shown while confirming, e.g. "Also subtracts $500" */
  warning?: string;
};

type State = { kind: 'idle' } | { kind: 'confirm' } | { kind: 'deleting' } | { kind: 'error'; message: string };

/**
 * Small admin-only trash button with an inline "Delete? Yes / No" step.
 * Inline rather than window.confirm(), so nothing blocks the page and the
 * confirmation sits right next to the item being removed. Every click stops
 * propagation so a button on a photo never also opens the lightbox.
 */
export default function AdminDeleteButton({ lang, what, onConfirm, variant = 'inline', warning }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const ar = lang === 'ar';
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };

  const run = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setState({ kind: 'deleting' });
    try {
      await onConfirm();
      // The parent removes the item; nothing left to reset here.
    } catch (err: any) {
      const raw = err?.message || '';
      const message = raw === 'ITEM_NOT_FOUND'
        ? (ar ? 'العنصر غير موجود — ربما حُذف مسبقاً.' : 'Not found — it may already be deleted.')
        : (ar ? 'تعذّر الحذف. حاول مجدداً.' : "Couldn't delete. Try again.");
      setState({ kind: 'error', message });
    }
  };

  const cls = `admin-del admin-del-${variant}`;

  if (state.kind === 'idle' || state.kind === 'error') {
    return (
      <span className={cls} onClick={stop} onKeyDown={stop}>
        <button
          type="button"
          className="admin-del-btn"
          onClick={(e) => { e.stopPropagation(); setState({ kind: 'confirm' }); }}
          title={ar ? `حذف ${what}` : `Delete ${what}`}
          aria-label={ar ? `حذف ${what}` : `Delete ${what}`}
        >
          🗑
        </button>
        {state.kind === 'error' && <span className="admin-del-error">{state.message}</span>}
      </span>
    );
  }

  return (
    <span className={`${cls} admin-del-open`} onClick={stop} onKeyDown={stop} role="group">
      <span className="admin-del-q">{state.kind === 'deleting' ? (ar ? 'جارٍ الحذف…' : 'Deleting…') : (ar ? 'حذف؟' : 'Delete?')}</span>
      {warning && state.kind === 'confirm' && <span className="admin-del-warning">{warning}</span>}
      {state.kind === 'confirm' && (
        <>
          <button type="button" className="admin-del-yes" onClick={run}>{ar ? 'نعم' : 'Yes'}</button>
          <button
            type="button"
            className="admin-del-no"
            onClick={(e) => { e.stopPropagation(); setState({ kind: 'idle' }); }}
          >
            {ar ? 'لا' : 'No'}
          </button>
        </>
      )}
    </span>
  );
}
