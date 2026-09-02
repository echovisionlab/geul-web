'use client';

import { IconPrinter } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';

export interface PrintButtonProps {
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PrintButton({ ariaLabel, size = 'md' }: PrintButtonProps) {
  const t = useTranslations('common.actions');
  const label = ariaLabel ?? t('print');
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 20;

  return (
    <Tooltip label={label}>
      <IconButton
        className="print-hide"
        tone="neutral"
        emphasis="low"
        size={size}
        aria-label={label}
        onClick={() => window.print()}
      >
        <IconPrinter size={iconSize} />
      </IconButton>
    </Tooltip>
  );
}
