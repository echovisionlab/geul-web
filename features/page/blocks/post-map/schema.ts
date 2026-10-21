import * as z from '@/lib/zod-mini';
import { MAP_MAX_ZOOM_LIMIT, MAP_MIN_ZOOM_LIMIT } from '@/lib/types/map/model';
import { MAP_PRIMARY_LABEL_VALUES } from '../constants';

const booleanString = z.enum(['true', 'false']);
const zoomBoundString = z._default(
  z.string().check(
    z.refine((value) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed >= MAP_MIN_ZOOM_LIMIT && parsed <= MAP_MAX_ZOOM_LIMIT;
    }),
  ),
  String(MAP_MIN_ZOOM_LIMIT),
);

export const postMapSchema = z.object({
  categoryIds: z._default(z.string(), ''),
  tagIds: z._default(z.string(), ''),
  authorIds: z._default(z.string(), ''),
  seriesId: z._default(z.string(), ''),
  requirePlace: z._default(booleanString, 'true'),
  sortBy: z._default(z.enum(['published_at', 'updated_at', 'title']), 'published_at'),
  sortOrder: z._default(z.enum(['asc', 'desc']), 'desc'),
  aspectRatio: z._default(z.enum(['16:9', '4:3', '1:1']), '16:9'),
  displaySize: z._default(z.string(), '100'),
  minZoom: zoomBoundString,
  maxZoom: z._default(zoomBoundString, String(MAP_MAX_ZOOM_LIMIT)),
  primaryLabel: z._default(z.enum(MAP_PRIMARY_LABEL_VALUES), 'content_title'),
  themeId: z._default(z.string(), ''),
  preferredScheme: z._default(z.enum(['auto', 'light', 'dark']), 'auto'),
  areaLabelsMode: z._default(z.enum(['inherit', 'show', 'hide']), 'inherit'),
  poiLabelsMode: z._default(z.enum(['inherit', 'show', 'hide']), 'inherit'),
});

export type PostMapProps = z.infer<typeof postMapSchema>;

export function parsePostMapProps(data: unknown): PostMapProps {
  return postMapSchema.parse(data ?? {});
}
