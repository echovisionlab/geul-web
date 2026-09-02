import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { Card, CardSection, type CardProps } from '@mantine/core';

export interface ContentCardProps extends CardProps, Omit<ComponentPropsWithoutRef<'a'>, keyof CardProps> {
  component?: ElementType;
}

export function ContentCard(props: ContentCardProps) {
  const MantineCard = Card as any;
  return <MantineCard data-ui-primitive="content-card" {...(props as any)} />;
}

export const ContentCardSection = CardSection as any;
