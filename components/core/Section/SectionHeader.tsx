import { SupportingText, Text } from '../Typography';
import type { ReactNode } from 'react';
import { LayoutInline, LayoutStack } from '../Layout';

import classes from './SectionHeader.module.css';
export interface SectionHeaderProps {
  descriptionPlacement?: 'with-title' | 'below-row';
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}
export function SectionHeader({
  title,
  description,
  actions,
  descriptionPlacement = 'with-title',
}: SectionHeaderProps) {
  if (descriptionPlacement !== 'with-title' && descriptionPlacement !== 'below-row') {
    throw new RangeError('SectionHeader description placement must use the shared contract');
  }
  if (descriptionPlacement === 'below-row') {
    return (
      <LayoutStack gap="xxs">
        <LayoutInline justify="between" align="center" wrap="nowrap">
          <div className={classes.rowTitle}>
            <Text size="sm" weight="strong">
              {title}
            </Text>
          </div>
          {actions ? (
            <LayoutInline gap="action-group" shrink={false}>
              {actions}
            </LayoutInline>
          ) : null}
        </LayoutInline>
        {description ? <SupportingText tone="muted">{description}</SupportingText> : null}
      </LayoutStack>
    );
  }
  return (
    <LayoutInline justify="between" align="start" wrap="wrap">
      <div className={classes.content}>
        <LayoutStack gap="xxs">
          <Text size="sm" weight="strong">
            {title}
          </Text>
          {description ? <SupportingText tone="muted">{description}</SupportingText> : null}
        </LayoutStack>
      </div>
      {actions ? <LayoutInline gap="action-group">{actions}</LayoutInline> : null}
    </LayoutInline>
  );
}
