'use client';

import { cloneElement, useEffect, useRef, useState, type ReactElement, type Ref, type RefObject } from 'react';
import { useMergedRef } from '@mantine/hooks';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { Tooltip } from '@/components/core/Tooltip';
import classes from './EditorToolbarTooltip.module.css';

export const EDITOR_TOOLBAR_SHORTCUTS = {
  bold: 'Mod-b',
  italic: 'Mod-i',
  underline: 'Mod-u',
  strike: 'Mod-Shift-s',
  code: 'Mod-e',
  ai: 'Mod-j',
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
  return displayedShortcut ? <kbd className={classes.shortcut}>{displayedShortcut}</kbd> : null;
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
    <span className={classes.content} data-editor-toolbar-tooltip-content="">
      <span className={classes.label}>{label}</span>
      {displayedShortcut ? <kbd className={classes.shortcut}>{displayedShortcut}</kbd> : null}
    </span>
  );
}

export function EditorToolbarTooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: EditorToolbarShortcutHint;
  children: ReactElement<{ ref?: Ref<HTMLElement> }>;
}) {
  const targetRef = useRef<HTMLElement>(null);
  const mergedRef = useMergedRef(targetRef, children.props.ref);
  return (
    <>
      {cloneElement(children, { ref: mergedRef })}
      <EditorToolbarTargetTooltip label={label} shortcut={shortcut} target={targetRef} />
    </>
  );
}

function EditorToolbarTargetTooltip({
  label,
  shortcut,
  target,
}: {
  label: string;
  shortcut?: EditorToolbarShortcutHint;
  target: RefObject<HTMLElement | null>;
}) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const element = target.current;
    if (!element) {
      return;
    }
    let focused = element.matches(':focus');
    let hovered = false;
    const sync = () => setOpened(focused || hovered);
    const onFocusIn = () => {
      focused = true;
      sync();
    };
    const onFocusOut = () => {
      focused = false;
      sync();
    };
    const onMouseEnter = () => {
      hovered = true;
      sync();
    };
    const onMouseLeave = () => {
      hovered = false;
      sync();
    };
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    element.addEventListener('mouseenter', onMouseEnter);
    element.addEventListener('mouseleave', onMouseLeave);
    return () => {
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
      element.removeEventListener('mouseenter', onMouseEnter);
      element.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [target]);

  return (
    <Tooltip
      target={target}
      opened={opened}
      label={<EditorToolbarTooltipContent label={label} shortcut={shortcut} />}
      classNames={{ tooltip: classes.tooltip }}
      arrowSize={3}
      offset={4}
      transitionProps={{ duration: 80 }}
      withArrow
    />
  );
}

/** Lets DropdownMenu own the actual trigger while the tooltip observes the same button by ref. */
export function EditorToolbarDropdownTarget({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: EditorToolbarShortcutHint;
  children: (targetRef: RefObject<HTMLButtonElement | null>) => ReactElement;
}) {
  const targetRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DropdownMenu.Target>{children(targetRef)}</DropdownMenu.Target>
      <EditorToolbarTargetTooltip label={label} shortcut={shortcut} target={targetRef} />
    </>
  );
}
