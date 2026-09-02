'use client';

import type { FocusEventHandler, KeyboardEventHandler, PointerEventHandler, ReactNode, RefObject } from 'react';
import { ResizeHandle } from '@/components/core/ResizeHandle';
import classes from './EditorMediaBlockShell.module.css';
import { preventNativeBlockDrag } from './preventNativeBlockDrag';

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
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
          className={classes.resizeHandle}
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
          className={classes.resizeHandle}
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
  className: string;
  inputClassName: string;
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

export function EditableMediaCaption({
  className,
  inputClassName,
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
      <input
        ref={inputRef}
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus
        data-editor-media-caption
      />
    );
  }

  if (!value && !isEditable) {
    return null;
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className={className} onClick={isEditable ? onActivate : undefined}>
      {value || emptyLabel}
    </div>
  );
}
