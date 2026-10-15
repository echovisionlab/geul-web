import { forwardRef, useId } from 'react';
import { ProgressBar } from 'react-aria-components';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import type { ControlTone } from '../control-style';
import { LayoutStack } from '../Layout';
import { Text } from '../Typography';
import classes from './Progress.module.css';
export type ProgressProps = Omit<
  PresentationProps,
  'children' | 'aria-valuemax' | 'aria-valuemin' | 'aria-valuenow' | 'role' | 'aria-label' | 'aria-labelledby'
> & {
  value: number | null;
  tone?: ControlTone;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  activity?: 'idle' | 'pending';
  /** Image contrast requires an actual dark media/scrim surface. */
  contrast?: 'default' | 'image';
  /** Optional visible task title. The accessible name remains explicit. */
  title?: string;
  /** Optional visible progress detail, also linked as the progress description. */
  status?: string;
} & ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-label'?: never; 'aria-labelledby': string });
export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, tone = 'neutral', size = 'sm', activity, contrast = 'default', title, status, ...props }, ref) => {
    const statusId = useId();
    const description =
      [props['aria-describedby'], status ? statusId : undefined].filter(Boolean).join(' ') || undefined;
    return (
      <ProgressBar
        {...presentationAttributes(props)}
        ref={ref}
        value={value === null ? undefined : Math.max(0, Math.min(100, value))}
        isIndeterminate={value === null}
        className={classes.root}
        aria-describedby={description}
        data-core-progress
        data-tone={tone}
        data-size={size}
        data-pending={activity === 'pending' || undefined}
        data-contrast={contrast}
      >
        {({ percentage }) => (
          <LayoutStack gap="xxs">
            {title ? (
              <Text size="xs" weight="medium" tone={contrast === 'image' ? 'inverse' : 'inherit'}>
                {title}
              </Text>
            ) : null}
            <div className={classes.track}>
              <div className={classes.fill} style={{ width: `${value === null ? 100 : percentage}%` }} />
            </div>
            {status ? (
              <Text id={statusId} size="xs" tone={contrast === 'image' ? 'inverse' : 'inherit'}>
                {status}
              </Text>
            ) : null}
          </LayoutStack>
        )}
      </ProgressBar>
    );
  },
);
Progress.displayName = 'Progress';
