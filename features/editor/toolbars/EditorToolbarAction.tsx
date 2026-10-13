'use client';

import type { MouseEvent, PointerEvent, ReactNode } from 'react';
import { IconButton } from '@/components/core/IconButton';
import { Popover } from '@/components/core/Popover';
import { EditorToolbarTooltip, type EditorToolbarShortcutHint } from './EditorToolbarTooltip';

export interface EditorToolbarActionProps {
  label: string;
  children: ReactNode;
  /** Omitted commands are unavailable and render disabled. */
  onClick?: () => void;
  /** Toggle state. Core owns its aria-pressed semantics and selected appearance. */
  pressed?: boolean;
  disabled?: boolean;
  /** Command meaning for non-toggle actions such as removal. */
  tone?: 'neutral' | 'danger';
  shortcut?: EditorToolbarShortcutHint;
  /** Show the hint on keyboard focus as well as hover. */
  focusHint?: boolean;
  testId?: string;
  'data-test'?: string;
  /** Lets a Core Popover own this command as its trigger. */
  popoverTarget?: boolean;
}

/** Editor commands act on the document selection, so pointer activation must not move focus out of it. */
function preserveEditorSelection(event: MouseEvent | PointerEvent) {
  event.preventDefault();
}

/**
 * The single editor toolbar command adapter: Core IconButton geometry and pressed state,
 * the editor shortcut hint and selection-preserving pointer activation. Toolbar keyboard
 * navigation discovers it through `data-selection-toolbar-action`.
 */
export function EditorToolbarAction({
  label,
  children,
  onClick,
  pressed,
  disabled = false,
  tone = 'neutral',
  shortcut,
  focusHint = false,
  testId,
  'data-test': dataTest,
  popoverTarget = false,
}: EditorToolbarActionProps) {
  const appearance = pressed === undefined ? { tone, emphasis: 'low' as const } : { pressed };
  const action = (
    <EditorToolbarTooltip label={label} shortcut={shortcut} focusHint={focusHint}>
      <IconButton
        label={label}
        size="sm"
        {...appearance}
        disabled={disabled || !onClick}
        data-selection-toolbar-action=""
        data-testid={testId}
        data-test={dataTest}
        onPointerDown={preserveEditorSelection}
        onMouseDown={preserveEditorSelection}
        onClick={onClick}
      >
        {children}
      </IconButton>
    </EditorToolbarTooltip>
  );
  return popoverTarget ? <Popover.Target>{action}</Popover.Target> : action;
}
