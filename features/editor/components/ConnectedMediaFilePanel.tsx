'use client';

import { MediaFilePanel, type MediaFilePanelProps } from './MediaFilePanel';

/** Compatibility composition point for the active editor engine. */
export function ConnectedMediaFilePanel(props: MediaFilePanelProps) {
  return <MediaFilePanel {...props} />;
}
