// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Collection, CollectionMedia, type CollectionProps, type CollectionMediaProps } from './Collection';
import { getCollectionMetrics } from './collection-contract';

function host(node: React.ReactNode) {
  const result = document.createElement('div');
  result.innerHTML = renderToStaticMarkup(node);
  return result;
}
describe('Collection contract', () => {
  it('rejects unsupported scales and keeps public presentation escapes out of runtime markup', () => {
    expect(() => getCollectionMetrics('xl' as 'm')).toThrow(RangeError);
    const escape = {
      size: 's',
      style: { color: 'red' },
      className: 'override',
      'data-core-collection-size': 'l',
      'aria-label': 'Releases',
    } as unknown as CollectionProps;
    const element = host(<Collection {...escape} />).firstElementChild!;
    expect(element.getAttribute('data-core-collection-size')).toBe('s');
    expect(element.getAttribute('style')).toBeNull();
    expect(element.className).not.toContain('override');
    expect(element.getAttribute('aria-label')).toBe('Releases');
  });
  it('keeps media overrides closed while preserving authored ratios and SVG backdrop semantics', () => {
    const escape = {
      aspectRatio: '4:3',
      width: 'thumbnail',
      backdrop: 'transparent',
      style: { width: 999 },
      className: 'override',
    } as unknown as CollectionMediaProps;
    const element = host(<CollectionMedia {...escape} />).firstElementChild as HTMLElement;
    expect(element.style.aspectRatio).toBe('4 / 3');
    expect(element.style.width).toBe('');
    expect(element.className).not.toContain('override');
    expect(element.dataset.width).toBe('thumbnail');
    expect(element.dataset.backdrop).toBe('transparent');
  });
});
