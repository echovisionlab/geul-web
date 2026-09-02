import { z } from 'zod';
import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { userFilterFields, userSortFields } from './table-spec';

export const userRoleSchema = z.enum(['admin', 'author', 'user']);

const ROLE_VALUES: readonly string[] = ['admin', 'author', 'user'];

export function isUserRole(value: unknown): value is z.infer<typeof userRoleSchema> {
  return typeof value === 'string' && ROLE_VALUES.includes(value);
}

// List input schema for admin user listing
const userFilterSchema = createFilterSchema(userFilterFields);
const userSortSchema = createSortSchema(userSortFields);

export const userListInputSchema = createSimpleListInputSchema({
  filterSchema: userFilterSchema,
  sortSchema: userSortSchema,
});
