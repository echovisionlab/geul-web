import type { ReactNode } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import { Text } from '../Typography';
import classes from './ImageUpload.module.css';

export interface ImagePreviewHeaderProps extends ClosedVisualProps {
  label: string;
  actions?: ReactNode;
  testId?: string;
}

/** Reserves the same label row for media with or without preview actions. */
export function ImagePreviewHeader({ label, actions, testId }: ImagePreviewHeaderProps) {
  return (
    <div className={classes.header} data-testid={testId}>
      <Text size="xs" weight="medium">
        {label}
      </Text>
      {actions ? <div className={classes.headerActions}>{actions}</div> : null}
    </div>
  );
}
