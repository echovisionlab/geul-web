'use client';

import { forwardRef } from 'react';
import { Tooltip as MantineTooltip, type TooltipProps as MantineTooltipProps } from '@mantine/core';

export type TooltipProps = MantineTooltipProps;

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>((props, ref) => (
  <MantineTooltip ref={ref} {...props} />
));

Tooltip.displayName = 'Tooltip';
