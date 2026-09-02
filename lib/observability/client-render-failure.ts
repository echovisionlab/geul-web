'use client';

export const CLIENT_RENDER_FAILURE_ENDPOINT = '/api/observability/client-render-failure';

export type ClientRenderFailureSurface = 'general' | 'admin' | 'global';

const reportedErrors = new WeakSet<Error>();
const MINIFIED_REACT_ERROR_PATTERN = /Minified React error #(\d{1,4})(?:\D|$)/;

function reactErrorCode(error: Error): string | undefined {
  return error.message.match(MINIFIED_REACT_ERROR_PATTERN)?.[1];
}

/**
 * Reports the fact that a React error boundary was reached. The only detail
 * inspected is React's bounded numeric production error code; messages,
 * stacks, digests, and application data are never serialized.
 */
export function reportClientRenderFailure(surface: ClientRenderFailureSurface, error: Error): void {
  if (reportedErrors.has(error)) {
    return;
  }
  reportedErrors.add(error);

  const reportId = globalThis.crypto?.randomUUID?.();
  if (!reportId) {
    return;
  }

  void fetch(CLIENT_RENDER_FAILURE_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      surface,
      kind: 'react_error_boundary',
      report_id: reportId,
      ...(reactErrorCode(error) ? { react_error_code: reactErrorCode(error) } : {}),
    }),
  }).catch(() => {
    // Reporting must never recurse into another application error surface.
  });
}
