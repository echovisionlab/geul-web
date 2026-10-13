'use client';

import type { ReactNode, ReactElement } from 'react';
import { Tooltip } from '@/components/core/Tooltip';

export interface FileBrowserTooltipProps {
  label: ReactNode;
  children: ReactElement;
}

export function FileBrowserTooltip({ label, children }: FileBrowserTooltipProps) {
  return (
    <Tooltip label={label} position="bottom" openDelay={550} closeDelay={100} withArrow>
      {children}
    </Tooltip>
  );
}
