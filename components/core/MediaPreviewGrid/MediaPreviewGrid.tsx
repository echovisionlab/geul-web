import type { ReactNode } from 'react';

import classes from './MediaPreviewGrid.module.css';

export interface MediaPreviewGridProps {
  children: ReactNode;
}

/** Paired media previews stay side by side, including narrow editor screens. */
export function MediaPreviewGrid({ children }: MediaPreviewGridProps) {
  return <div className={classes.grid}>{children}</div>;
}
