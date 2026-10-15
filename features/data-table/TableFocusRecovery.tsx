'use client';

import { useEffect, useRef } from 'react';

const ROW_SELECTOR = '[data-datatable-desktop-row], [data-datatable-mobile-row]';
const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"]';

/** Recover only when the table row that opened an overlay was actually removed. */
export function TableFocusRecovery() {
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const table = markerRef.current?.closest<HTMLElement>('[data-datatable-root]');
    if (!table) {
      return;
    }
    let origin: HTMLElement | null = null;
    let originKey: string | null = null;
    let waiting: MutationObserver | null = null;
    const reset = () => {
      waiting?.disconnect();
      waiting = null;
      origin = null;
      originKey = null;
    };
    const recover = () => {
      // An open modal/menu still owns focus. React Aria restores valid origins itself.
      if (document.querySelector(OVERLAY_SELECTOR)) {
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && active.isConnected) {
        reset();
        return;
      }
      const target = table.querySelector<HTMLElement>(
        'input:not([type="checkbox"]):not([disabled]), [data-datatable-row-action-control], button:not([disabled]), a[href]',
      );
      reset();
      target?.focus({ preventScroll: true });
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (table.contains(target)) {
        reset();
        origin = target;
        const row = target.closest<HTMLElement>(ROW_SELECTOR);
        originKey =
          row?.getAttribute('data-datatable-desktop-row') ?? row?.getAttribute('data-datatable-mobile-row') ?? null;
      } else if (target !== document.body && !target.closest(OVERLAY_SELECTOR)) {
        // A user moving to a different control takes precedence over recovery.
        reset();
      }
    };
    const observer = new MutationObserver(() => {
      if (!origin || origin.isConnected || !originKey || waiting) {
        return;
      }
      const rowStillExists = Array.from(table.querySelectorAll<HTMLElement>(ROW_SELECTOR)).some(
        (row) =>
          (row.getAttribute('data-datatable-desktop-row') ?? row.getAttribute('data-datatable-mobile-row')) ===
          originKey,
      );
      if (rowStillExists) {
        return;
      }
      waiting = new MutationObserver(recover);
      waiting.observe(document.body, { childList: true, subtree: true });
      recover();
    });
    observer.observe(table, { childList: true, subtree: true });
    document.addEventListener('focusin', onFocus);
    return () => {
      observer.disconnect();
      reset();
      document.removeEventListener('focusin', onFocus);
    };
  }, []);
  return <span ref={markerRef} hidden aria-hidden />;
}
