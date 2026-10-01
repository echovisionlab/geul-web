'use client';

import { MapView } from '@/features/page/blocks/map/View';
import type { Block } from '@/lib/types/page-content';

export function DefaultMapBlockView({ block, requestedLocale }: { block: Block; requestedLocale?: string }) {
  return <MapView props={block.props} requestedLocale={requestedLocale} />;
}
