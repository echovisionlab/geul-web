'use client';
import { breakpointQuery } from '../Layout/breakpoints';

import { forwardRef, type ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Button, type ControlEmphasis, type ControlTone } from '../Button';
import { IconButton } from '../IconButton';
import { Tooltip } from '../Tooltip';
import { controlNativeProps, type ControlNativeProps } from '../control-props';

type CommandPresentation =
  { presentation?: 'label'; icon?: ReactNode } | { presentation: 'icon' | 'responsive'; icon: ReactNode };
/** A toggle command reports `pressed`; Core owns its aria-pressed semantics and selected appearance. */
type CommandPressState =
  | { pressed?: undefined; tone?: ControlTone; emphasis?: ControlEmphasis }
  | { pressed: boolean; tone?: never; emphasis?: never };
export type ToolbarCommandProps = Omit<ControlNativeProps, 'aria-labelledby' | 'aria-pressed'> &
  CommandPresentation &
  CommandPressState & {
    label: string;
    tooltipLabel?: string;
    'aria-pressed'?: never;
    loading?: boolean;
    disabled?: boolean;
    'aria-labelledby'?: never;
    size?: never;
    children?: never;
    leftSection?: never;
    rightSection?: never;
  };

/** Shared command geometry; touch presentation keeps readable labels. */
export const ToolbarCommand = forwardRef<HTMLButtonElement, ToolbarCommandProps>(
  (
    { label, tooltipLabel, icon, presentation = 'label', emphasis = 'low', tone, pressed, loading, disabled, ...props },
    ref,
  ) => {
    const mobile = useMediaQuery(breakpointQuery('sm'));
    const touch = useMediaQuery('(any-pointer: coarse)');
    const iconOnly = Boolean(icon) && (presentation === 'icon' || (presentation === 'responsive' && mobile && !touch));
    const native = controlNativeProps(props);
    delete native['aria-labelledby'];
    delete native['aria-pressed'];
    const toggle = typeof pressed === 'boolean';
    return iconOnly ? (
      <Tooltip label={tooltipLabel ?? label}>
        <IconButton
          {...native}
          ref={ref}
          {...(toggle ? { pressed } : { tone, emphasis })}
          loading={loading}
          disabled={disabled}
          size="xs"
          aria-label={props['aria-label'] ?? label}
        >
          {icon}
        </IconButton>
      </Tooltip>
    ) : (
      <Button
        {...native}
        ref={ref}
        tone={toggle ? 'neutral' : tone}
        loading={loading}
        disabled={disabled}
        size="xs"
        emphasis={toggle ? 'low' : emphasis}
        aria-pressed={toggle ? pressed : undefined}
        labelWrap="wrap"
        leftSection={icon}
        aria-label={props['aria-label'] ?? label}
      >
        {label}
      </Button>
    );
  },
);
ToolbarCommand.displayName = 'ToolbarCommand';
