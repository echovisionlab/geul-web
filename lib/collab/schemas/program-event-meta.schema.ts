import { z } from 'zod';

export const ProgramEventPosterMediaSchema = z.object({
  id: z.string(),
  fileId: z.string(),
  url: z.string().nullable(),
  role: z.string(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  alt: z.string().nullable(),
  caption: z.string().nullable(),
});

export const ProgramEventMetaSchema = z.object({
  posterMedia: z.array(ProgramEventPosterMediaSchema),
});

export type ProgramEventPosterMedia = z.infer<typeof ProgramEventPosterMediaSchema>;
export type ProgramEventMeta = z.infer<typeof ProgramEventMetaSchema>;

export const DEFAULT_PROGRAM_EVENT_META: ProgramEventMeta = {
  posterMedia: [],
};

export const PROGRAM_EVENT_META_JSON_KEYS: ReadonlySet<keyof ProgramEventMeta> = new Set(['posterMedia']);
