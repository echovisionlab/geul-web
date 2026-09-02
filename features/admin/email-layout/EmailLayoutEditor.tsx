'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useTranslations } from 'next-intl';
import type * as Y from 'yjs';
import { Stack, Text } from '@mantine/core';
import { MonacoSourceEditor } from '@/features/editor/tiptap/code-editor';

interface EmailLayoutEditorProps {
  provider: HocuspocusProvider;
  doc: Y.Doc;
  isSynced?: boolean;
  initialContent?: string;
  editable?: boolean;
  onChange?: (content: string) => void;
}

const MONACO_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: 'on',
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  // Keep raw {{variable}} placeholders byte-stable; Monaco's HTML formatter
  // rewrites them into invalid brace-separated output.
  formatOnPaste: false,
  formatOnType: false,
};

function LoadingPlaceholder() {
  const t = useTranslations('adminList.emailLayouts.detail');
  return (
    <Stack align="center" justify="center" h="100%">
      <Text c="dimmed">{t('states.loadingEditor')}</Text>
    </Stack>
  );
}

export function EmailLayoutEditor({
  provider: _provider,
  doc,
  isSynced = false,
  initialContent,
  editable = true,
  onChange,
}: EmailLayoutEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const destroyBindingRef = useRef<(() => void) | null>(null);

  const destroyBinding = useCallback(() => {
    const destroy = destroyBindingRef.current;
    if (!destroy) {
      return;
    }
    destroyBindingRef.current = null;
    destroy();
  }, []);

  const attachBinding = useCallback(
    (monacoEditor: editor.IStandaloneCodeEditor | null) => {
      if (!monacoEditor) {
        return;
      }

      const model = monacoEditor.getModel();
      if (!model) {
        return;
      }

      const yText = doc.getText('html-content');
      let applyingRemote = false;

      destroyBinding();

      const syncModelFromYText = (fallbackValue?: string) => {
        const nextValue = yText.toString() || fallbackValue || '';
        if (model.getValue() === nextValue) {
          return;
        }

        applyingRemote = true;
        model.setValue(nextValue);
        applyingRemote = false;
      };

      syncModelFromYText(initialContent);

      const observeYText = () => {
        syncModelFromYText();
      };
      yText.observe(observeYText);

      const contentListener = model.onDidChangeContent((event) => {
        if (applyingRemote) {
          return;
        }

        applyingRemote = true;
        doc.transact(() => {
          event.changes
            .slice()
            .sort((left, right) => right.rangeOffset - left.rangeOffset)
            .forEach((change) => {
              if (change.rangeLength > 0) {
                yText.delete(change.rangeOffset, change.rangeLength);
              }
              if (change.text.length > 0) {
                yText.insert(change.rangeOffset, change.text);
              }
            });
        });
        applyingRemote = false;
      });

      destroyBindingRef.current = () => {
        contentListener.dispose();
        yText.unobserve(observeYText);
      };
    },
    [destroyBinding, doc, initialContent],
  );

  // Seed initial content to Yjs only after initial sync to avoid duplicate inserts.
  useEffect(() => {
    if (!editable || !doc || !isSynced || !initialContent) {
      return;
    }

    const yText = doc.getText('html-content');
    if (yText.length === 0) {
      doc.transact(() => {
        yText.insert(0, initialContent);
      });
    }
  }, [doc, editable, initialContent, isSynced]);

  // Observe Yjs changes and notify parent
  useEffect(() => {
    if (!doc || !onChange) {
      return;
    }

    const yText = doc.getText('html-content');
    const observer = () => onChange(yText.toString() || initialContent || '');

    yText.observe(observer);
    observer(); // Initial sync

    return () => yText.unobserve(observer);
  }, [doc, initialContent, onChange]);

  // Cleanup Monaco binding on unmount
  useEffect(() => {
    return () => {
      destroyBinding();
    };
  }, [destroyBinding]);

  useEffect(() => {
    const monacoEditor = editorRef.current;
    if (!monacoEditor) {
      return;
    }

    attachBinding(monacoEditor);

    return () => {
      destroyBinding();
    };
  }, [attachBinding, destroyBinding]);

  const handleMount = (monacoEditor: editor.IStandaloneCodeEditor, _monaco: Monaco) => {
    editorRef.current = monacoEditor;
    attachBinding(monacoEditor);

    monacoEditor.onDidDispose(() => {
      if (editorRef.current === monacoEditor) {
        editorRef.current = null;
      }
      destroyBinding();
    });
  };

  if (!doc) {
    return <LoadingPlaceholder />;
  }

  return (
    <MonacoSourceEditor
      height="100%"
      language="html"
      value={doc.getText('html-content').toString() || initialContent || ''}
      modelPath={`inmemory://email-layout/${doc.clientID}.html`}
      ariaLabel="HTML"
      readOnly={!editable}
      bordered={false}
      onMount={handleMount}
      editorOptions={MONACO_OPTIONS}
      loading={<LoadingPlaceholder />}
    />
  );
}
