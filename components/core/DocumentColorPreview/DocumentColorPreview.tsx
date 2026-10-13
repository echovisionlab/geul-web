import type { ClosedVisualProps } from '../visual-contract';
import classes from './DocumentColorPreview.module.css';

export const DOCUMENT_COLOR_VALUES = [
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
export type DocumentColor = (typeof DOCUMENT_COLOR_VALUES)[number];

export interface DocumentColorPreviewProps extends ClosedVisualProps {
  kind: 'text' | 'background' | 'pair';
  textColor?: DocumentColor;
  backgroundColor?: DocumentColor;
  size?: 'sample' | 'compact';
}

/** Authored content samples use the document palette, independently of control tone. */
export function DocumentColorPreview({
  kind,
  textColor = 'default',
  backgroundColor = 'default',
  size = 'sample',
}: DocumentColorPreviewProps) {
  const text = kind === 'background' ? 'default' : textColor;
  const background = kind === 'text' ? 'default' : backgroundColor;
  return (
    <span
      aria-hidden
      className={classes.preview}
      data-size={size}
      data-editor-color-swatch={kind}
      data-color-kind={kind === 'pair' ? undefined : kind}
      data-color={kind === 'pair' ? undefined : kind === 'text' ? text : background}
      data-text-color={kind === 'pair' ? text : undefined}
      data-background-color={kind === 'pair' ? background : undefined}
      data-transparent={kind !== 'text' && background === 'default' ? '' : undefined}
      style={{
        color: `var(--editor-text-color-${text})`,
        backgroundColor: `var(--editor-background-color-${background})`,
      }}
    >
      {size === 'compact' ? 'A' : 'Aa'}
    </span>
  );
}
