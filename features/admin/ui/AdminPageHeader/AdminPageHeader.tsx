import type { ReactNode } from 'react';
import { LayoutInline, LayoutInset } from '@/components/core/Layout';
import { PageHeader } from '@/components/core/PageHeader';
import { Button, type ControlEmphasis, type ControlTone } from '@/components/core/Button';

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
  level?: 1 | 2;
  items?: AdminPageHeaderItem[];
}

export function AdminPageHeader({ title, description, level = 1, items = [] }: AdminPageHeaderProps) {
  return (
    <LayoutInset blockEnd="md">
      <PageHeader
        title={title}
        description={description}
        level={level}
        actions={
          items.length > 0 ? (
            <LayoutInline justify="end" align="center" gap="xs" wrap="wrap">
              {items.map((item) =>
                item.type === 'custom' ? (
                  <LayoutInline key={item.key} align="center" gap="none">
                    {item.content}
                  </LayoutInline>
                ) : item.href ? (
                  <Button
                    key={item.key}
                    href={item.href}
                    leftSection={item.icon}
                    disabled={item.disabled}
                    loading={item.loading}
                    tone={item.tone}
                    emphasis={item.emphasis}
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
                  >
                    {item.label}
                  </Button>
                ),
              )}
            </LayoutInline>
          ) : undefined
        }
      />
    </LayoutInset>
  );
}
