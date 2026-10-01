'use client';

import { CodeBlockProps_Language } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { GeneratedRichTextBlock } from './GeneratedRichTextBlockView.types';
import { CodeBlockSurface } from '@/features/editor/tiptap/code/CodeBlockSurface';
import { getCodeBlockLanguageName, resolveCodeBlockLanguage } from '@/lib/editor/code-block-options';

function codeLanguage(value: CodeBlockProps_Language | undefined): string {
  const name = value === undefined ? 'TEXT' : CodeBlockProps_Language[value];
  return name.toLowerCase().replace('vue_html', 'vue-html').replace('objective_c', 'objective-c');
}

export function GeneratedCodeBlockView({ block }: { block: GeneratedRichTextBlock<'code-block'> }) {
  const language = codeLanguage(block.base.props?.language);
  const resolved = resolveCodeBlockLanguage(language);
  return (
    <CodeBlockSurface
      title={block.locale.props?.title ?? ''}
      fallbackTitle={getCodeBlockLanguageName(language)}
      titleLabel="Title"
      languageName={getCodeBlockLanguageName(language)}
      source={block.locale.content}
      sourceLabel="Source"
      copyLabel="Copy"
      monacoLanguage={resolved.monacoLanguage}
      modelPath={`public/code/${encodeURIComponent(block.id)}.${resolved.fileExtension}`}
    />
  );
}
