// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NativeRange } from './NativeRange';
import { applyNativeRange } from './native-range';

describe('Core native slider semantics', () => {
  it('announces a named step and removes obsolete text when returning to numeric values', () => {
    const range = document.createElement('input');
    applyNativeRange(range, { label: 'Columns', min: 0, max: 12, value: 0, valueText: 'Automatic' });
    expect(range.type).toBe('range');
    expect(range.getAttribute('aria-label')).toBe('Columns');
    expect(range.getAttribute('aria-valuetext')).toBe('Automatic');
    applyNativeRange(range, { label: 'Columns', min: 0, max: 12, value: 6 });
    expect(range.value).toBe('6');
    expect(range.hasAttribute('aria-valuetext')).toBe(false);
  });
  it('provides its accessible value before hydration and rejects invalid bounds', () => {
    const html = renderToStaticMarkup(
      <NativeRange label="Icon size" min={0} max={2} value={1} valueText="Medium, 32 px" onChange={() => {}} />,
    );
    expect(html).toContain('aria-valuetext="Medium, 32 px"');
    expect(html).toContain('type="range"');
    expect(() => applyNativeRange(document.createElement('input'), { label: 'Bad', min: 4, max: 2, value: 3 })).toThrow(
      RangeError,
    );
  });
});
