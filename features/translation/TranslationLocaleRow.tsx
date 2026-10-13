'use client';

import type { ReactNode } from 'react';
import type { ClosedVisualProps } from '@/components/core/visual-contract';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { ToolbarSurface } from '@/components/core/Section';

export interface TranslationLocaleRowProps extends ClosedVisualProps {
  name: string;
  code: string;
  description?: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
  actionsLabel: string;
  /** Announce meaningful job/presence transitions, including the language context. */
  announceChanges?: boolean;
}

/** One shared language row, aligned to the panel's content edge. */
export function TranslationLocaleRow({
  name,
  code,
  description,
  badges,
  actions,
  actionsLabel,
  announceChanges = false,
}: TranslationLocaleRowProps) {
  return (
    <LayoutInline
      gap="xs"
      justify="between"
      align="center"
      wrap="nowrap"
      data-testid={`translation-locale-row-${code}`}
    >
      <LayoutStack
        gap="xxs"
        flexible
        role={announceChanges ? 'status' : undefined}
        aria-atomic={announceChanges || undefined}
      >
        <LayoutInline gap="xxs" wrap="wrap">
          <Text size="sm" weight="medium">
            {name}
          </Text>
          {badges}
        </LayoutInline>
        {description ? (
          <Text size="xs" tone="secondary">
            {description}
          </Text>
        ) : null}
      </LayoutStack>
      {actions ? (
        <ToolbarSurface label={actionsLabel} appearance="inline">
          {actions}
        </ToolbarSurface>
      ) : null}
    </LayoutInline>
  );
}
