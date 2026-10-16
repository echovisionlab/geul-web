import { useCallback, useEffect, useState } from 'react';
import type { localEmailRoom } from './editor-pages';
import { renderLocalEmailPreview } from './email-preview';

export const LOCAL_EMAIL_LAYOUT =
  '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>{{content}}</body></html>';
export const LOCAL_EMAIL_VARIABLES = {
  recipient_name: 'Listening room guest',
  confirm_url: 'https://example.test/confirm',
};

export function useLocalEmailPreview(
  room: ReturnType<typeof localEmailRoom> | null,
  subject: string,
  layoutHtml: string | null = LOCAL_EMAIL_LAYOUT,
) {
  const [preview, setPreview] = useState({ html: '', subject: '', isLoading: false, error: '' });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!room) return;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const render = () => {
      clearTimeout(pending);
      request?.abort();
      pending = setTimeout(() => {
        const controller = new AbortController();
        request = controller;
        setPreview((value) => ({ ...value, isLoading: true, error: '' }));
        void (async () => {
          try {
            const document = room.controller.getLocalizedDocumentSnapshot();
            const result = await renderLocalEmailPreview(
              {
                locale: document.locale,
                subject,
                document,
                layoutHtml: layoutHtml ?? undefined,
                variables: LOCAL_EMAIL_VARIABLES,
              },
              controller.signal,
            );
            if (!controller.signal.aborted) setPreview({ ...result, isLoading: false, error: '' });
          } catch (error) {
            if (!controller.signal.aborted)
              setPreview({
                html: '',
                subject: '',
                isLoading: false,
                error: error instanceof Error ? error.message : 'Email preview failed',
              });
          }
        })();
      }, 150);
    };
    room.document.on('update', render);
    render();
    return () => {
      clearTimeout(pending);
      request?.abort();
      room.document.off('update', render);
    };
  }, [room, subject, layoutHtml, revision]);
  return { ...preview, refresh };
}
