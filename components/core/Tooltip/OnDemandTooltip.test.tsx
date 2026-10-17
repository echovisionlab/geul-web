// @vitest-environment jsdom
// @geul-test-isolate: the on-demand tooltip module keeps its loaded runtime across imports.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IconButton } from '../IconButton';
import { OnDemandTooltip, preloadTooltip } from './OnDemandTooltip';
import { Tooltip, type TooltipProps } from './Tooltip';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function hint(Component: typeof Tooltip | typeof OnDemandTooltip, props: Partial<TooltipProps> = {}) {
  return (
    <I18nProvider locale="en-US">
      <Component label="Search (Ctrl+K)" withinPortal={false} {...props}>
        <IconButton size="chrome" aria-label="Search">
          <span aria-hidden>S</span>
        </IconButton>
      </Component>
    </I18nProvider>
  );
}
const withoutIds = (html: string) => html.replace(/react-aria-_R_[A-Za-z0-9_]+_/g, 'ID');

describe('OnDemandTooltip', () => {
  it('renders the same server markup as Tooltip', () => {
    expect(withoutIds(renderToString(hint(OnDemandTooltip)))).toBe(withoutIds(renderToString(hint(Tooltip))));
  });

  // The surface has not been requested before this test in this file.
  it('shows an open hint once its surface loads and describes the trigger with it', async () => {
    act(() => root.render(hint(OnDemandTooltip, { opened: true })));
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Search"]')!;
    await act(() => preloadTooltip());
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toBe('Search (Ctrl+K)');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip?.id);
  }, 20000);

  it.each([
    ['Tooltip', Tooltip],
    ['OnDemandTooltip', OnDemandTooltip],
  ] as const)('%s is suppressed when disabled and hides when control closes it', (_name, Component) => {
    act(() => root.render(hint(Component, { opened: true, disabled: true })));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    act(() => root.render(hint(Component, { opened: true })));
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
    act(() => root.render(hint(Component, { opened: false })));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });
});
