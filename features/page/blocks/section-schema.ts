import { z } from 'zod';
import {
  isNestablePageBlockDefinition,
  pageBlockDefinitions,
  pageBlockManifest,
  type PageBlockDefinition,
} from './block-manifest';
import { sectionSettingsSchema } from './section-base-schema';
import { normalizeMapBlockPropsInput } from '@/lib/types/map-block/schema';

export { sectionSettingsSchema } from './section-base-schema';

function requireNonEmpty<T>(values: readonly T[]): [T, ...T[]] {
  const first = values[0];
  if (!first) {
    throw new Error('Page block manifest must define at least one block.');
  }
  return [first, ...values.slice(1)];
}

interface ColumnData {
  id: string;
  sections: SectionMeta[];
}

const nestedSectionSchemas = pageBlockDefinitions
  .filter(isNestablePageBlockDefinition)
  .map((definition) => definition.sectionSchema);

const nestedSectionSchema = z.discriminatedUnion('type', requireNonEmpty(nestedSectionSchemas));

const columnDataSchema: z.ZodType<ColumnData> = z.lazy(() =>
  z.object({
    id: z.string(),
    sections: z.array(nestedSectionSchema),
  }),
);

const columnsSectionSchema = pageBlockManifest.columns.sectionSchema.extend({
  columns: z.array(columnDataSchema),
});

type NonColumnsPageBlockDefinition = Exclude<PageBlockDefinition, { type: 'columns' }>;

function isNonColumnsDefinition(definition: PageBlockDefinition): definition is NonColumnsPageBlockDefinition {
  return definition.type !== 'columns';
}

const topLevelSectionSchemas = pageBlockDefinitions
  .filter(isNonColumnsDefinition)
  .map((definition) => definition.sectionSchema);

export const sectionMetaSchema = z.discriminatedUnion(
  'type',
  requireNonEmpty([...topLevelSectionSchemas, columnsSectionSchema]),
);

export type SectionMeta = z.infer<typeof sectionMetaSchema>;
export type SectionSettings = z.infer<typeof sectionSettingsSchema>;
export type SectionType = SectionMeta['type'];
export type ColumnsSection = z.infer<typeof columnsSectionSchema>;
export type { ColumnData };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSectionInput(data: unknown): unknown {
  if (!isRecord(data)) {
    return data;
  }
  if (data.type === 'map') {
    return { ...data, props: normalizeMapBlockPropsInput(data.props) };
  }
  if (data.type !== 'columns' || !Array.isArray(data.columns)) {
    return data;
  }
  return {
    ...data,
    columns: data.columns.map((column) => {
      if (!isRecord(column) || !Array.isArray(column.sections)) {
        return column;
      }
      return { ...column, sections: column.sections.map(normalizeSectionInput) };
    }),
  };
}

export function parseSectionMeta(data: unknown): SectionMeta {
  return sectionMetaSchema.parse(normalizeSectionInput(data));
}

export function parseSectionMetaSafe(data: unknown): SectionMeta | null {
  const result = sectionMetaSchema.safeParse(normalizeSectionInput(data));
  return result.success ? result.data : null;
}

export const DEFAULT_SECTION_SETTINGS: SectionSettings = sectionSettingsSchema.parse({});
