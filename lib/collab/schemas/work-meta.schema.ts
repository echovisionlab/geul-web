import { WORK_JSON_KEYS, workCollabFieldsSchema } from '@echovisionlab/geul-common/collaboration/work';
import { z } from 'zod';

// WorkType enum schema
export const WorkTypeSchema = z.enum(['music_project', 'portfolio', 'article', 'contribution']);

function getCurrentPeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

const DEFAULT_PERIOD = getCurrentPeriod();

export const WorkMetaSchema = workCollabFieldsSchema.safeExtend({ type: WorkTypeSchema.optional() }).required({
  title: true,
  slug: true,
  type: true,
  year: true,
  month: true,
  untilYear: true,
  untilMonth: true,
  isPresent: true,
  summary: true,
  metadata: true,
  featured: true,
  creditsVersion: true,
  creditOrder: true,
  clients: true,
});

export type WorkType = z.infer<typeof WorkTypeSchema>;
export type WorkMeta = z.infer<typeof WorkMetaSchema>;
export type CreditOrderItem = WorkMeta['creditOrder'][number];

export const DEFAULT_WORK_META: WorkMeta = {
  title: '',
  slug: null,
  type: 'music_project',
  year: DEFAULT_PERIOD.year,
  month: DEFAULT_PERIOD.month,
  untilYear: DEFAULT_PERIOD.year,
  untilMonth: DEFAULT_PERIOD.month,
  isPresent: false,
  summary: '',
  metadata: {},
  featured: false,
  creditsVersion: 0,
  creditOrder: [],
  clients: [],
};

export const WORK_META_JSON_KEYS: ReadonlySet<keyof WorkMeta> = WORK_JSON_KEYS;
