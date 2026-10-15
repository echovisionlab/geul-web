import type {
  ContentBlockMediaItem,
  LocalizedRichTextDocument,
  LocalizedPageDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedRichTextBlock } from './contract/localized-rich-text';
import type { JSONContent } from '@tiptap/core';
import type { LocalizedPageSection } from './contract/localized-page';

/** SSR data renders the initial view and validates an omitted bootstrap body. Never merge it into the live Y.Doc. */
export interface EditorSnapshot {
  document?: LocalizedRichTextDocument | LocalizedPageDocument;
  locale: string;
  sourceLocale: string;
  localeExists: boolean;
  documentRevision: string;
  targetRevision?: string;
  editable: boolean;
  title: string;
  summary: string;
  blockMedia?: ContentBlockMediaItem[];
  blocks?: readonly LocalizedRichTextBlock[];
  content?: JSONContent;
  sections?: (Omit<LocalizedPageSection, 'richText' | 'columns'> & {
    blocks?: readonly LocalizedRichTextBlock[];
    content?: JSONContent;
    columns: { id: string; ratio: number; sections: NonNullable<EditorSnapshot['sections']> }[];
  })[];
}
