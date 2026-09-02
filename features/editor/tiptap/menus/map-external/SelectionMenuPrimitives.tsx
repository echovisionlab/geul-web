'use client';

import type { ReactNode } from 'react';
import { Group, Paper } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { EditorToolbarTooltip, type EditorToolbarShortcutHint } from '@/features/editor/toolbars/EditorToolbarTooltip';
import { useSelectionToolbarEditorTabBridge, useSelectionToolbarNavigation } from '../useSelectionToolbarNavigation';

export interface SelectionMenuActionProps {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
  testId?: string;
  shortcut?: EditorToolbarShortcutHint;
}

export function SelectionMenuAction({
  label,
  children,
  onClick,
  pressed,
  disabled = false,
  tone = 'neutral',
  testId,
  shortcut,
}: SelectionMenuActionProps) {
  return (
    <EditorToolbarTooltip label={label} shortcut={shortcut}>
      <IconButton
        label={label}
        tone={pressed ? 'accent' : tone}
        emphasis={pressed ? 'medium' : 'low'}
        size="sm"
        aria-pressed={pressed}
        disabled={disabled || !onClick}
        data-testid={testId}
        data-selection-toolbar-action=""
        onClick={onClick}
      >
        {children}
      </IconButton>
    </EditorToolbarTooltip>
  );
}

export function SelectionMenuSurface({
  label,
  testId,
  children,
  onEscape,
  editorElement = null,
  navigationEnabled = false,
}: {
  label: string;
  testId: string;
  children: ReactNode;
  onEscape?: () => void;
  editorElement?: HTMLElement | null;
  navigationEnabled?: boolean;
}) {
  const navigation = useSelectionToolbarNavigation({ onEscape, enableVerticalArrows: true });
  useSelectionToolbarEditorTabBridge(editorElement, navigation.focusFirstAction, navigationEnabled, onEscape);

  return (
    <Paper
      ref={navigation.toolbarRef}
      role="toolbar"
      aria-label={label}
      withBorder
      shadow="sm"
      p={4}
      radius={0}
      data-testid={testId}
      onKeyDownCapture={navigation.onToolbarKeyDown}
      onFocusCapture={navigation.onToolbarFocusCapture}
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
    >
      <Group gap={2} wrap="nowrap">
        {children}
      </Group>
    </Paper>
  );
}
