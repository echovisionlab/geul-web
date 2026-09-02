import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExternalVideoView } from './ExternalVideoView';

describe('ExternalVideoView', () => {
  it('renders a non-autoplay iframe and keeps the original link', () => {
    const html = renderToStaticMarkup(<ExternalVideoView url="https://youtu.be/dQw4w9WgXcQ" title="Watch the video" />);
    expect(html).toContain('autoplay=0');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(html).toContain('allow="fullscreen; picture-in-picture"');
    expect(html).not.toContain('allow="autoplay');
    expect(html).toContain('href="https://youtu.be/dQw4w9WgXcQ"');
    expect(html).toContain('data-external-video-fallback="true"');
    expect(html).toContain('data-external-video-print-url="true" aria-hidden="true"');
    expect(html).toContain('(https://youtu.be/dQw4w9WgXcQ)');
  });

  it('renders only the safe original-link fallback for an invalid provider URL', () => {
    const html = renderToStaticMarkup(<ExternalVideoView url="https://youtube.com.evil.test/x" title="Original" />);
    expect(html).not.toContain('<iframe');
    expect(html).toContain('<a href="https://youtube.com.evil.test/x">Original</a>');
  });

  it('keeps safe ordinary HTTP fallback links clickable', () => {
    const html = renderToStaticMarkup(<ExternalVideoView url="http://example.com/video" title="Original" />);
    expect(html).toBe('<a href="http://example.com/video">Original</a>');
  });

  it('renders unsafe schemes as non-clickable text', () => {
    const unsafeUrl = `${'java'}script:alert(1)`;
    const html = renderToStaticMarkup(<ExternalVideoView url={unsafeUrl} title="Unsafe" />);
    expect(html).toBe('<span>Unsafe</span>');
  });

  it('constrains and centers auto-detected Shorts without replacing caller figure styles', () => {
    const html = renderToStaticMarkup(
      <ExternalVideoView
        url="https://youtube.com/shorts/dQw4w9WgXcQ"
        title="Short"
        style={{ backgroundColor: 'red' }}
      />,
    );
    expect(html).toContain('<figure style="background-color:red"');
    expect(html).toContain(
      'data-external-video-player-frame="true" style="width:min(100%, 22.5rem);margin-inline:auto"',
    );
    expect(html).toContain('aspect-ratio:9 / 16');
  });

  it('applies the same portrait constraint for an explicit 9:16 override', () => {
    const html = renderToStaticMarkup(
      <ExternalVideoView url="https://youtu.be/dQw4w9WgXcQ" title="Portrait" aspectRatio="9:16" />,
    );
    expect(html).toContain('style="width:min(100%, 22.5rem);margin-inline:auto"');
    expect(html).toContain('aspect-ratio:9 / 16');
  });
});
