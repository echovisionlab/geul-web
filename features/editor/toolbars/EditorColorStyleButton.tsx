'use client';

import { DocumentColorPreview, DOCUMENT_COLOR_VALUES } from '@/components/core/DocumentColorPreview';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { EditorToolbarDropdownTarget } from './EditorToolbarTooltip';

export const EDITOR_COLOR_VALUES = DOCUMENT_COLOR_VALUES;

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

export function EditorColorSwatch({ kind, color }: { kind: 'text' | 'background'; color: EditorColor }) {
  return (
    <DocumentColorPreview
      kind={kind}
      textColor={kind === 'text' ? color : undefined}
      backgroundColor={kind === 'background' ? color : undefined}
    />
  );
}

/** Editor integrations own active marks and mutations; Core owns samples and menu density. */
export function EditorColorStyleButton({
  labels,
  textColor,
  backgroundColor,
  onTextColorChange,
  onBackgroundColorChange,
  disabled = false,
}: EditorColorStyleButtonProps) {
  return (
    <>
      {(['text', 'background'] as const).map((kind) => {
        const onChange = kind === 'text' ? onTextColorChange : onBackgroundColorChange;
        if (!onChange) {
          return null;
        }
        const activeColor = (kind === 'text' ? textColor : backgroundColor) ?? 'default';
        return (
          <DropdownMenu key={kind} portal={false} placement="bottom-start" size="compact">
            <EditorToolbarDropdownTarget label={labels[kind]} focusHint={false}>
              {(targetRef) => (
                <IconButton
                  ref={targetRef}
                  label={labels[kind]}
                  tone="neutral"
                  emphasis="low"
                  size="sm"
                  data-selection-toolbar-action=""
                  data-test={`${kind}-colors`}
                  disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <DocumentColorPreview
                    kind={kind}
                    size="compact"
                    textColor={kind === 'text' ? activeColor : undefined}
                    backgroundColor={kind === 'background' ? activeColor : undefined}
                  />
                </IconButton>
              )}
            </EditorToolbarDropdownTarget>
            <DropdownMenu.Dropdown>
              <DropdownMenu.Section label={labels[kind]}>
                {EDITOR_COLOR_VALUES.map((color) => (
                  <DropdownMenu.Item
                    key={color}
                    colorPreview={{ kind, color }}
                    selected={activeColor === color}
                    disabled={disabled}
                    data-test={`${kind}-color-${color}`}
                    onClick={() => onChange(color)}
                  >
                    {labels.colors[color]}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Section>
            </DropdownMenu.Dropdown>
          </DropdownMenu>
        );
      })}
    </>
  );
}
