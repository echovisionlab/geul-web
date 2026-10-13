'use client';

import { ToolbarSurface } from '@/components/core/Section';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import type { ReactNode } from 'react';

import { EditorToolbarAction, type EditorToolbarActionProps } from '@/features/editor/toolbars/EditorToolbarAction';
import { useSelectionToolbarEditorTabBridge, useSelectionToolbarNavigation } from '../useSelectionToolbarNavigation';

export type SelectionMenuActionProps = Omit<EditorToolbarActionProps, 'popoverTarget' | 'focusHint'>;

/** Selection menus consume the shared editor toolbar command adapter. */
export function SelectionMenuAction(props: SelectionMenuActionProps) {
  return <EditorToolbarAction {...props} />;
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
    <ToolbarSurface
      ref={navigation.toolbarRef}
      label={label}
      density="compact"
      wrap="nowrap"
      data-testid={testId}
      onKeyDownCapture={navigation.onToolbarKeyDown}
      onFocusCapture={navigation.onToolbarFocusCapture}
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
    >
      <DsLayoutInline gap="xxs" wrap="nowrap">
        {children}
      </DsLayoutInline>
    </ToolbarSurface>
  );
}
