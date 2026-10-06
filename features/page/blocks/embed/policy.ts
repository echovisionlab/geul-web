import { EMBED_MIN_HEIGHT, type EmbedProps } from './schema';

const isLoopback = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

export function resolveEmbedUrl(value: string, parentOrigin?: string | null): URL | null {
  try {
    const url = new URL(value.trim());
    const local =
      parentOrigin && isLoopback(new URL(parentOrigin).hostname) && isLoopback(url.hostname) && isToolModuleUrl(url);
    return (url.protocol === 'https:' || (local && url.protocol === 'http:')) && !url.username && !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

export function isToolModuleUrl(url: URL): boolean {
  return /\.(?:m?js)$/.test(url.pathname);
}

export function isTrustedToolModuleUrl(url: URL, parentOrigin: string): boolean {
  const parent = new URL(parentOrigin);
  if (url.username || url.password) {
    return false;
  }
  if (url.origin === parent.origin) {
    return url.protocol === 'https:' || url.protocol === 'http:';
  }
  if (isLoopback(parent.hostname) && isLoopback(url.hostname)) {
    return url.protocol === 'https:' || url.protocol === 'http:';
  }
  const baseHostname = parent.hostname.replace(/^www\./, '');
  const prefix = url.hostname.slice(0, -(baseHostname.length + 1));
  return (
    url.protocol === 'https:' &&
    !url.port &&
    url.hostname.endsWith(`.${baseHostname}`) &&
    /^tools-[a-z0-9-]+$/.test(prefix)
  );
}

export function hasUnsafeEmbedOrigin(props: EmbedProps, parentOrigin: string): boolean {
  const url = resolveEmbedUrl(props.uri, parentOrigin);
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
