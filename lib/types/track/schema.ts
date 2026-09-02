import { z } from 'zod';

export const trackBasicSchema = z.object({
  id: z.uuid(),
  track_number: z.number(),
  title: z.string(),
  duration_seconds: z.number().nullable(),
  audio_attached: z.boolean().default(false),
  audio_original_file_id: z.uuid().nullable().optional(),
  processing_status: z.string().nullable(),
  processing_progress: z.number().nullable().optional(),
});
