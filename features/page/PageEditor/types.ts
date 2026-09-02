import { createBlockId } from '@/lib/editor/block-id';
import {
  DEFAULT_SECTION_SETTINGS,
  parseSectionMeta,
  type ColumnData,
  type ColumnsSection,
  type SectionMeta,
  type SectionSettings,
  type SectionType,
} from '@/features/page/blocks/section-schema';

// ============================================================================
// Re-export Types
// ============================================================================

export type { SectionMeta, SectionSettings, SectionType, ColumnData, ColumnsSection };

export { DEFAULT_SECTION_SETTINGS };

// ============================================================================
// Update Types
// ============================================================================

/**
 * Type for section updates.
 * Allows partial settings, props, and columns updates.
 */
export interface SectionUpdates {
  settings?: Partial<SectionSettings>;
  props?: Record<string, unknown>;
  columns?: ColumnData[];
}

// ============================================================================
// Section Factory Functions
// ============================================================================

/**
 * Creates a default section of the specified type.
 * Uses Zod schema to validate and apply defaults.
 */
export function createDefaultSection(type: SectionType): SectionMeta {
  const base = {
    id: createBlockId(),
    type,
    settings: {},
  };

  if (type === 'columns') {
    return parseSectionMeta({
      ...base,
      columns: [
        { id: createBlockId(), sections: [] },
        { id: createBlockId(), sections: [] },
      ],
    });
  }

  return parseSectionMeta(base);
}
