'use client';

import type { ReactNode } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { formErrorTextStyles } from './styles';

interface FieldFooterProps {
  error?: string;
  errorId?: string;
  right?: ReactNode;
}

export function FieldFooter({ error, errorId, right }: FieldFooterProps) {
  if (!error && !right) {
    return null;
  }

  return (
    <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap" mt={4}>
      <Box style={{ flex: 1, minWidth: 0 }}>
        {error ? (
          <Text id={errorId} size="xs" style={{ ...formErrorTextStyles, lineHeight: 1.4 }}>
            {error}
          </Text>
        ) : null}
      </Box>
      {right ? <Box style={{ flexShrink: 0, minWidth: 0 }}>{right}</Box> : null}
    </Group>
  );
}
