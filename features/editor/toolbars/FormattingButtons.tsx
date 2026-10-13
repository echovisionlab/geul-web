'use client';

import type { ReactNode } from 'react';
import {
  IconBold,
  IconCode,
  IconIndentDecrease,
  IconIndentIncrease,
  IconItalic,
  IconLink,
  IconStrikethrough,
  IconUnderline,
} from '@tabler/icons-react';
import { BlockAlignButtons, type BlockAlignButtonsProps } from './BlockAlignButton';
import { ContentBlockTypeSelect, type ContentBlockTypeSelectProps } from './ContentBlockTypeSelect';
import { EDITOR_TOOLBAR_SHORTCUTS } from './EditorToolbarTooltip';
import { EditorToolbarAction } from './EditorToolbarAction';
import { EditorColorStyleButton, type EditorColorStyleButtonProps } from './EditorColorStyleButton';

export type BasicTextStyle = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

/** The selection-menu contract order. Hosts may omit unsupported styles, not reorder them. */
export const STANDARD_TEXT_STYLE_ORDER = ['bold', 'italic', 'underline', 'strike', 'code'] as const;

export interface StandardFormattingLabels {
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  /** Omit only while an existing host still renders its own code control. */
  code?: string;
  link: string;
  nest?: string;
  unnest?: string;
  /** Localized group label for the three alignment actions. */
  alignment?: string;
}

export interface StandardFormattingButtonsProps {
  labels: StandardFormattingLabels;
  blockType?: ContentBlockTypeSelectProps;
  alignment?: BlockAlignButtonsProps;
  color?: EditorColorStyleButtonProps;
  activeTextStyles?: ReadonlySet<BasicTextStyle>;
  /** Supported inline styles. Their rendered order is always STANDARD_TEXT_STYLE_ORDER. */
  textStyles?: readonly BasicTextStyle[];
  /** Command port for inline mark changes. */
  onToggleTextStyle?: (style: BasicTextStyle) => void;
  /** Command ports for the remaining standard controls. */
  onCreateLink?: () => void;
  onNestBlock?: () => void;
  onUnnestBlock?: () => void;
  /** Per-control availability; use these instead of the global disabled flag for mixed selections. */
  textStylesDisabled?: boolean;
  nestDisabled?: boolean;
  unnestDisabled?: boolean;
  linkDisabled?: boolean;
  /** Overrides every control. Existing callers may keep using this for a read-only surface. */
  disabled?: boolean;
  children?: ReactNode;
}

const textStyleButtons = [
  { style: 'bold', Icon: IconBold, labelKey: 'bold' },
  { style: 'italic', Icon: IconItalic, labelKey: 'italic' },
  { style: 'underline', Icon: IconUnderline, labelKey: 'underline' },
  { style: 'strike', Icon: IconStrikethrough, labelKey: 'strike' },
  { style: 'code', Icon: IconCode, labelKey: 'code' },
] as const;

/**
 * Reusable, editor-neutral formatting row. Hosts may omit controls unavailable for
 * a given selection while keeping all state and mutation in explicit command ports.
 */
export function StandardFormattingButtons({
  labels,
  blockType,
  alignment,
  color,
  activeTextStyles = new Set(),
  textStyles = STANDARD_TEXT_STYLE_ORDER,
  onToggleTextStyle,
  onCreateLink,
  onNestBlock,
  onUnnestBlock,
  textStylesDisabled = false,
  nestDisabled = false,
  unnestDisabled = false,
  linkDisabled = false,
  disabled = false,
  children,
}: StandardFormattingButtonsProps) {
  const supportedTextStyles = new Set(textStyles);

  return (
    <>
      {blockType ? <ContentBlockTypeSelect {...blockType} disabled={disabled || blockType.disabled} /> : null}
      {onToggleTextStyle
        ? textStyleButtons
            .filter(({ style }) => supportedTextStyles.has(style))
            .map(({ style, Icon, labelKey }) => {
              const label = labels[labelKey];
              if (!label) {
                return null;
              }
              return (
                <EditorToolbarAction
                  key={style}
                  label={label}
                  shortcut={EDITOR_TOOLBAR_SHORTCUTS[style]}
                  pressed={activeTextStyles.has(style)}
                  disabled={disabled || textStylesDisabled}
                  onClick={() => onToggleTextStyle(style)}
                >
                  <Icon size={16} />
                </EditorToolbarAction>
              );
            })
        : null}
      {alignment ? (
        <BlockAlignButtons
          {...alignment}
          groupLabel={labels.alignment ?? alignment.groupLabel}
          disabled={disabled || alignment.disabled}
        />
      ) : null}
      {color ? <EditorColorStyleButton {...color} disabled={disabled || color.disabled} /> : null}
      {onNestBlock && labels.nest ? (
        <EditorToolbarAction label={labels.nest} disabled={disabled || nestDisabled} onClick={onNestBlock}>
          <IconIndentIncrease size={16} />
        </EditorToolbarAction>
      ) : null}
      {onUnnestBlock && labels.unnest ? (
        <EditorToolbarAction label={labels.unnest} disabled={disabled || unnestDisabled} onClick={onUnnestBlock}>
          <IconIndentDecrease size={16} />
        </EditorToolbarAction>
      ) : null}
      {onCreateLink ? (
        <EditorToolbarAction label={labels.link} disabled={disabled || linkDisabled} onClick={onCreateLink}>
          <IconLink size={16} />
        </EditorToolbarAction>
      ) : null}
      {children}
    </>
  );
}
