import { z } from 'zod';

/**
 * Credit target type - supports polymorphic credits
 * - artist: Links to an artist entity
 * - member: Links to a member entity
 * - text: Plain text credit (no entity link)
 */
export type CreditTargetType = 'artist' | 'member' | 'text';

const creditTargetTypeSchema = z.enum(['artist', 'member', 'text']);

/**
 * Base credit item schema for both release and track credits
 */
export const baseCreditItemSchema = z.object({
  id: z.uuid(),
  credit_type: creditTargetTypeSchema,
  // Artist credit (nullable - only set when credit_type is 'artist')
  artist_id: z.uuid().nullable(),
  artist_name: z.string().nullable(),
  artist_slug: z.string().nullable(),
  // Member credit (nullable - only set when credit_type is 'member')
  member_id: z.string().nullable(),
  member_name: z.string().nullable(),
  // Text credit (nullable - only set when credit_type is 'text')
  credited_name: z.string().nullable(),
  // Common fields
  credit_role: z.string().nullable(),
  sort_order: z.number(),
});
