import { forwardRef } from 'react';
import { ActionIcon, createPolymorphicComponent, type ActionIconProps } from '@mantine/core';
import { resolveControlStyle, type ControlEmphasis, type ControlTone } from '../control-style';
import classes from './IconButton.module.css';

export type IconButtonAccessibleName =
  | { label: string; 'aria-label'?: never; 'aria-labelledby'?: never }
  | { label?: never; 'aria-label': string; 'aria-labelledby'?: never }
  | { label?: never; 'aria-label'?: never; 'aria-labelledby': string };

export type IconButtonProps = Omit<ActionIconProps, 'aria-label' | 'aria-labelledby' | 'color' | 'radius' | 'variant'> &
  IconButtonAccessibleName & {
    tone?: ControlTone;
    emphasis?: ControlEmphasis;
    shape?: 'square' | 'circle';
  };

function IconButtonInner(
  {
    tone = 'neutral',
    emphasis = 'low',
    shape = 'square',
    label,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    className,
    ...props
  }: IconButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  const style = resolveControlStyle(tone, emphasis);

  return (
    <ActionIcon
      ref={ref}
      {...props}
      color={style.color}
      variant={style.variant}
      radius={shape === 'circle' ? 'xl' : 0}
      aria-label={ariaLabel ?? label}
      aria-labelledby={ariaLabelledBy}
      data-tone={tone}
      data-emphasis={emphasis}
      data-shape={shape}
      className={[classes.root, className].filter(Boolean).join(' ')}
    />
  );
}

const IconButtonBase = forwardRef<HTMLButtonElement, IconButtonProps>(IconButtonInner);
IconButtonBase.displayName = 'IconButton';

export const IconButton = createPolymorphicComponent<'button', IconButtonProps>(IconButtonBase);
