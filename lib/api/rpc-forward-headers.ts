import { forwardIncomingRequestMetadataHeaders } from '@/lib/api/request-metadata-headers';

const RPC_PASSTHROUGH_HEADER_NAMES = [
  'accept',
  'accept-language',
  'content-type',
  'authorization',
  'connect-protocol-version',
  'connect-timeout-ms',
  'connect-content-encoding',
  'connect-accept-encoding',
  'grpc-timeout',
  'x-grpc-web',
  'x-user-agent',
] as const;

export function buildRpcForwardHeaders(inbound: Headers, cookieHeader: string): Headers {
  const headers = new Headers();
  forwardIncomingRequestMetadataHeaders(headers, inbound);

  for (const headerName of RPC_PASSTHROUGH_HEADER_NAMES) {
    const headerValue = inbound.get(headerName);
    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  }

  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }

  return headers;
}
