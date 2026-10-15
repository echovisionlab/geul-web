// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { expect, it } from 'vitest';
import { SegmentedProgress } from './SegmentedProgress';
it('normalizes overflows and invalid values with matching visible and accessible percentages', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <I18nProvider locale="en">
          <SegmentedProgress
            label="Delivery status"
            segments={[
              { id: 'a', value: 120, label: 'Delivered', tone: 'positive' },
              { id: 'b', value: 80, label: 'Waiting' },
              { id: 'invalid', value: NaN, label: 'Invalid' },
            ]}
          />
        </I18nProvider>,
      ),
    );
    const progress = host.querySelector('[role="progressbar"]')!;
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(progress.getAttribute('aria-valuetext')).toContain('Delivered: 60%');
    const segment = host.querySelector<HTMLElement>('[data-tone="positive"]')!;
    expect(segment.style.width).toBe('60%');
    expect(segment.textContent).toBe('60%');
    expect(segment.tabIndex).toBe(0);
    expect(segment.getAttribute('aria-label')).toBe('Delivered: 60%');
    expect(host.querySelectorAll('[tabindex="0"]')).toHaveLength(2);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
