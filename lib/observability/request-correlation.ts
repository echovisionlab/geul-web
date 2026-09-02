import { createRequestId, isRequestId, REQUEST_ID_HEADER } from '@echovisionlab/geul-telemetry/request-id';

export { REQUEST_ID_HEADER };

/**
 * Public callers never choose the correlation identifier. Proxy creates this
 * immutable context once, then forwards only its canonical request ID.
 */
export function createPublicRequestCorrelation(): { readonly requestId: string } {
  return { requestId: createRequestId() };
}

/**
 * API and Connect forwarding may only use the identifier already installed by
 * the Web ingress. Invalid values are deliberately not forwarded.
 *
 * Next's server fetch instrumentation injects the active W3C trace context;
 * this helper owns the separate, application-level request ID.
 */
export function forwardRequestCorrelationHeader(target: Headers, incoming: Headers): void {
  const requestId = incoming.get(REQUEST_ID_HEADER)?.trim();
  if (requestId && isRequestId(requestId)) {
    target.set(REQUEST_ID_HEADER, requestId);
    return;
  }

  target.delete(REQUEST_ID_HEADER);
}
