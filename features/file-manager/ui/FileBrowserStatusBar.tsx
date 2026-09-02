'use client';

import { Group, Text } from '@mantine/core';
import classes from './FileBrowserStatusBar.module.css';

export interface FileBrowserStatusBarProps {
  status: string;
}

export function FileBrowserStatusBar({ status }: FileBrowserStatusBarProps) {
  return (
    <Group className={classes.statusBar} justify="space-between" wrap="nowrap" data-file-browser-status>
      <Text size="xs" c="dimmed" aria-live="polite">
        {status}
      </Text>
    </Group>
  );
}
