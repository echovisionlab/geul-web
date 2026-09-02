import { createHash } from 'node:crypto';
import { installP5DeviceRunner } from '../../../../features/editor/tiptap/p5/p5-device-runner';
import { P5_LIBRARY_INTEGRITY, P5_LOCAL_LIBRARY_PATH } from '../../../../features/editor/tiptap/p5/p5-runtime-assets';

export interface P5RunnerDocument {
  html: string;
  contentSecurityPolicy: string;
}

const P5_RUNNER_STYLE =
  'html,body,#sketch{width:100%;height:100%;margin:0;overflow:hidden;background:#101113}' +
  '#sketch{display:grid;place-items:center}' +
  'canvas{display:block;max-width:100%;max-height:100%;width:auto!important;height:auto!important}';

function inlineJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') {
    throw new TypeError('p5 runner input must be JSON serializable.');
  }
  return serialized.replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function sha256Source(source: string): string {
  return `sha256-${createHash('sha256').update(source).digest('base64')}`;
}

export function buildP5RunnerDocument(parentOrigin: string): P5RunnerDocument {
  const boot = `(() => {
  const channel = new URLSearchParams(location.hash.slice(1)).get('channel') || '';
  if (!channel) return;
  (${installP5DeviceRunner.toString()})(window, { channel, parentOrigin: ${inlineJson(parentOrigin)} });
})();`;
  const contentSecurityPolicy = [
    "default-src 'none'",
    `script-src '${sha256Source(boot)}' '${P5_LIBRARY_INTEGRITY}' 'unsafe-eval'`,
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
    `frame-ancestors ${parentOrigin}`,
  ].join('; ');

  return {
    contentSecurityPolicy,
    html: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">
<style>${P5_RUNNER_STYLE}</style>
<script src="${P5_LOCAL_LIBRARY_PATH}" integrity="${P5_LIBRARY_INTEGRITY}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>${boot}</script></head><body><div id="sketch"></div></body></html>`,
  };
}
