'use client';

import type { TablerIcon } from '@tabler/icons-react';
import type { AriaAttributes, ReactNode } from 'react';
import { StatusIcon } from '../Display/StatusIcon';
import { LayoutInset, LayoutStack } from '../Layout';
import { SupportingText } from '../Typography';
import type { ClosedVisualProps } from '../visual-contract';

export interface EmptyStateProps
  extends ClosedVisualProps, Pick<AriaAttributes, 'aria-label' | 'aria-labelledby' | 'aria-describedby'> {
  /** The primary empty-result statement. */
  title: ReactNode;
  /** Optional next-step or cause explanation below the title. */
  description?: ReactNode;
  /** Decorative glyph. Core owns its 48px size, stroke and muted color. */
  icon?: TablerIcon;
  /** One recovery or creation command, usually a Core Button. */
  action?: ReactNode;
  /** Announce the statement politely when it replaces content after a user query or mutation. */
  live?: boolean;
  /** `section` adds the shared block inset; `none` sits inside an owning card or region. */
  inset?: 'section' | 'none';
  id?: string;
  [key: `data-${string}`]: string | number | boolean | undefined;
}

/** An empty result: decorative glyph → title → description → optional action. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  live = false,
  inset = 'section',
  ...props
}: EmptyStateProps) {
  if (inset !== 'section' && inset !== 'none') {
    throw new RangeError('Invalid empty state inset');
  }
  const native = Object.fromEntries(
    Object.entries(props).filter(
      ([key]) =>
        key === 'id' || key.startsWith('aria-') || (key.startsWith('data-') && !/^data-(?:geul|core)-/.test(key)),
    ),
  );
  const content = (
    <LayoutStack
      {...native}
      align="center"
      gap="sm"
      textAlign="center"
      role={live ? 'status' : undefined}
      data-empty-state=""
    >
      {icon ? <StatusIcon icon={icon} tone="neutral" size="lg" /> : null}
      <LayoutStack align="center" gap="xxs">
        <SupportingText>{title}</SupportingText>
        {description ? <SupportingText tone="muted">{description}</SupportingText> : null}
      </LayoutStack>
      {action}
    </LayoutStack>
  );
  return inset === 'section' ? <LayoutInset block="xl">{content}</LayoutInset> : content;
}
