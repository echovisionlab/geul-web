import { EMBED_MIN_HEIGHT, type EmbedProps } from './schema';

export function resolveEmbedUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function hasUnsafeEmbedOrigin(props: EmbedProps, parentOrigin: string): boolean {
  const url = resolveEmbedUrl(props.uri);
  return Boolean(
    url && url.origin === parentOrigin && props.allowScripts === 'true' && props.allowSameOrigin === 'true',
  );
}

export function buildEmbedSandbox(props: EmbedProps): string {
  return [
    [props.allowScripts, 'allow-scripts'],
    [props.allowSameOrigin, 'allow-same-origin'],
    [props.allowForms, 'allow-forms'],
    [props.allowDownloads, 'allow-downloads'],
    [props.allowPopups, 'allow-popups'],
  ]
    .filter(([value]) => value === 'true')
    .map(([, token]) => token)
    .join(' ');
}

export function buildEmbedAllow(props: EmbedProps): string {
  return [
    "camera 'none'",
    "geolocation 'none'",
    "display-capture 'none'",
    "autoplay 'none'",
    `microphone ${props.allowMicrophone === 'true' ? "'src'" : "'none'"}`,
    `speaker-selection ${props.allowSpeakerSelection === 'true' ? "'src'" : "'none'"}`,
    `fullscreen ${props.allowFullscreen === 'true' ? "'src'" : "'none'"}`,
  ].join('; ');
}

export function readEmbedHeightMessage(
  event: MessageEvent,
  frameWindow: Window | null,
  expectedOrigin: string,
): number | null {
  if (!frameWindow || event.source !== frameWindow || event.origin !== expectedOrigin) {
    return null;
  }
  const data: unknown = event.data;
  if (data === null || typeof data !== 'object' || !('type' in data) || !('height' in data)) {
    return null;
  }
  if (
    data.type !== 'geul:embed:resize' ||
    typeof data.height !== 'number' ||
    !Number.isFinite(data.height) ||
    data.height <= 0
  ) {
    return null;
  }
  return Math.max(EMBED_MIN_HEIGHT, Math.ceil(data.height));
}

export function isEmbedReadyMessage(event: MessageEvent, frameWindow: Window | null, expectedOrigin: string): boolean {
  const data: unknown = event.data;
  return Boolean(
    frameWindow &&
    event.source === frameWindow &&
    event.origin === expectedOrigin &&
    data !== null &&
    typeof data === 'object' &&
    'type' in data &&
    data.type === 'geul:embed:ready',
  );
}
