import { getClientsForBlockByIdsAction, listClientsForBlockAction } from '@/lib/actions/client';
import { parseIntegerProp } from '../list-shared';
import { MarqueeView } from '../marquee/MarqueeView';
import { buildEntityMarqueeItem, getEntityMarqueeHref, reorderByIds } from '../marquee/resolve';
import { parseMarqueeIds } from '../marquee/schema';
import type { BlockViewProps } from '../types';
import { parseClientMarqueeProps } from './schema';

export async function ClientMarqueeViewServer({ props, requestedLocale }: BlockViewProps) {
  const p = parseClientMarqueeProps(props);
  const selectedIds = parseMarqueeIds(p.ids);
  const clients =
    p.source === 'selected'
      ? await getClientsForBlockByIdsAction({ ids: selectedIds, requestedLocale })
      : (
          await listClientsForBlockAction({
            limit: parseIntegerProp(p.limit, 24),
            requestedLocale,
          })
        ).clients;
  const orderedClients = p.source === 'selected' ? reorderByIds(clients, selectedIds) : clients;
  const items = orderedClients.map((client) =>
    buildEntityMarqueeItem({
      id: client.id,
      name: client.name,
      href: getEntityMarqueeHref('client', client, p.linkMode),
      logoUrl: client.logoUrl,
      logoLightUrl: client.logoLightUrl,
      logoDarkUrl: client.logoDarkUrl,
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
