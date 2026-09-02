'use client';

import type { CSSProperties } from 'react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import classes from './EditorColorStyleButton.module.css';
import { EditorToolbarDropdownTarget } from './EditorToolbarTooltip';

export const EDITOR_COLOR_VALUES = [
  'default',
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const;

export type EditorColor = (typeof EDITOR_COLOR_VALUES)[number];

export interface EditorColorStyleLabels {
  button: string;
  text: string;
  background: string;
  colors: Record<EditorColor, string>;
}

export interface EditorColorStyleButtonProps {
  labels: EditorColorStyleLabels;
  textColor?: EditorColor;
  backgroundColor?: EditorColor;
  /** Command ports. Omit a port when that mark is unsupported in the current selection. */
  onTextColorChange?: (color: EditorColor) => void;
  onBackgroundColorChange?: (color: EditorColor) => void;
  disabled?: boolean;
}

function colorToken(kind: 'text' | 'background', color: EditorColor): string {
  return `var(--editor-${kind}-color-${color})`;
}

export function EditorColorSwatch({ kind, color }: { kind: 'text' | 'background'; color: EditorColor }) {
  const style: CSSProperties =
    kind === 'text'
      ? {
          color: colorToken('text', color),
          backgroundColor: colorToken('background', 'default'),
        }
      : {
          color: colorToken('text', 'default'),
          backgroundColor: colorToken('background', color),
        };

  return (
    <span
      aria-hidden
      className={classes.swatch}
      data-editor-color-swatch={kind}
      data-color-kind={kind}
      data-color={color}
      style={style}
    >
      A
    </span>
  );
}

function ColorIcon({ textColor, backgroundColor }: Pick<EditorColorStyleButtonProps, 'textColor' | 'backgroundColor'>) {
  const resolvedTextColor = textColor ?? 'default';
  const resolvedBackgroundColor = backgroundColor ?? 'default';

  return (
    <span
      aria-hidden
      className={classes.swatch}
      data-editor-color-swatch="pair"
      data-background-color={resolvedBackgroundColor}
      data-text-color={resolvedTextColor}
      style={{
        color: colorToken('text', resolvedTextColor),
        backgroundColor: colorToken('background', resolvedBackgroundColor),
      }}
    >
      A
    </span>
  );
}

/** A pure color menu; editor integrations own the active marks and mutation commands. */
export function EditorColorStyleButton({
  labels,
  textColor,
  backgroundColor,
  onTextColorChange,
  onBackgroundColorChange,
  disabled = false,
}: EditorColorStyleButtonProps) {
  if (!onTextColorChange && !onBackgroundColorChange) {
    return null;
  }

  return (
    <DropdownMenu portal={false} placement="bottom-start">
      <EditorToolbarDropdownTarget label={labels.button}>
        {(targetRef) => (
          <IconButton
            ref={targetRef}
            label={labels.button}
            tone="neutral"
            emphasis="low"
            size="sm"
            data-selection-toolbar-action=""
            data-test="colors"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
          >
            <ColorIcon textColor={textColor} backgroundColor={backgroundColor} />
          </IconButton>
        )}
      </EditorToolbarDropdownTarget>
      <DropdownMenu.Dropdown>
        {onTextColorChange ? (
          <>
            <DropdownMenu.Label>{labels.text}</DropdownMenu.Label>
            {EDITOR_COLOR_VALUES.map((color) => (
              <DropdownMenu.Item
                key={`text-${color}`}
                icon={<EditorColorSwatch kind="text" color={color} />}
                selected={textColor === color}
                disabled={disabled}
                data-test={`text-color-${color}`}
                onClick={() => onTextColorChange(color)}
              >
                {labels.colors[color]}
              </DropdownMenu.Item>
            ))}
          </>
        ) : null}
        {onTextColorChange && onBackgroundColorChange ? <DropdownMenu.Divider /> : null}
        {onBackgroundColorChange ? (
          <>
            <DropdownMenu.Label>{labels.background}</DropdownMenu.Label>
            {EDITOR_COLOR_VALUES.map((color) => (
              <DropdownMenu.Item
                key={`background-${color}`}
                icon={<EditorColorSwatch kind="background" color={color} />}
                selected={backgroundColor === color}
                disabled={disabled}
                data-test={`background-color-${color}`}
                onClick={() => onBackgroundColorChange(color)}
              >
                {labels.colors[color]}
              </DropdownMenu.Item>
            ))}
          </>
        ) : null}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
