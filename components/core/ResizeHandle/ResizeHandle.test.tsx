// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResizeHandle, type ResizeHandleProps } from './ResizeHandle';

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

  it('owns media placement and visibility without forwarding caller skins', () => {
    const hostile = {
      className: 'foreign',
      style: { color: 'red' },
      'data-geul-resize-visibility': 'always',
    } as unknown as ResizeHandleProps;
    const html = renderToStaticMarkup(
      <ResizeHandle
        {...hostile}
        direction="left"
        value={64}
        min={10}
        max={100}
        ariaLabel="Resize"
        placement="media-edge"
        visibility="on-interaction"
      />,
    );
    expect(html).toContain('data-geul-resize-placement="media-edge"');
    expect(html).toContain('data-geul-resize-visibility="on-interaction"');
    expect(html).not.toContain('foreign');
    expect(html).not.toContain('style=');
  });

  it('rejects unregistered visibility at the runtime boundary', () => {
    expect(() =>
      renderToStaticMarkup(
        <ResizeHandle
          {...({
            direction: 'left',
            value: 64,
            min: 10,
            max: 100,
            ariaLabel: 'Resize',
            visibility: 'never',
          } as unknown as ResizeHandleProps)}
        />,
      ),
    ).toThrow(RangeError);
  });
});
