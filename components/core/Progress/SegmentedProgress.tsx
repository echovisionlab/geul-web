'use client';
import { ProgressBar } from 'react-aria-components';
import { useNumberFormatter } from 'react-aria';
import type { ClosedVisualProps } from '../visual-contract';
import type { ControlTone } from '../control-style';
import { Tooltip } from '../Tooltip';
import classes from './SegmentedProgress.module.css';
export interface ProgressSegment {
  id: string;
  value: number;
  label: string;
  tone?: ControlTone;
}
export interface SegmentedProgressProps extends ClosedVisualProps {
  label: string;
  segments: readonly ProgressSegment[];
  density?: 'compact' | 'labelled';
}
export function SegmentedProgress({ label, segments, density = 'labelled' }: SegmentedProgressProps) {
  const formatter = useNumberFormatter({ style: 'percent', maximumFractionDigits: 0 });
  const safe = segments.map((segment) => ({
    ...segment,
    value: Number.isFinite(segment.value) ? Math.max(0, segment.value) : 0,
  }));
  const total = safe.reduce((sum, segment) => sum + segment.value, 0);
  const scale = total > 100 ? 100 / total : 1;
  return (
    <ProgressBar
      aria-label={label}
      value={Math.min(100, total)}
      valueLabel={safe
        .map((segment) => `${segment.label}: ${formatter.format((segment.value * scale) / 100)}`)
        .join(', ')}
      className={classes.root}
      data-density={density}
    >
      <div className={classes.track}>
        {safe
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <Tooltip key={segment.id} label={segment.label}>
              <span
                // Focusable status text makes each tooltip available to keyboard users.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                className={classes.segment}
                data-tone={segment.tone ?? 'neutral'}
                style={{ width: `${segment.value * scale}%` }}
                aria-label={`${segment.label}: ${formatter.format((segment.value * scale) / 100)}`}
              >
                {density === 'labelled' && segment.value * scale >= 8
                  ? formatter.format((segment.value * scale) / 100)
                  : null}
              </span>
            </Tooltip>
          ))}
      </div>
    </ProgressBar>
  );
}
