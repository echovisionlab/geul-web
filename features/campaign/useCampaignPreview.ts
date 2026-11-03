'use client';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import type { EmailCampaignTiptapEditorHandle } from '@/features/editor/tiptap/profiles/EmailTiptapEditor';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import type { LocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { previewCampaignAction } from '@/lib/actions/campaign';

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
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [previewPending, setPreviewPending] = useState(campaignLoaded);
  const editorRef = useRef<EmailCampaignTiptapEditorHandle | null>(null);
  const requestIdRef = useRef(0);
  const target = `${campaignId}:${locale}`;
  const settledTargetRef = useRef(target);
  const currentTargetRef = useRef(target);
  currentTargetRef.current = target;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);
  useEffect(() => {
    requestIdRef.current += 1;
    setPreviewHtml('');
    setPreviewError(null);
    setPreviewPending(campaignLoaded);
  }, [target, campaignLoaded]);
  const showEditor = viewMode === 'split' || viewMode === 'edit';
  const showPreview = viewMode === 'split' || viewMode === 'preview';

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
      const requestedTarget = target;
      if (!mountedRef.current) {
        return;
      }
      setPreviewPending(true);
      try {
        const preview = await previewCampaignAction(campaignId, {
          locale,
          layoutId,
          subject,
          document,
        }).then(unwrapQueryResult);
        if (mountedRef.current && requestedTarget === currentTargetRef.current && requestId === requestIdRef.current) {
          settledTargetRef.current = requestedTarget;
          setPreviewHtml(preview?.htmlContent ?? '');
          setPreviewError(null);
        }
      } catch (error) {
        if (mountedRef.current && requestedTarget === currentTargetRef.current && requestId === requestIdRef.current) {
          settledTargetRef.current = requestedTarget;
          setPreviewError(error);
        }
      } finally {
        if (mountedRef.current && requestedTarget === currentTargetRef.current && requestId === requestIdRef.current) {
          setPreviewPending(false);
        }
      }
    },
    [campaignId, campaignLoaded, layoutId, locale, subject, target],
  );

  const debouncedRefresh = useDebouncedCallback(
    async () => {
      const requestId = ++requestIdRef.current;
      const document = getDocumentSnapshot();
      if (requestId === requestIdRef.current) {
        await refresh(document, requestId);
      }
    },
    { delay: PREVIEW_DEBOUNCE_MS, flushOnUnmount: false },
  );

  const scheduleRefresh = useCallback(() => {
    requestIdRef.current += 1;
    setPreviewPending(true);
    return debouncedRefresh();
  }, [debouncedRefresh]);

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
      setPreviewPending(true);
      void scheduleRefresh();
    }
  }, [editorSynced, layoutId, locale, scheduleRefresh, showPreview, subject]);

  return {
    viewMode,
    showEditor,
    showPreview,
    previewSrcDoc: settledTargetRef.current === target ? previewHtml : '',
    query: {
      isError: settledTargetRef.current === target && previewError !== null,
      error: settledTargetRef.current === target ? previewError : null,
      isFetching: previewPending || settledTargetRef.current !== target,
      refetch: () => refresh(getDocumentSnapshot()),
    },
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
