import type { ReactNode } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';
import { getBadgeToneColor, type BadgeTone } from '../Badge';
import { SectionCard, type SectionCardProps } from './SectionCard';

export interface StatCardProps extends Omit<SectionCardProps, 'children'> {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  tone?: BadgeTone;
}

export function StatCard({ label, value, icon, description, tone = 'neutral', ...props }: StatCardProps) {
  const color = `var(--mantine-color-${getBadgeToneColor(tone)}-6)`;

  return (
    <SectionCard {...props}>
      <Stack gap="xs">
        <Group gap="xs">
          {icon ? <Box c={color}>{icon}</Box> : null}
          <Text size="sm" c="dimmed">
            {label}
          </Text>
        </Group>
        <Text size="xl" fw={700} c={tone === 'neutral' ? undefined : color}>
          {value}
        </Text>
        {description ? (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
