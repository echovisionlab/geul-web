'use client';

import { IconShare } from '@tabler/icons-react';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';

export interface ShareButtonViewProps {
  label: string;
  onShare: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  iconSize?: number;
  minTouchSize?: number;
}

export function ShareButtonView({ label, onShare, size = 'lg', iconSize = 18, minTouchSize }: ShareButtonViewProps) {
  return (
    <Tooltip label={label}>
      <IconButton
        tone="neutral"
        emphasis="low"
        size={size}
        onClick={onShare}
        style={minTouchSize ? { minWidth: minTouchSize, minHeight: minTouchSize } : undefined}
        aria-label={label}
      >
        <IconShare size={iconSize} />
      </IconButton>
    </Tooltip>
  );
}
