import { MarqueeView } from '../marquee/MarqueeView';
import { parseTextMarqueeItems } from '../marquee/schema';
import type { BlockViewProps } from '../types';
import { parseTextMarqueeProps } from './schema';

export function TextMarqueeView({ props }: BlockViewProps) {
  const p = parseTextMarqueeProps(props);
  const items = parseTextMarqueeItems(p.itemsJson).map((item, index) => ({
    id: `text-${index}`,
    text: item.text,
    href: item.href,
  }));

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
      }}
    />
  );
}
