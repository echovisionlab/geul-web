'use client';

import type { FocusEventHandler, KeyboardEventHandler, PointerEventHandler, ReactNode, RefObject } from 'react';
import { ResizeHandle } from '@/components/core/ResizeHandle';
import { BlockSelectionTarget } from '@/components/core/SelectionSurface';
import { TextInput } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';
import { Text } from '@/components/core/Typography';
import classes from './EditorMediaBlockShell.module.css';
import { preventNativeBlockDrag } from './preventNativeBlockDrag';

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

/** Keyboard selection target for blocks whose authored source has its own editing controls. */
export function EditorMediaBlockSelector({
  label,
  enabled,
  onSelect,
}: {
  label: string;
  enabled: boolean;
  onSelect: () => void;
}) {
  return (
    <BlockSelectionTarget
      label={label}
      tabIndex={enabled ? 0 : -1}
      data-editor-block-selector=""
      onFocus={onSelect}
      onClick={onSelect}
    />
  );
}

interface EditorMediaBlockFrameProps {
  className?: string;
  containerRef?: RefObject<HTMLElement | null>;
  widthPercent: number;
  margin?: string;
  allowResize: boolean;
  suppressStaticTextSelection?: boolean;
  isResizing?: boolean;
  selected?: boolean;
  onResizeLeftPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onResizeRightPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onResizePointerMove?: PointerEventHandler<HTMLDivElement>;
  onResizePointerEnd?: PointerEventHandler<HTMLDivElement>;
  resizeMin?: number;
  resizeMax?: number;
  resizeLeftLabel?: string;
  resizeRightLabel?: string;
  onResizeLeftKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  onResizeRightKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  onResizeBlur?: FocusEventHandler<HTMLButtonElement>;
  children: ReactNode;
}

export function EditorMediaBlockFrame({
  className,
  containerRef,
  widthPercent,
  margin,
  allowResize,
  suppressStaticTextSelection = false,
  isResizing = false,
  selected,
  onResizeLeftPointerDown,
  onResizeRightPointerDown,
  onResizePointerMove,
  onResizePointerEnd,
  resizeMin = 10,
  resizeMax = 100,
  resizeLeftLabel = 'Resize width from left',
  resizeRightLabel = 'Resize width from right',
  onResizeLeftKeyDown,
  onResizeRightKeyDown,
  onResizeBlur,
  children,
}: EditorMediaBlockFrameProps) {
  const isSelected = selected ?? false;

  return (
    <div
      ref={containerRef as RefObject<HTMLDivElement | null> | undefined}
      className={joinClassNames(classes.frame, className)}
      contentEditable={false}
      onDragStart={preventNativeBlockDrag}
      draggable={false}
      data-selected={isSelected || undefined}
      data-resizing={isResizing || undefined}
      data-suppress-static-text-selection={suppressStaticTextSelection || undefined}
      onPointerMove={onResizePointerMove}
      onPointerUp={onResizePointerEnd}
      onPointerCancel={onResizePointerEnd}
      style={{
        width: `${widthPercent}%`,
        margin,
        position: 'relative',
      }}
    >
      {allowResize ? (
        <ResizeHandle
          placement="media-edge"
          visibility={isSelected || isResizing ? 'active' : 'on-interaction'}
          direction="left"
          value={widthPercent}
          min={resizeMin}
          max={resizeMax}
          ariaLabel={resizeLeftLabel}
          onPointerDown={onResizeLeftPointerDown}
          onKeyDown={onResizeLeftKeyDown}
          onBlur={onResizeBlur}
        />
      ) : null}
      {children}
      {isResizing ? <div className={classes.dragShield} data-resize-drag-shield /> : null}
      {allowResize ? (
        <ResizeHandle
          placement="media-edge"
          visibility={isSelected || isResizing ? 'active' : 'on-interaction'}
          direction="right"
          value={widthPercent}
          min={resizeMin}
          max={resizeMax}
          ariaLabel={resizeRightLabel}
          onPointerDown={onResizeRightPointerDown}
          onKeyDown={onResizeRightKeyDown}
          onBlur={onResizeBlur}
        />
      ) : null}
    </div>
  );
}

interface EditableMediaCaptionProps {
  /** Accessible name of the caption field. */
  label: string;
  value: string;
  isEditing: boolean;
  isEditable: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  placeholder: string;
  emptyLabel: string;
  onActivate: () => void;
  onChange: (nextValue: string) => void;
  onBlur: () => void;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
}

/** Media captions use Core caption-role text entry; the block owns only the edit lifecycle. */
export function EditableMediaCaption({
  label,
  value,
  isEditing,
  isEditable,
  inputRef,
  placeholder,
  emptyLabel,
  onActivate,
  onChange,
  onBlur,
  onKeyDown,
}: EditableMediaCaptionProps) {
  if (isEditing) {
    return (
      <TextInput
        ref={inputRef}
        aria-label={label}
        appearance="bare"
        textRole="caption"
        density="compact"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus
        data-editor-media-caption=""
      />
    );
  }

  if (!isEditable) {
    return value ? (
      <Text size="xs" tone="muted">
        {value}
      </Text>
    ) : null;
  }

  // Starting an edit is a real command, reachable from the keyboard; its visible caption is its name.
  return (
    <TextButton appearance="muted" size="sm" onClick={onActivate}>
      {value || emptyLabel}
    </TextButton>
  );
}
