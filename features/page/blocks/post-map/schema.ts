import { z } from 'zod';
import { MAP_MAX_ZOOM_LIMIT, MAP_MIN_ZOOM_LIMIT } from '@/lib/types/map/model';
import { MAP_PRIMARY_LABEL_VALUES } from '../constants';

const booleanString = z.enum(['true', 'false']);
const zoomBoundString = z
  .string()
  .refine((value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= MAP_MIN_ZOOM_LIMIT && parsed <= MAP_MAX_ZOOM_LIMIT;
  })
  .default(String(MAP_MIN_ZOOM_LIMIT));

export const postMapSchema = z.object({
  categoryIds: z.string().default(''),
  tagIds: z.string().default(''),
  authorIds: z.string().default(''),
  seriesId: z.string().default(''),
  requirePlace: booleanString.default('true'),
  sortBy: z.enum(['published_at', 'updated_at', 'title']).default('published_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  aspectRatio: z.enum(['16:9', '4:3', '1:1']).default('16:9'),
  previewWidth: z.string().default('100'),
  minZoom: zoomBoundString,
  maxZoom: zoomBoundString.default(String(MAP_MAX_ZOOM_LIMIT)),
  primaryLabel: z.enum(MAP_PRIMARY_LABEL_VALUES).default('content_title'),
  themeId: z.string().default(''),
  preferredScheme: z.enum(['auto', 'light', 'dark']).default('auto'),
  areaLabelsMode: z.enum(['inherit', 'show', 'hide']).default('inherit'),
  poiLabelsMode: z.enum(['inherit', 'show', 'hide']).default('inherit'),
});

export type PostMapProps = z.infer<typeof postMapSchema>;

export function parsePostMapProps(data: unknown): PostMapProps {
  return postMapSchema.parse(data ?? {});
}
