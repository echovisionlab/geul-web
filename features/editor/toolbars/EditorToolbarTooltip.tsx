'use client';

import { useEffect, useRef, useState, type ReactElement, type Ref, type RefObject } from 'react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { Tooltip, TooltipContent, TooltipShortcut } from '@/components/core/Tooltip';

export const EDITOR_TOOLBAR_SHORTCUTS = {
  bold: 'Mod-b',
  italic: 'Mod-i',
  underline: 'Mod-u',
  strike: 'Mod-Shift-s',
  code: 'Mod-e',
  apply: 'Mod-Enter',
  suggestions: 'Mod-Space',
} as const;

export const EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS = ['Ctrl-Shift-ArrowLeft', 'Ctrl-Shift-ArrowRight'] as const;

export type EditorToolbarShortcut =
  | (typeof EDITOR_TOOLBAR_SHORTCUTS)[keyof typeof EDITOR_TOOLBAR_SHORTCUTS]
  | (typeof EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS)[number];
export type EditorToolbarShortcutHint = EditorToolbarShortcut | typeof EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS;

export interface EditorToolbarPlatform {
  platform: string;
  maxTouchPoints: number;
}

export function formatEditorToolbarShortcut(
  shortcut: EditorToolbarShortcut,
  { platform, maxTouchPoints }: EditorToolbarPlatform,
): string {
  if (shortcut === 'Ctrl-Shift-ArrowLeft') {
    return 'Ctrl ⇧ ←';
  }
  if (shortcut === 'Ctrl-Shift-ArrowRight') {
    return 'Ctrl ⇧ →';
  }
  const apple = /Mac|iPhone|iPad|iPod/i.test(platform) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const shift = shortcut.includes('-Shift-');
  const rawKey = shortcut.slice(shortcut.lastIndexOf('-') + 1);
  const key = rawKey === 'Enter' ? '↵' : rawKey === 'Space' ? 'Space' : rawKey.toUpperCase();
  return apple
    ? ['⌘', shift ? '⇧' : null, key].filter(Boolean).join(' ')
    : ['Ctrl', shift ? 'Shift' : null, key].filter(Boolean).join(' ');
}

export function formatEditorToolbarShortcutHint(
  shortcut: EditorToolbarShortcutHint,
  platform: EditorToolbarPlatform,
): string {
  if (typeof shortcut !== 'string') {
    return 'Ctrl ⇧ ←/→';
  }
  return formatEditorToolbarShortcut(shortcut, platform);
}

function useDisplayedShortcut(shortcut?: EditorToolbarShortcutHint): string | null {
  const [displayed, setDisplayed] = useState<string | null>(null);
  useEffect(() => {
    if (!shortcut) {
      setDisplayed(null);
      return;
    }
    setDisplayed(
      formatEditorToolbarShortcutHint(shortcut, {
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
      }),
    );
  }, [shortcut]);
  return displayed;
}

export function EditorToolbarShortcutText({ shortcut }: { shortcut: EditorToolbarShortcutHint }) {
  const displayedShortcut = useDisplayedShortcut(shortcut);
  return displayedShortcut ? <TooltipShortcut>{displayedShortcut}</TooltipShortcut> : null;
}

export function EditorToolbarTooltipContent({
  label,
  shortcut,
}: {
  label: string;
  shortcut?: EditorToolbarShortcutHint;
}) {
  const displayedShortcut = useDisplayedShortcut(shortcut);
  return (
    <span data-editor-toolbar-tooltip-content="">
      <TooltipContent label={label} shortcut={displayedShortcut} />
    </span>
  );
}

export function EditorToolbarTooltip({
  label,
  shortcut,
  children,
  focusHint = true,
}: {
  label: string;
  shortcut?: EditorToolbarShortcutHint;
  focusHint?: boolean;
  children: ReactElement<{ ref?: Ref<HTMLElement> }>;
}) {
  return (
    <Tooltip
      events={{ focus: focusHint }}
      openDelay={0}
      closeDelay={0}
      withArrow
      label={<EditorToolbarTooltipContent label={label} shortcut={shortcut} />}
    >
      {children}
    </Tooltip>
  );
}

/** Lets DropdownMenu own the actual trigger while the tooltip observes the same button by ref. */
export function EditorToolbarDropdownTarget({
  label,
  shortcut,
  children,
  focusHint = true,
}: {
  label: string;
  shortcut?: EditorToolbarShortcutHint;
  focusHint?: boolean;
  children: (targetRef: RefObject<HTMLButtonElement | null>) => ReactElement;
}) {
  const targetRef = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu.Target>
      <Tooltip
        events={{ focus: focusHint }}
        openDelay={0}
        closeDelay={0}
        withArrow
        label={<EditorToolbarTooltipContent label={label} shortcut={shortcut} />}
      >
        {children(targetRef)}
      </Tooltip>
    </DropdownMenu.Target>
  );
}
