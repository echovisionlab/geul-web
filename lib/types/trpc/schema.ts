import * as z from '@/lib/zod-mini';
import type { ValueType } from './model';

// === Filter Schema Builders (per value type) ===

function stringFilterSchema<TField extends string>(field: TField) {
  return z.discriminatedUnion('op', [
    z.object({ field: z.literal(field), op: z.literal('eq'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('ne'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('ilike'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('like'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('startsWith'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('endsWith'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('fulltext'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('in'), value: z.array(z.string()) }),
    z.object({ field: z.literal(field), op: z.literal('isNull'), value: z.boolean() }),
  ]);
}

function numberFilterSchema<TField extends string>(field: TField) {
  return z.discriminatedUnion('op', [
    z.object({ field: z.literal(field), op: z.literal('eq'), value: z.number() }),
    z.object({ field: z.literal(field), op: z.literal('ne'), value: z.number() }),
    z.object({ field: z.literal(field), op: z.literal('gt'), value: z.number() }),
    z.object({ field: z.literal(field), op: z.literal('gte'), value: z.number() }),
    z.object({ field: z.literal(field), op: z.literal('lt'), value: z.number() }),
    z.object({ field: z.literal(field), op: z.literal('lte'), value: z.number() }),
    z.object({
      field: z.literal(field),
      op: z.literal('between'),
      value: z.tuple([z.number(), z.number()]),
    }),
    z.object({ field: z.literal(field), op: z.literal('in'), value: z.array(z.number()) }),
    z.object({ field: z.literal(field), op: z.literal('isNull'), value: z.boolean() }),
  ]);
}

function dateFilterSchema<TField extends string>(field: TField) {
  return z.discriminatedUnion('op', [
    z.object({ field: z.literal(field), op: z.literal('eq'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('ne'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('gt'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('gte'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('lt'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('lte'), value: z.string() }),
    z.object({
      field: z.literal(field),
      op: z.literal('between'),
      value: z.tuple([z.string(), z.string()]),
    }),
    z.object({ field: z.literal(field), op: z.literal('isNull'), value: z.boolean() }),
  ]);
}

function booleanFilterSchema<TField extends string>(field: TField) {
  return z.discriminatedUnion('op', [
    z.object({ field: z.literal(field), op: z.literal('eq'), value: z.boolean() }),
    z.object({ field: z.literal(field), op: z.literal('isNull'), value: z.boolean() }),
  ]);
}

function uuidFilterSchema<TField extends string>(field: TField) {
  return z.discriminatedUnion('op', [
    z.object({ field: z.literal(field), op: z.literal('eq'), value: z.uuid() }),
    z.object({ field: z.literal(field), op: z.literal('ne'), value: z.uuid() }),
    z.object({ field: z.literal(field), op: z.literal('in'), value: z.array(z.uuid()) }),
    z.object({ field: z.literal(field), op: z.literal('isNull'), value: z.boolean() }),
  ]);
}

function arrayFilterSchema<TField extends string>(field: TField) {
  return z.discriminatedUnion('op', [
    z.object({ field: z.literal(field), op: z.literal('contains'), value: z.array(z.unknown()) }),
    z.object({
      field: z.literal(field),
      op: z.literal('containedBy'),
      value: z.array(z.unknown()),
    }),
    z.object({ field: z.literal(field), op: z.literal('overlaps'), value: z.array(z.unknown()) }),
    z.object({ field: z.literal(field), op: z.literal('isEmpty'), value: z.boolean() }),
    z.object({ field: z.literal(field), op: z.literal('isNull'), value: z.boolean() }),
  ]);
}

function jsonbFilterSchema<TField extends string>(field: TField) {
  return z.discriminatedUnion('op', [
    z.object({ field: z.literal(field), op: z.literal('jsonContains'), value: z.unknown() }),
    z.object({ field: z.literal(field), op: z.literal('hasKey'), value: z.string() }),
    z.object({ field: z.literal(field), op: z.literal('hasAnyKey'), value: z.array(z.string()) }),
    z.object({ field: z.literal(field), op: z.literal('isNull'), value: z.boolean() }),
  ]);
}

// === Filter Schema Factory ===

function buildFilterSchema(field: string, valueType: ValueType) {
  switch (valueType) {
    case 'string':
      return stringFilterSchema(field);
    case 'number':
      return numberFilterSchema(field);
    case 'date':
      return dateFilterSchema(field);
    case 'boolean':
      return booleanFilterSchema(field);
    case 'uuid':
      return uuidFilterSchema(field);
    case 'array':
      return arrayFilterSchema(field);
    case 'jsonb':
      return jsonbFilterSchema(field);
  }
}

export function createFilterSchema<TFields extends Record<string, ValueType>>(fields: TFields) {
  const schemas = Object.entries(fields).map(([field, valueType]) => buildFilterSchema(field, valueType));
  const [first, second, ...rest] = schemas;
  if (!first) {
    throw new Error('At least one filter field is required');
  }
  if (!second) {
    return first;
  }
  return z.union([first, second, ...rest]);
}

// === Sort Schema Factory ===

export function createSortSchema<const T extends readonly [string, ...string[]]>(fields: T) {
  return z.object({
    field: z.enum(fields),
    order: z._default(z.enum(['asc', 'desc']), 'desc'),
  });
}

// === Identifier Schema ===

export const identifierSchema = z
  .object({
    id: z.optional(z.uuid()),
    slug: z.optional(z.string().check(z.minLength(1))),
  })
  .check(
    z.refine((data) => data.id || data.slug, {
      message: 'id 또는 slug 중 하나는 필수',
    }),
  );

// === List Input Schema Factory ===

export function createSimpleListInputSchema<TFilter, TSort extends string>(config: {
  filterSchema: z.ZodMiniType<TFilter>;
  sortSchema: z.ZodMiniType<{ field: TSort; order?: 'asc' | 'desc' }>;
}) {
  return z.object({
    filter: z._default(z.array(config.filterSchema), []),
    filterBy: z._default(z.enum(['AND', 'OR']), 'AND'),
    sort: z.optional(z.array(config.sortSchema)),
    page: z._default(z.number().check(z.gte(1)), 1),
    pageSize: z._default(z.number().check(z.gte(1), z.lte(100)), 20),
    search: z.optional(z.string()),
  });
}
