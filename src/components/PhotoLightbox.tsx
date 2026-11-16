import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '../i18n/strings';

export type LightboxItem = {
  url: string;
  caption: string;
  date: string;
  /** Stock placeholder rather than a real Darayya photo — labelled as such */
  illustrative?: boolean;
};

type Props = {
  items: LightboxItem[];
  index: number;
  lang: Lang;
  onIndex: (i: number) => void;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Full-screen photo viewer with zoom.
 *
 * Zoom: mouse wheel, the +/− buttons, keyboard (+ − 0), double-click/tap
 * (toggles 2.5×), or a two-finger pinch on touch screens. When zoomed in,
 * drag to pan. Zooming with the wheel or a double-click keeps the point under
 * the cursor fixed, so you zoom *into* the detail you're looking at.
 *
 * Rendered into document.body through a portal so no ancestor's overflow or
 * stacking context (cards, the Leaflet map) can clip or cover it.
 */
export default function PhotoLightbox({ items, index, lang, onIndex, onClose }: Props) {
  const ar = lang === 'ar';
  const item = items[index];
  const stageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [failed, setFailed] = useState(false);

  // Mirror of the transform in a ref, so native listeners (wheel) and pointer
  // handlers always read current values without being re-registered.
  const view = useRef({ scale: 1, tx: 0, ty: 0 });
  const apply = useCallback((s: number, x: number, y: number) => {
    const stage = stageRef.current;
    // Keep the image from being dragged entirely off-screen.
    const maxX = stage ? ((s - 1) * stage.clientWidth) / 2 : 0;
    const maxY = stage ? ((s - 1) * stage.clientHeight) / 2 : 0;
    const nx = s <= 1 ? 0 : clamp(x, -maxX, maxX);
    const ny = s <= 1 ? 0 : clamp(y, -maxY, maxY);
    view.current = { scale: s, tx: nx, ty: ny };
    setScale(s); setTx(nx); setTy(ny);
  }, []);

  /** Zoom to `next`, keeping the stage point (px, py) — relative to centre — fixed. */
  const zoomTo = useCallback((next: number, px = 0, py = 0) => {
    const { scale: s, tx: x, ty: y } = view.current;
    const ns = clamp(next, MIN_SCALE, MAX_SCALE);
    const ratio = ns / s;
    apply(ns, px - (px - x) * ratio, py - (py - y) * ratio);
  }, [apply]);

  const pointFromEvent = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { px: clientX - (r.left + r.width / 2), py: clientY - (r.top + r.height / 2) };
  };

  // Reset zoom when moving to another photo.
  useEffect(() => { apply(1, 0, 0); setFailed(false); }, [index, apply]);

  // Lock page scroll, focus the close button, restore focus on close.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  const go = useCallback((delta: number) => {
    if (items.length < 2) return;
    onIndex((index + delta + items.length) % items.length);
  }, [index, items.length, onIndex]);

  // Keyboard. Arrow keys follow the reading direction: in Arabic the next
  // photo is to the left.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowRight') { go(ar ? -1 : 1); return; }
      if (e.key === 'ArrowLeft') { go(ar ? 1 : -1); return; }
      if (e.key === '+' || e.key === '=') { zoomTo(view.current.scale * 1.5); return; }
      if (e.key === '-' || e.key === '_') { zoomTo(view.current.scale / 1.5); return; }
      if (e.key === '0') { apply(1, 0, 0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ar, go, onClose, zoomTo, apply]);

  // Wheel zoom. Registered natively as non-passive: React's onWheel is passive,
  // so it can't stop the page (or the browser) from scrolling/zooming instead.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { px, py } = pointFromEvent(e.clientX, e.clientY);
      const factor = Math.exp(-e.deltaY * 0.0025);
      zoomTo(view.current.scale * factor, px, py);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  // Pointer handling: one pointer pans (when zoomed), two pointers pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.current.scale };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = pointFromEvent((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomTo(pinch.current.scale * (dist / Math.max(1, pinch.current.dist)), mid.px, mid.py);
      moved.current = true;
      return;
    }
    if (pointers.current.size === 1 && view.current.scale > 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) moved.current = true;
      apply(view.current.scale, view.current.tx + dx, view.current.ty + dy);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const { px, py } = pointFromEvent(e.clientX, e.clientY);
    if (view.current.scale > 1) apply(1, 0, 0);
    else zoomTo(2.5, px, py);
  };

  // Clicking empty space around the image closes — but not at the end of a
  // drag or pinch, and not while zoomed (a stray click shouldn't lose your place).
  const onStageClick = (e: React.MouseEvent) => {
    if (moved.current) { moved.current = false; return; }
    if (e.target === e.currentTarget && view.current.scale <= 1) onClose();
  };

  if (!item || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="lb-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ar ? 'عرض الصورة' : 'Photo viewer'}
      dir={ar ? 'rtl' : 'ltr'}
    >
      <div className="lb-toolbar">
        {items.length > 1 && (
          <span className="lb-counter" dir="ltr">{index + 1} / {items.length}</span>
        )}
        {/* A spacer, not an auto margin on the counter: the counter is dir="ltr"
            so its logical margins would point the wrong way on Arabic pages. */}
        <span className="lb-spacer" aria-hidden="true" />
        <div className="lb-zoom" dir="ltr">
          <button type="button" onClick={() => zoomTo(scale / 1.5)} disabled={scale <= MIN_SCALE}
            aria-label={ar ? 'تصغير' : 'Zoom out'}>−</button>
          <button type="button" className="lb-zoom-level" onClick={() => apply(1, 0, 0)}
            title={ar ? 'الحجم الأصلي' : 'Reset zoom'}>{Math.round(scale * 100)}%</button>
          <button type="button" onClick={() => zoomTo(scale * 1.5)} disabled={scale >= MAX_SCALE}
            aria-label={ar ? 'تكبير' : 'Zoom in'}>+</button>
        </div>
        <a className="lb-open" href={item.url} target="_blank" rel="noopener noreferrer"
          title={ar ? 'فتح الصورة الأصلية' : 'Open original image'}>↗</a>
        <button type="button" ref={closeRef} className="lb-close" onClick={onClose}
          aria-label={ar ? 'إغلاق' : 'Close'}>✕</button>
      </div>

      <div
        ref={stageRef}
        className={`lb-stage ${scale > 1 ? 'is-zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onClick={onStageClick}
      >
        {failed ? (
          <div className="lb-failed">
            {ar ? 'تعذّر تحميل الصورة.' : "This image couldn't be loaded."}
          </div>
        ) : (
          <img
            className="lb-img"
            src={item.url}
            alt={item.caption}
            draggable={false}
            onError={() => setFailed(true)}
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          />
        )}
      </div>

      {items.length > 1 && (
        <>
          <button type="button" className="lb-nav lb-prev" onClick={() => go(-1)}
            aria-label={ar ? 'الصورة السابقة' : 'Previous photo'}>{ar ? '›' : '‹'}</button>
          <button type="button" className="lb-nav lb-next" onClick={() => go(1)}
            aria-label={ar ? 'الصورة التالية' : 'Next photo'}>{ar ? '‹' : '›'}</button>
        </>
      )}

      <div className="lb-caption">
        {item.illustrative && (
          <span className="lb-illustrative">★ {ar ? 'صورة توضيحية' : 'ILLUSTRATIVE'}</span>
        )}
        <span className="lb-caption-text">{item.caption}</span>
        {item.date && <span className="lb-caption-date">{item.date}</span>}
        <span className="lb-hint">
          {ar ? 'مرّر عجلة الفأرة أو انقر مرتين أو باعد بإصبعين للتكبير' : 'Scroll, double-click or pinch to zoom · drag to move'}
        </span>
      </div>
    </div>,
    document.body,
  );
}
