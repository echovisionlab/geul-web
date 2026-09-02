import { installP5SandboxRunner } from './p5-sandbox-runner';
import { P5_LIBRARY_INTEGRITY, P5_LIBRARY_VERSION, P5_LOCAL_LIBRARY_PATH } from './p5-runtime-assets';

const DEFAULT_P5_LIBRARY_URL = `https://cdn.jsdelivr.net/npm/p5@${P5_LIBRARY_VERSION}/lib/p5.min.js`;

const P5_PREVIEW_DOCUMENT_STYLE =
  'html,body,#sketch{width:100%;height:100%;margin:0;overflow:hidden;background:#101113}' +
  '#sketch{display:grid;place-items:center}' +
  'canvas{display:block;max-width:100%;max-height:100%;width:auto!important;height:auto!important}';

function serializeP5InlineJSON(value: unknown, inputName: string): string {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') {
    throw new TypeError(`${inputName} must be JSON serializable.`);
  }
  return serialized.replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function serializeP5ContentSecurityPolicy(directives: readonly string[]): string {
  return directives.join('; ');
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

/** Builds the opaque, device-free p5 preview document. */
export function buildP5SandboxDocument(
  source: string,
  channel: string,
  libraryUrl = DEFAULT_P5_LIBRARY_URL,
  fallbackLibraryUrl = P5_LOCAL_LIBRARY_PATH,
): string {
  const resolvedLibraryUrl = new URL(libraryUrl, globalThis.location?.href ?? 'http://localhost/');
  const resolvedFallbackUrl = new URL(fallbackLibraryUrl, globalThis.location?.href ?? 'http://localhost/');
  const runnerOptions = serializeP5InlineJSON(
    {
      source,
      channel,
      fallbackLibraryUrl: resolvedFallbackUrl.toString(),
      libraryIntegrity: P5_LIBRARY_INTEGRITY,
    },
    'Sandbox runner options',
  );
  const boot = `(${installP5SandboxRunner.toString()})(window, ${runnerOptions});`;
  const scriptUrl = escapeAttribute(resolvedLibraryUrl.toString());
  const scriptOrigins = [...new Set([resolvedLibraryUrl.origin, resolvedFallbackUrl.origin])]
    .map(escapeAttribute)
    .join(' ');
  const contentSecurityPolicy = serializeP5ContentSecurityPolicy([
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' ${scriptOrigins}`,
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'media-src data: blob:',
    "connect-src 'none'",
    "font-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ]);

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
<style>${P5_PREVIEW_DOCUMENT_STYLE}</style>
<script>${boot}</script>
<script src="${scriptUrl}" integrity="${P5_LIBRARY_INTEGRITY}" crossorigin="anonymous" referrerpolicy="no-referrer" onload="window.__startP5()" onerror="window.__loadP5Fallback()"></script>
</head><body><div id="sketch"></div></body></html>`;
}
