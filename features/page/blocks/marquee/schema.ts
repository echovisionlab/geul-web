import { z } from 'zod';
import { booleanString } from '../list-shared';

const marqueeDirectionSchema = z.enum(['left', 'right']);
const marqueeSpeedSchema = z.enum(['slow', 'normal', 'fast']);
const marqueeItemHeightSchema = z.enum(['sm', 'md', 'lg', 'xl']);
const marqueeGapSchema = z.enum(['sm', 'md', 'lg', 'xl']);
const marqueeLinkTargetSchema = z.enum(['same-tab', 'new-tab']);
const marqueeSourceSchema = z.enum(['all', 'selected']);
const marqueeLinkModeSchema = z.enum(['none', 'entity']);
const marqueeLogoScaleSchema = z.enum(['contain', 'fill-height']);
const marqueeFallbackModeSchema = z.enum(['name', 'hide']);

export const marqueeCommonSchema = z.object({
  direction: marqueeDirectionSchema.default('left'),
  speed: marqueeSpeedSchema.default('normal'),
  speedPxPerSecond: z.string().optional(),
  itemHeight: marqueeItemHeightSchema.default('md'),
  itemHeightPx: z.string().optional(),
  gap: marqueeGapSchema.default('lg'),
  pauseOnHover: booleanString.default('true'),
  linkTarget: marqueeLinkTargetSchema.default('same-tab'),
});

export const marqueeEntitySchema = marqueeCommonSchema.extend({
  source: marqueeSourceSchema.default('all'),
  ids: z.string().default(''),
  linkMode: marqueeLinkModeSchema.default('entity'),
  logoScale: marqueeLogoScaleSchema.default('contain'),
  fallbackMode: marqueeFallbackModeSchema.default('name'),
  limit: z.string().default('24'),
});

export interface MarqueeTextItem {
  text: string;
  href?: string;
}

export function parseMarqueeIds(ids: string | undefined): string[] {
  return (ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function parseTextMarqueeItems(itemsJson: string | undefined): MarqueeTextItem[] {
  if (!itemsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item): MarqueeTextItem | null => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const text = typeof item.text === 'string' ? item.text.trim() : '';
        if (!text) {
          return null;
        }
        const href = typeof item.href === 'string' ? item.href.trim() : '';
        return href ? { text, href } : { text };
      })
      .filter((item): item is MarqueeTextItem => item !== null);
  } catch {
    return [];
  }
}

export function stringifyTextMarqueeItems(items: MarqueeTextItem[]): string {
  return JSON.stringify(
    items
      .map((item) => ({
        text: item.text.trim(),
        href: item.href?.trim() || undefined,
      }))
      .filter((item) => item.text),
  );
}
