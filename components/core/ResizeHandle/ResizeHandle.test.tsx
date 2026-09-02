// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResizeHandle } from './ResizeHandle';

describe('ResizeHandle', () => {
  it('exposes keyboard-operable slider semantics', () => {
    const html = renderToStaticMarkup(
      <ResizeHandle direction="right" value={64} min={10} max={100} ariaLabel="미리보기 너비 늘리기" />,
    );

    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-orientation="horizontal"');
    expect(html).toContain('data-resize-handle="true"');
    expect(html).toContain('data-resize-direction="right"');
    expect(html).toContain('aria-valuenow="64"');
    expect(html).toContain('aria-valuemin="10"');
    expect(html).toContain('aria-valuemax="100"');
  });
});
