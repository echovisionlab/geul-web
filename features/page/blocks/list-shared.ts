import { z } from 'zod';

export const booleanString = z.enum(['true', 'false']);

export const listLayoutSchema = z.enum(['grid', 'list', 'cards', 'minimal', 'carousel']);

export const imageAspectRatioSchema = z.enum(['16:9', '4:3', '1:1', 'auto']);

export const sortOrderSchema = z.enum(['asc', 'desc']);

export { splitCsv, parseIntegerProp, parseBooleanProp, toAspectRatio } from './list-view-utils';
