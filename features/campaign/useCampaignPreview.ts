'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import type { EmailCampaignTiptapEditorHandle } from '@/features/editor/tiptap/profiles/EmailTiptapEditor';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import type { LocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { previewCampaignAction } from '@/lib/actions/campaign';
import { buildEmailPreviewSrcDoc } from '@/lib/email/preview-document';

export type CampaignViewMode = 'split' | 'edit' | 'preview';

const PREVIEW_DEBOUNCE_MS = 300;

interface Options {
  campaignId: string;
  campaignLoaded: boolean;
  locale: string;
  layoutId: string | null;
  subject: string;
  editorSynced: boolean;
  blockRoomController: RichTextBlockRoomTiptapController | null;
}

export function useCampaignPreview({
  campaignId,
  campaignLoaded,
  locale,
  layoutId,
  subject,
  editorSynced,
  blockRoomController,
}: Options) {
  const [viewMode, setViewMode] = useState<CampaignViewMode>('split');
  const [previewHtml, setPreviewHtml] = useState('');
  const editorRef = useRef<EmailCampaignTiptapEditorHandle | null>(null);
  const requestIdRef = useRef(0);
  const showEditor = viewMode === 'split' || viewMode === 'edit';
  const showPreview = viewMode === 'split' || viewMode === 'preview';
  const previewSrcDoc = useMemo(() => buildEmailPreviewSrcDoc(previewHtml, locale), [locale, previewHtml]);

  const getDocumentSnapshot = useCallback(() => {
    if (!blockRoomController || !editorSynced) {
      return undefined;
    }
    return blockRoomController.getLocalizedDocumentSnapshot();
  }, [blockRoomController, editorSynced]);

  const refresh = useCallback(
    async (document?: LocalizedRichTextDocument, requestId = ++requestIdRef.current) => {
      if (!campaignLoaded) {
        return;
      }

      try {
        const preview = await previewCampaignAction(campaignId, {
          locale,
          layoutId,
          subject,
          document,
        });
        if (requestId === requestIdRef.current) {
          setPreviewHtml(preview?.htmlContent ?? '');
        }
      } catch {
        // Collaboration can advance while a preview is generated; the next
        // debounced request owns the visible result.
      }
    },
    [campaignId, campaignLoaded, layoutId, locale, subject],
  );

  const scheduleRefresh = useDebouncedCallback(
    async () => {
      const requestId = ++requestIdRef.current;
      const document = getDocumentSnapshot();
      if (requestId === requestIdRef.current) {
        await refresh(document, requestId);
      }
    },
    { delay: PREVIEW_DEBOUNCE_MS, flushOnUnmount: true },
  );

  const changeViewMode = useCallback(
    (value: string) => {
      const nextMode = value as CampaignViewMode;
      setViewMode(nextMode);
      if (nextMode !== 'edit') {
        void refresh();
      }
    },
    [refresh],
  );

  useEffect(() => {
    if (showPreview) {
      void scheduleRefresh();
    }
  }, [editorSynced, layoutId, locale, scheduleRefresh, showPreview, subject]);

  return {
    viewMode,
    showEditor,
    showPreview,
    previewSrcDoc,
    scheduleRefresh,
    refresh,
    changeViewMode,
    editorReady: (editor: EmailCampaignTiptapEditorHandle) => {
      editorRef.current = editor;
    },
    editorContentChanged: () => {
      if (showPreview) {
        void scheduleRefresh();
      }
    },
  };
}
