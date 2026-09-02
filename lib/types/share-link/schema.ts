import { z } from 'zod';

export const shareEntityTypeSchema = z.enum([
  'form',
  'form-dashboard',
  'post',
  'page',
  'work',
  'release',
  'artist',
  'label',
  'privacy',
  'terms',
]);

export type ShareEntityType = z.infer<typeof shareEntityTypeSchema>;
