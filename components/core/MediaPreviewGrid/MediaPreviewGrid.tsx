import type { ReactNode } from 'react';
import { Box } from '@mantine/core';
import classes from './MediaPreviewGrid.module.css';

export interface MediaPreviewGridProps {
  children: ReactNode;
}

export function MediaPreviewGrid({ children }: MediaPreviewGridProps) {
  return <Box className={classes.grid}>{children}</Box>;
}
