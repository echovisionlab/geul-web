import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import type { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';

export type GeneratedRichTextBlock<K extends LocalizedRichTextBlock['kind']> = Extract<
  LocalizedRichTextBlock,
  { kind: K }
>;

export interface GeneratedRichTextBlockViewProps {
  block: LocalizedRichTextBlock;
  requestedLocale?: string;
  downloadOwner?: {
    entityType: PublicMediaEntityType;
    entityId: string;
  };
  allowStandaloneExternalVideo?: boolean;
  isTopLevel?: boolean;
}
