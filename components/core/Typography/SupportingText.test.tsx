// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SupportingText, type SupportingTextProps } from './SupportingText';

describe('supporting typography role', () => {
  it('owns xs regular typography while retaining native status meaning', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <SupportingText as="p" tone="positive" role="status" aria-live="polite">
        Saved
      </SupportingText>,
    );
    const message = host.querySelector('p')!;
    expect(message.dataset.size).toBe('xs');
    expect(message.dataset.weight).toBe('regular');
    expect(message.dataset.tone).toBe('positive');
    expect(message.getAttribute('role')).toBe('status');
    expect(message.getAttribute('aria-live')).toBe('polite');
  });
  it('projects the shared scale even if untyped data requests a visual override', () => {
    const html = renderToStaticMarkup(
      <SupportingText
        {...({
          size: 'lg',
          weight: 'strong',
          className: 'escape',
          style: { fontSize: 36 },
        } as unknown as SupportingTextProps)}
      >
        No results
      </SupportingText>,
    );
    expect(html).toContain('data-size="xs"');
    expect(html).toContain('data-weight="regular"');
    expect(html).not.toContain('escape');
    expect(html).not.toContain('font-size');
  });
});
