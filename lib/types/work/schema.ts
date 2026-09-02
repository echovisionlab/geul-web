import { z } from 'zod';
import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import {
  myCreditedWorkFilterFields,
  myCreditedWorkSortFields,
  myWorkFilterFields,
  myWorkSortFields,
  workFilterFields,
  workSortFields,
} from './table-spec';
import type { WorkStatus } from './model';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const workTypeSchema = z.enum(['music_project', 'portfolio', 'article', 'contribution']);
export const workStatusSchema: z.ZodType<WorkStatus> = z.enum(['draft', 'published', 'archived']);
export type { WorkStatus } from './model';

export function parseWorkStatus(value: string | null | undefined): WorkStatus {
  const result = workStatusSchema.safeParse(value);
  return result.success ? result.data : 'draft';
}

// JSON-safe value schema (recursive)
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const workMetadataSchema = z.record(z.string(), jsonValueSchema);

// === tRPC Input Schemas (Admin) ===
const workFilterSchema = createFilterSchema(workFilterFields);
const workSortSchema = createSortSchema(workSortFields);
export const workListInputSchema = createSimpleListInputSchema({
  filterSchema: workFilterSchema,
  sortSchema: workSortSchema,
});

// === tRPC Input Schemas (My Works - Editable) ===
const myWorkFilterSchema = createFilterSchema(myWorkFilterFields);
const myWorkSortSchema = createSortSchema(myWorkSortFields);
export const myWorkListInputSchema = createSimpleListInputSchema({
  filterSchema: myWorkFilterSchema,
  sortSchema: myWorkSortSchema,
});

// === tRPC Input Schemas (My Works - Credited) ===
const myCreditedWorkFilterSchema = createFilterSchema(myCreditedWorkFilterFields);
const myCreditedWorkSortSchema = createSortSchema(myCreditedWorkSortFields);
export const myCreditedWorkListInputSchema = createSimpleListInputSchema({
  filterSchema: myCreditedWorkFilterSchema,
  sortSchema: myCreditedWorkSortSchema,
});
