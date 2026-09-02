import type { ReactNode } from 'react';
import Link from 'next/link';
import { Group, Stack, Text, Title } from '@mantine/core';
import { Button, type ControlEmphasis, type ControlTone } from '@/components/core/Button';
import styles from './AdminPageHeader.module.css';

export type AdminPageHeaderItem =
  | {
      key: string;
      type: 'action';
      label: string;
      icon?: ReactNode;
      onClick?: () => void;
      href?: string;
      disabled?: boolean;
      loading?: boolean;
      tone?: ControlTone;
      emphasis?: ControlEmphasis;
    }
  | {
      key: string;
      type: 'custom';
      content: ReactNode;
    };

export interface AdminPageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  items?: AdminPageHeaderItem[];
}

export function AdminPageHeader({ title, description, items = [] }: AdminPageHeaderProps) {
  return (
    <Group justify="space-between" gap="sm" wrap="wrap" mb="md" className={styles.root}>
      <Stack gap={2} className={styles.titleStack}>
        <Title order={2} className={styles.title}>
          {title}
        </Title>
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Stack>
      {items.length > 0 ? (
        <div className={styles.actions}>
          {items.map((item) =>
            item.type === 'custom' ? (
              <div key={item.key} className={styles.customAction}>
                {item.content}
              </div>
            ) : item.href ? (
              <Button
                key={item.key}
                component={Link}
                href={item.href}
                leftSection={item.icon}
                disabled={item.disabled}
                loading={item.loading}
                tone={item.tone}
                emphasis={item.emphasis}
                className={styles.actionButton}
              >
                {item.label}
              </Button>
            ) : (
              <Button
                key={item.key}
                leftSection={item.icon}
                onClick={item.onClick}
                disabled={item.disabled}
                loading={item.loading}
                tone={item.tone}
                emphasis={item.emphasis}
                className={styles.actionButton}
              >
                {item.label}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </Group>
  );
}
