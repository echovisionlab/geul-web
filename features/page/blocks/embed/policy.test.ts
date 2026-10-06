import { describe, expect, it } from 'vitest';
import {
  buildEmbedAllow,
  buildEmbedSandbox,
  hasUnsafeEmbedOrigin,
  readEmbedHeightMessage,
  resolveEmbedUrl,
} from './policy';
import { parseEmbedProps } from './schema';

describe('embed security boundaries', () => {
  it('accepts an HTTPS tool address and rejects executable, relative, insecure and credential URLs', () => {
    expect(resolveEmbedUrl(' https://tool.example/embed?locale=ko ')?.href).toBe(
      'https://tool.example/embed?locale=ko',
    );
    for (const uri of [
      '',
      '/tools/example',
      '//tool.example',
      'http://tool.example',
      // eslint-disable-next-line no-script-url -- Verify rejection; this value is never executed.
      'javascript:alert(1)',
      'data:text/html,<script>',
      'https://user:password@tool.example',
    ]) {
      expect(resolveEmbedUrl(uri)).toBeNull();
    }
  });

  it('blocks the script and origin combination that can remove a same-origin sandbox', () => {
    const props = parseEmbedProps({ uri: 'https://site.example/tool' });
    expect(hasUnsafeEmbedOrigin(props, 'https://site.example')).toBe(true);
    expect(hasUnsafeEmbedOrigin(props, 'https://another-tool.example')).toBe(false);
    expect(hasUnsafeEmbedOrigin({ ...props, allowScripts: 'false' }, 'https://site.example')).toBe(false);
    expect(hasUnsafeEmbedOrigin({ ...props, allowSameOrigin: 'false' }, 'https://site.example')).toBe(false);
  });

  it('grants only the selected sandbox capabilities and keeps top navigation and sandbox escape blocked', () => {
    const props = parseEmbedProps({ allowDownloads: 'true', allowPopups: 'true' });
    expect(buildEmbedSandbox(props)).toBe('allow-scripts allow-same-origin allow-downloads allow-popups');
    expect(buildEmbedSandbox(props)).not.toContain('allow-top-navigation');
    expect(buildEmbedSandbox(props)).not.toContain('allow-popups-to-escape-sandbox');
    expect(buildEmbedSandbox(parseEmbedProps({ allowScripts: 'false', allowSameOrigin: 'false' }))).toBe('');
    const allow = buildEmbedAllow({ ...props, allowMicrophone: 'true', allowSpeakerSelection: 'true' });
    expect(allow).toContain("microphone 'src'");
    expect(allow).toContain("speaker-selection 'src'");
    expect(allow).toContain("camera 'none'");
    expect(allow).toContain("geolocation 'none'");
    expect(allow).toContain("fullscreen 'none'");
    expect(allow).not.toContain('*');
  });

  it('accepts resize messages only from this frame and its configured origin, with a finite positive height', () => {
    const frame = {} as Window;
    const otherFrame = {} as Window;
    const message = (data: unknown, origin = 'https://tool.example', source = frame) =>
      ({ data, origin, source }) as MessageEvent;
    const valid = { type: 'geul:embed:resize', height: 740.5 };
    expect(readEmbedHeightMessage(message(valid), frame, 'https://tool.example')).toBe(741);
    expect(
      readEmbedHeightMessage(message(valid, 'https://untrusted.example'), frame, 'https://tool.example'),
    ).toBeNull();
    expect(
      readEmbedHeightMessage(message(valid, 'https://tool.example', otherFrame), frame, 'https://tool.example'),
    ).toBeNull();
    expect(readEmbedHeightMessage(message(valid), null, 'https://tool.example')).toBeNull();
    for (const data of [
      null,
      {},
      { type: 'other', height: 500 },
      { type: 'geul:embed:resize', height: '500' },
      { type: 'geul:embed:resize', height: 0 },
      { type: 'geul:embed:resize', height: -1 },
      { type: 'geul:embed:resize', height: Infinity },
      { type: 'geul:embed:resize', height: NaN },
    ]) {
      expect(readEmbedHeightMessage(message(data), frame, 'https://tool.example')).toBeNull();
    }
    expect(readEmbedHeightMessage(message({ ...valid, height: 1 }), frame, 'https://tool.example')).toBe(180);
    expect(readEmbedHeightMessage(message({ ...valid, height: 12765.5 }), frame, 'https://tool.example')).toBe(12766);
  });
});
