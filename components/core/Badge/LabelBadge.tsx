import { forwardRef, type ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { IconButton } from '../IconButton/IconButton';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import type { BadgeTone } from './badge-tones';
import classes from './Badge.module.css';

export type BadgeAppearance = 'soft' | 'outline' | 'solid' | 'dot';
interface BadgeContentProps extends PresentationProps {
  tone?: BadgeTone;
  placement?: 'inline' | 'overlay-start';
  appearance?: BadgeAppearance;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  dismissDisabled?: boolean;
}
export type LabelBadgeProps = BadgeContentProps &
  ({ onDismiss?: undefined; dismissLabel?: undefined } | { onDismiss: () => void; dismissLabel: string });
export const LabelBadge = forwardRef<HTMLSpanElement, LabelBadgeProps>(
  (
    {
      tone = 'neutral',
      placement = 'inline',
      appearance = 'soft',
      size = 'sm',
      leftSection,
      rightSection,
      onDismiss,
      dismissLabel,
      dismissDisabled,
      children,
      ...props
    },
    ref,
  ) => (
    <span
      {...presentationAttributes(props)}
      ref={ref}
      className={classes.root}
      data-tone={tone}
      data-placement={placement}
      data-appearance={appearance}
      data-size={size}
    >
      {appearance === 'dot' ? <span className={classes.dot} aria-hidden /> : null}
      {leftSection}
      <span>{children}</span>
      {rightSection}
      {onDismiss ? (
        <IconButton label={dismissLabel} size="compact" disabled={dismissDisabled} onClick={onDismiss}>
          <IconX size="1em" aria-hidden />
        </IconButton>
      ) : null}
    </span>
  ),
);
LabelBadge.displayName = 'LabelBadge';
