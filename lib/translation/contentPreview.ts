import { extractPageTranslationContentText } from '@echovisionlab/geul-common/collaboration/page';
import { extractBlocksMetadataText } from '@/lib/ai/extract';
import type { LooseBlock } from '@/lib/types/editor/schema';

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function extractTranslationContentPreview(contentJson?: Uint8Array): string {
  if (!contentJson || contentJson.length === 0) {
    return '';
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(contentJson)) as unknown;
    if (Array.isArray(parsed)) {
      return extractBlocksMetadataText(parsed as LooseBlock[]);
    }

    const record = readRecord(parsed);
    if (!record) {
      return '';
    }

    if (Array.isArray(record.description)) {
      return extractBlocksMetadataText(record.description as LooseBlock[]);
    }

    const sections = Array.isArray(record.sections) ? record.sections : [];
    return extractPageTranslationContentText(sections);
  } catch {
    return '';
  }
}
