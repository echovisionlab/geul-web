import { SupportingText, Heading } from '../Typography';
import type { ReactNode } from 'react';
import { LayoutInline, LayoutStack } from '../Layout';

import { ActionRowSizeProvider } from '../control-context';
export type PageHeaderAlign = 'start' | 'center';
export type PageHeaderLevel = 1 | 2;
export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  align?: PageHeaderAlign;
  level?: PageHeaderLevel;
}
/** A semantic page heading and shared action row, without per-route styling. */
export function PageHeader({ title, description, actions, align = 'start', level = 1 }: PageHeaderProps) {
  return (
    <LayoutInline justify="between" align="start" wrap="wrap" gap="md">
      <LayoutStack gap="xxs">
        <Heading level={level} scale={2} align={align}>
          {title}
        </Heading>
        {description ? (
          <SupportingText as="p" tone="secondary" align={align}>
            {description}
          </SupportingText>
        ) : null}
      </LayoutStack>
      {actions ? (
        <ActionRowSizeProvider size="sm">
          <LayoutInline gap="xs" align="center">
            {actions}
          </LayoutInline>
        </ActionRowSizeProvider>
      ) : null}
    </LayoutInline>
  );
}
