import { describe, expect, it } from 'vitest';
import { parseMermaidProps } from './schema';

describe('parseMermaidProps', () => {
  it.each([undefined, null, {}])('applies empty source and title to stored props %j', (props) => {
    expect(parseMermaidProps(props)).toEqual({ source: '', title: '' });
  });

  it('keeps diagram source up to the 100,000 character contract limit', () => {
    const source = 'x'.repeat(100_000);
    expect(parseMermaidProps({ source }).source).toBe(source);
  });

  it('rejects diagram source beyond the contract limit', () => {
    expect(() => parseMermaidProps({ source: 'x'.repeat(100_001) })).toThrow();
  });

  it('rejects a non-string stored title', () => {
    expect(() => parseMermaidProps({ title: 3 })).toThrow();
  });
});
