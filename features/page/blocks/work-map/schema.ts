import { z } from 'zod';
import { MAP_MAX_ZOOM_LIMIT, MAP_MIN_ZOOM_LIMIT } from '@/lib/types/map/model';
import { WORK_TYPES, type WorkType } from '@/lib/types/work/model';
import { MAP_PRIMARY_LABEL_VALUES } from '../constants';

const booleanString = z.enum(['true', 'false']);
const zoomBoundString = z
  .string()
  .refine((value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= MAP_MIN_ZOOM_LIMIT && parsed <= MAP_MAX_ZOOM_LIMIT;
  })
  .default(String(MAP_MIN_ZOOM_LIMIT));

export const workMapSchema = z.object({
  workTypes: z.string().default(''),
  featuredOnly: booleanString.default('false'),
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

export type WorkMapProps = z.infer<typeof workMapSchema>;

export function parseWorkMapProps(data: unknown): WorkMapProps {
  return workMapSchema.parse(data ?? {});
}

export function parseWorkMapTypes(value: string): WorkType[] | undefined {
  if (!value) {
    return undefined;
  }

  const types = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is WorkType => WORK_TYPES.includes(item as WorkType));

  return types.length > 0 ? types : undefined;
}
