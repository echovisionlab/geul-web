import type { TablerIcon } from '@tabler/icons-react';
import type { ClosedVisualProps } from '../visual-contract';
import classes from './StatusIcon.module.css';

export type StatusIconTone = 'positive' | 'warning' | 'danger' | 'accent' | 'neutral';
/** sm is the 16px inline glyph, md a 24px message glyph and lg the 48px state glyph. */
export type StatusIconSize = 'sm' | 'md' | 'lg';
export interface StatusIconProps extends ClosedVisualProps {
  /** Tabler glyph component. Core owns its size, stroke and color. */
  icon: TablerIcon;
  tone: StatusIconTone;
  size?: StatusIconSize;
  /** Names a glyph that is the only carrier of a value. Omit it when adjacent text states the meaning. */
  label?: string;
  id?: string;
  [key: `data-${string}`]: string | number | boolean | undefined;
}

const tones: readonly StatusIconTone[] = ['positive', 'warning', 'danger', 'accent', 'neutral'];
const sizes: readonly StatusIconSize[] = ['sm', 'md', 'lg'];

/** A status-toned glyph. Color repeats meaning already carried by text or by its label. */
export function StatusIcon({ icon: Glyph, tone, size = 'sm', label, ...props }: StatusIconProps) {
  if (!tones.includes(tone)) {
    throw new RangeError('Invalid status icon tone');
  }
  if (!sizes.includes(size)) {
    throw new RangeError('Invalid status icon size');
  }
  if (label !== undefined && !label.trim()) {
    throw new TypeError('A named status icon needs a nonempty label');
  }
  const native = Object.fromEntries(
    Object.entries(props).filter(
      ([key]) => key === 'id' || (key.startsWith('data-') && !/^data-(?:geul|core)-/.test(key)),
    ),
  );
  return (
    <span
      {...native}
      className={classes.root}
      data-tone={tone}
      data-size={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Glyph size="1em" stroke={size === 'lg' ? 1.25 : 2} aria-hidden focusable={false} />
    </span>
  );
}
