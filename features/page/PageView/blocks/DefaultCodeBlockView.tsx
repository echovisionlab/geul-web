'use client';

import { useTranslations } from 'next-intl';
import { CodeBlockSurface } from '@/features/editor/tiptap/code/CodeBlockSurface';
import { getCodeBlockLanguageName, resolveCodeBlockLanguage } from '@/lib/editor/code-block-options';
import { getBlockPropString } from '@/lib/media/shared';
import type { Block } from '@/lib/types/page-content';
import { getContainerStyle } from './DefaultBlockView.utils';

export function DefaultCodeBlockView({ block }: { block: Block }) {
  const editorMessages = useTranslations('editorCommon.editor');
  const commonActions = useTranslations('common.actions');
  const commonLabels = useTranslations('common.labels');
  const language = (block.props.language as string) || 'text';
  const resolvedLanguage = resolveCodeBlockLanguage(language);
  const title = getBlockPropString(block.props, 'title');
  const code = block.content?.map((c) => c.text || '').join('') || '';

  return (
    <figure data-content-type="codeBlock" style={getContainerStyle(block)}>
      <div
        data-language={language}
        data-preview-width={getBlockPropString(block.props, 'previewWidth', '100')}
        data-text-alignment={String(block.props.textAlignment || 'left')}
      >
        <CodeBlockSurface
          title={title}
          fallbackTitle={editorMessages('slashMenu.items.codeBlock.title')}
          titleLabel={commonLabels('title')}
          languageName={getCodeBlockLanguageName(language)}
          source={code}
          sourceLabel={commonLabels('source')}
          copyLabel={commonActions('copy')}
          monacoLanguage={resolvedLanguage.monacoLanguage}
          modelPath={`public/code/${encodeURIComponent(block.id)}.${resolvedLanguage.fileExtension}`}
        />
      </div>
    </figure>
  );
}
