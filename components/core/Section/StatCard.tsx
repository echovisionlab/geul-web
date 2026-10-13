import { SupportingText, Text } from '../Typography';
import type { TablerIcon } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { BadgeTone } from '../Badge';
import { LayoutInline, LayoutStack } from '../Layout';
import { NavigationLink } from '../Navigation/NavigationLink';

import { SectionCard, type SectionCardProps } from './SectionCard';
export interface StatCardProps extends Omit<SectionCardProps, 'children'> {
  label: ReactNode;
  value: ReactNode;
  /** Decorative glyph component. Core owns its 20px size, 1.5 stroke and tone. */
  icon?: TablerIcon;
  description?: ReactNode;
  tone?: BadgeTone;
  /** Makes the whole card one navigation link to the metric's detail screen. */
  href?: string;
  prefetch?: boolean;
}
export function StatCard({
  label,
  value,
  icon: Glyph,
  description,
  tone = 'neutral',
  href,
  prefetch,
  ...props
}: StatCardProps) {
  const card = (
    <SectionCard {...props}>
      <LayoutStack gap="xs">
        <LayoutInline gap="xs">
          {Glyph ? (
            <Text as="span" tone={tone}>
              <Glyph size={20} stroke={1.5} aria-hidden focusable={false} />
            </Text>
          ) : null}
          <Text size="sm" tone="muted">
            {label}
          </Text>
        </LayoutInline>
        <Text size="xl" weight="strong" tone={tone}>
          {value}
        </Text>
        {description ? <SupportingText tone="muted">{description}</SupportingText> : null}
      </LayoutStack>
    </SectionCard>
  );
  return href === undefined ? (
    card
  ) : (
    <NavigationLink href={href} prefetch={prefetch} appearance="block">
      {card}
    </NavigationLink>
  );
}
