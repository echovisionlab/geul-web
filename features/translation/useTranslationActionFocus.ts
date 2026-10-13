'use client';

import { useLayoutEffect, useRef } from 'react';

/** Keep the current language command reachable when a job disables or removes it. */
export function useTranslationActionFocus() {
  const commands = useRef(new Map<string, HTMLButtonElement>());
  const intent = useRef<{ current: HTMLButtonElement; generateId: string; cancelId?: string } | null>(null);

  useLayoutEffect(() => {
    const pending = intent.current;
    if (!pending) {
      return;
    }
    const document = pending.current.ownerDocument;
    const ownsFocus =
      document.activeElement === pending.current ||
      (document.activeElement === document.body && (!pending.current.isConnected || pending.current.disabled));
    if (!ownsFocus) {
      // A deliberate navigation elsewhere always wins over a background transition.
      intent.current = null;
      return;
    }
    const cancel = pending.cancelId ? commands.current.get(pending.cancelId) : undefined;
    const generate = commands.current.get(pending.generateId);
    const next = cancel && !cancel.disabled ? cancel : generate && !generate.disabled ? generate : undefined;
    if (next) {
      next.focus({ preventScroll: true });
      pending.current = next;
      if (next === generate) {
        intent.current = null;
      }
    }
  });

  return {
    commandRef: (id: string) => (node: HTMLButtonElement | null) => {
      if (node) {
        commands.current.set(id, node);
      } else {
        commands.current.delete(id);
      }
    },
    rememberCommand: (current: HTMLElement, generateId: string, cancelId?: string) => {
      if (current instanceof HTMLButtonElement && current.ownerDocument.activeElement === current) {
        intent.current = { current, generateId, cancelId };
      }
    },
  };
}
