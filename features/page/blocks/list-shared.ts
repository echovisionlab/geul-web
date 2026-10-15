import * as z from '@/lib/zod-mini';
import { COLLECTION_SIZES, DEFAULT_COLLECTION_SIZE } from '@/components/core/Collection/collection-contract';

export const collectionSizeSchema = z._default(z.enum(COLLECTION_SIZES), DEFAULT_COLLECTION_SIZE);

export const booleanString = z.enum(['true', 'false']);

export const listLayoutSchema = z.enum(['grid', 'list', 'cards', 'minimal', 'carousel']);

export const imageAspectRatioSchema = z.enum(['16:9', '4:3', '1:1', 'auto']);

export const sortOrderSchema = z.enum(['asc', 'desc']);

export { splitCsv, parseIntegerProp, parseBooleanProp, toAspectRatio } from './list-view-utils';
