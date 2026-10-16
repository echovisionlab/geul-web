'use client';

import { useEffect, useRef } from 'react';

interface EmailPreviewFrameProps {
  srcDoc: string;
  title: string;
}

/** The email renderer owns srcDoc; this view owns only the surrounding frame's size. */
export function EmailPreviewFrame({ srcDoc, title }: EmailPreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const hostWindow = frame.ownerDocument.defaultView;
    if (!hostWindow) {
      return;
    }

    let disposed = false;
    let pendingFrame: number | undefined;
    let documentCleanup: (() => void) | undefined;

    const watchDocument = () => {
      documentCleanup?.();
      if (pendingFrame !== undefined) {
        hostWindow.cancelAnimationFrame(pendingFrame);
      }
      pendingFrame = undefined;
      const document = frame.contentDocument;
      if (!document?.body) {
        return;
      }
      let current = true;

      const measure = () => {
        pendingFrame = undefined;
        if (disposed || !current || frame.contentDocument !== document) {
          return;
        }
        // Remove the previous viewport height before measuring, so a shorter email can shrink.
        // This changes the outer iframe only, never the renderer's HTML or document styles.
        frame.style.height = '0px';
        const height = Math.max(
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight,
          document.body.scrollHeight,
          document.body.offsetHeight,
          1,
        );
        frame.style.height = `${Math.ceil(height)}px`;
      };
      const scheduleMeasurement = () => {
        if (disposed || !current || pendingFrame !== undefined) {
          return;
        }
        pendingFrame = hostWindow.requestAnimationFrame(measure);
      };
      const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasurement);
      observer?.observe(document.documentElement);
      observer?.observe(document.body);
      // Image completion and font loading may change the document after iframe.onload.
      document.addEventListener('load', scheduleMeasurement, true);
      void document.fonts?.ready?.then(scheduleMeasurement);
      scheduleMeasurement();
      documentCleanup = () => {
        current = false;
        observer?.disconnect();
        document.removeEventListener('load', scheduleMeasurement, true);
      };
    };

    frame.addEventListener('load', watchDocument);
    // The iframe may already have loaded before this effect ran.
    watchDocument();
    return () => {
      disposed = true;
      frame.removeEventListener('load', watchDocument);
      documentCleanup?.();
      if (pendingFrame !== undefined) {
        hostWindow.cancelAnimationFrame(pendingFrame);
      }
    };
  }, [srcDoc]);

  return (
    <iframe
      ref={frameRef}
      srcDoc={srcDoc}
      title={title}
      scrolling="no"
      style={{ display: 'block', width: '100%', height: 1, border: 0 }}
    />
  );
}
