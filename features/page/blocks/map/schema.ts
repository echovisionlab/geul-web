/**
 * Map block schema for Page Editor
 * Re-exports from centralized map-block types
 */
export {
  mapBlockSchema as mapSchema,
  parseMapBlockProps as parseMapProps,
  type MapBlockProps as MapProps,
} from '@/lib/types/map-block/schema';

export { toMapConfig, fromMapConfigUpdate } from '@/lib/types/map-block/converters';
