import { forwardRequestCorrelationHeader } from '@/lib/observability/request-correlation';

const REQUEST_METADATA_HEADER_NAMES = ['user-agent'] as const;

function setHeaderIfPresent(target: Headers, name: string, value: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }

  target.set(name, trimmed);
  return true;
}

export function forwardIncomingRequestMetadataHeaders(target: Headers, incoming: Headers): void {
  forwardRequestCorrelationHeader(target, incoming);

  for (const name of REQUEST_METADATA_HEADER_NAMES) {
    setHeaderIfPresent(target, name, incoming.get(name));
  }
}
