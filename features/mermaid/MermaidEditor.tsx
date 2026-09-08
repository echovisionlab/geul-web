'use client';

import { useId } from 'react';
import { TextInput } from '@/components/core/Input';
import { useTranslations } from 'next-intl';
import { MonacoSourceEditor } from '@/features/editor/tiptap/code-editor/MonacoSourceEditor';
import { MermaidDiagram } from './MermaidDiagram';
import { MERMAID_SOURCE_LIMIT } from './mermaid-renderer';
import classes from './Mermaid.module.css';

export interface MermaidEditorProps {
  source: string;
  autoFocus?: boolean;
  title?: string;
  onChange?: (source: string) => void;
  onTitleChange?: (title: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onEscape?: () => void;
  onCaptionExit?: () => boolean;
  modelPath?: string;
}

export function MermaidEditor({
  source,
  autoFocus = false,
  title = '',
  onChange,
  onTitleChange,
  modelPath,
  onUndo,
  onRedo,
  onEscape,
  onCaptionExit,
}: MermaidEditorProps) {
  const id = useId();
  const t = useTranslations('mermaid');
  return (
    <div className={classes.editor} data-mermaid-editor>
      <div className={classes.split}>
        <MonacoSourceEditor
          value={source}
          onMount={(editor) => {
            if (autoFocus) {
              editor.focus();
            }
          }}
          onChange={onChange}
          language="plaintext"
          readOnly={!onChange}
          modelPath={modelPath ?? `mermaid/${id}.mmd`}
          ariaLabel={t('source')}
          height={280}
          onUndo={onUndo}
          onRedo={onRedo}
          onEscape={onEscape}
          maxLength={MERMAID_SOURCE_LIMIT}
          editorOptions={{ wordWrap: 'on', minimap: { enabled: false }, lineNumbersMinChars: 2, tabFocusMode: true }}
        />
        <MermaidDiagram source={source} title={title} />
      </div>
      {onTitleChange && (
        <TextInput
          variant="unstyled"
          size="sm"
          value={title}
          onChange={(event) => onTitleChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
              return;
            }
            if ((event.key === 'Tab' || event.key === 'Enter') && onCaptionExit?.()) {
              event.preventDefault();
            }
          }}
          placeholder={t('title')}
          aria-label={t('title')}
        />
      )}
    </div>
  );
}
