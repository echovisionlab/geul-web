import type { MarqueeResolvedItem } from './types';

export function getEntityMarqueeHref(
  entityType: 'client' | 'label',
  item: { id: string; slug?: string | null; website?: string | null },
  linkMode: 'none' | 'entity',
): string | undefined {
  if (linkMode === 'none') {
    return undefined;
  }
  if (entityType === 'client') {
    return item.website ?? undefined;
  }
  return `/labels/${item.slug?.trim() || item.id}`;
}

export function reorderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  if (ids.length === 0) {
    return items;
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
}

export function buildEntityMarqueeItem(input: {
  id: string;
  name: string;
  href?: string;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
}): MarqueeResolvedItem {
  return {
    id: input.id,
    text: input.name,
    href: input.href,
    logoUrl: input.logoUrl,
    logoLightUrl: input.logoLightUrl,
    logoDarkUrl: input.logoDarkUrl,
  };
}
