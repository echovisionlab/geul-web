'use client';

import type { ReactNode } from 'react';
import { Box } from '@mantine/core';
import { Tooltip } from '@/components/core/Tooltip';
import classes from './FileBrowserTooltip.module.css';

export interface FileBrowserTooltipProps {
  label: ReactNode;
  children: ReactNode;
}

export function FileBrowserTooltip({ label, children }: FileBrowserTooltipProps) {
  return (
    <Tooltip label={label} position="bottom" openDelay={550} closeDelay={100} withArrow>
      <Box component="span" className={classes.target}>
        {children}
      </Box>
    </Tooltip>
  );
}
