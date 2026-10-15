import { forwardRef, type ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { IconButton } from '../IconButton/IconButton';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import type { ControlTone } from '../control-style';
import classes from './Alert.module.css';
export type AlertTone = ControlTone;
export type AlertProminence = 'standard' | 'strong';
interface AlertBaseProps extends Omit<PresentationProps, 'title'> {
  tone?: AlertTone;
  prominence?: AlertProminence;
  title?: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  density?: 'compact' | 'standard';
}
export type AlertProps = AlertBaseProps &
  ({ withCloseButton: true; closeButtonLabel: string } | { withCloseButton?: false; closeButtonLabel?: never });
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      tone = 'neutral',
      prominence = 'standard',
      title,
      icon,
      withCloseButton,
      closeButtonLabel,
      onClose,
      children,
      density = 'standard',
      role = 'alert',
      ...props
    },
    ref,
  ) => (
    <div
      {...presentationAttributes(props)}
      ref={ref}
      className={classes.root}
      data-tone={tone}
      data-prominence={prominence}
      data-density={density}
      role={role}
    >
      {icon ? (
        <span className={classes.icon} aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className={classes.content}>
        {title ? <div className={classes.title}>{title}</div> : null}
        {children ? <div className={classes.description}>{children}</div> : null}
      </div>
      {withCloseButton ? (
        <IconButton label={closeButtonLabel} size="xs" onClick={onClose}>
          <IconX size="1em" aria-hidden />
        </IconButton>
      ) : null}
    </div>
  ),
);
Alert.displayName = 'Alert';
