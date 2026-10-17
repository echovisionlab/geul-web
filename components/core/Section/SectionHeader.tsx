import { Heading, SupportingText, Text } from '../Typography';
import type { ReactNode } from 'react';
import { LayoutInline, LayoutStack } from '../Layout';

import classes from './SectionHeader.module.css';

/**
 * Settings-style page outline. `2` titles a page section, `3` a group inside one; both
 * render real headings on one shared scale (page title → section → group → field label).
 * Without a level the title is a compact card/row label, not part of the page outline.
 */
export type SectionHeaderLevel = 2 | 3;

const headingScale: Record<SectionHeaderLevel, 4 | 5> = { 2: 4, 3: 5 };

export interface SectionHeaderProps {
  descriptionPlacement?: 'with-title' | 'below-row';
  level?: SectionHeaderLevel;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}
export function SectionHeader({
  title,
  description,
  actions,
  level,
  descriptionPlacement = 'with-title',
}: SectionHeaderProps) {
  if (descriptionPlacement !== 'with-title' && descriptionPlacement !== 'below-row') {
    throw new RangeError('SectionHeader description placement must use the shared contract');
  }
  if (level !== undefined && level !== 2 && level !== 3) {
    throw new RangeError('SectionHeader level must be 2 (section) or 3 (group)');
  }
  const titleNode =
    level === undefined ? (
      <Text size="sm" weight="strong">
        {title}
      </Text>
    ) : (
      <Heading level={level} scale={headingScale[level]}>
        {title}
      </Heading>
    );
  if (descriptionPlacement === 'below-row') {
    return (
      <LayoutStack gap="xxs">
        <LayoutInline justify="between" align="center" wrap="nowrap">
          <div className={classes.rowTitle}>{titleNode}</div>
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
          {titleNode}
          {description ? <SupportingText tone="muted">{description}</SupportingText> : null}
        </LayoutStack>
      </div>
      {actions ? <LayoutInline gap="action-group">{actions}</LayoutInline> : null}
    </LayoutInline>
  );
}
