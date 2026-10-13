'use client';

import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import type { ReactNode } from 'react';
import { Text } from '@/components/core/Typography';

interface FieldFooterProps {
  error?: string;
  errorId?: string;
  right?: ReactNode;
  rightId?: string;
}

export function FieldFooter({ error, errorId, right, rightId }: FieldFooterProps) {
  if (!error && !right) {
    return null;
  }

  return (
    <DsLayoutInset blockStart="xxs">
      <DsLayoutInline justify="between" align="start" gap="xs" wrap="nowrap">
        <DsLayoutInline flexible gap="none">
          {error ? (
            <Text id={errorId} size="xs" tone="danger">
              {error}
            </Text>
          ) : null}
        </DsLayoutInline>
        {right ? (
          <DsLayoutInline id={rightId} shrink={false} gap="none">
            {right}
          </DsLayoutInline>
        ) : null}
      </DsLayoutInline>
    </DsLayoutInset>
  );
}
