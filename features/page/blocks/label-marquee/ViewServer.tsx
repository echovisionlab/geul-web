import { getLabelsForBlockByIdsAction, listLabelsForBlockAction } from '@/lib/actions/label';
import { parseIntegerProp } from '../list-shared';
import { MarqueeView } from '../marquee/MarqueeView';
import { buildEntityMarqueeItem, getEntityMarqueeHref, reorderByIds } from '../marquee/resolve';
import { parseMarqueeIds } from '../marquee/schema';
import type { BlockViewProps } from '../types';
import { parseLabelMarqueeProps } from './schema';

export async function LabelMarqueeViewServer({ props, requestedLocale }: BlockViewProps) {
  const p = parseLabelMarqueeProps(props);
  const selectedIds = parseMarqueeIds(p.ids);
  const labels =
    p.source === 'selected'
      ? await getLabelsForBlockByIdsAction({ ids: selectedIds, requestedLocale })
      : (
          await listLabelsForBlockAction({
            sortBy: 'name',
            sortOrder: 'asc',
            limit: parseIntegerProp(p.limit, 24),
            requestedLocale,
          })
        ).labels;
  const orderedLabels = p.source === 'selected' ? reorderByIds(labels, selectedIds) : labels;
  const items = orderedLabels.map((label) =>
    buildEntityMarqueeItem({
      id: label.id,
      name: label.name,
      href: getEntityMarqueeHref('label', label, p.linkMode),
      logoUrl: label.imageUrl,
      logoLightUrl: label.imageLightUrl,
      logoDarkUrl: label.imageDarkUrl,
    }),
  );

  return (
    <MarqueeView
      items={items}
      options={{
        direction: p.direction,
        speed: p.speed,
        speedPxPerSecond: p.speedPxPerSecond ? Number(p.speedPxPerSecond) : undefined,
        itemHeight: p.itemHeight,
        itemHeightPx: p.itemHeightPx ? Number(p.itemHeightPx) : undefined,
        gap: p.gap,
        pauseOnHover: p.pauseOnHover !== 'false',
        linkTarget: p.linkTarget,
        logoScale: p.logoScale,
        fallbackMode: p.fallbackMode,
      }}
    />
  );
}
