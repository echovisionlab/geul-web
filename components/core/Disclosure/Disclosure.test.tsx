// @vitest-environment jsdom

import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { Disclosure, DisclosureRegion } from './Disclosure';

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

function renderDisclosure(node: ReactNode) {
  act(() => {
    root.render(<I18nProvider locale="en-US">{node}</I18nProvider>);
  });
}

describe('Disclosure', () => {
  it('owns accessible open state and emits semantic boolean changes', () => {
    const onChange = vi.fn();

    function Example() {
      const [opened, setOpened] = useState(false);

      return (
        <Disclosure
          label="Details"
          opened={opened}
          onChange={(nextOpened) => {
            setOpened(nextOpened);
            onChange(nextOpened);
          }}
        >
          Additional details
        </Disclosure>
      );
    }

    renderDisclosure(<Example />);

    const trigger = container.querySelector<HTMLButtonElement>('button[data-accordion-control]');
    const panelId = trigger?.getAttribute('aria-controls');

    expect(trigger?.type).toBe('button');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(panelId).toBeTruthy();
    expect(container.querySelector(`#${panelId}`)?.getAttribute('aria-labelledby')).toBe(trigger?.id);

    act(() => trigger?.click());

    expect(onChange).toHaveBeenCalledWith(true);
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Additional details');
  });

  it('does not change state when disabled', () => {
    const onChange = vi.fn();
    renderDisclosure(
      <Disclosure label="Unavailable" disabled onChange={onChange}>
        Hidden content
      </Disclosure>,
    );

    const trigger = container.querySelector<HTMLButtonElement>('button[data-accordion-control]');
    act(() => trigger?.click());

    expect(trigger?.disabled).toBe(true);
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('DisclosureRegion', () => {
  it('keeps form state mounted while hiding a controlled panel and preserves trigger linkage', () => {
    function Example() {
      const [expanded, setExpanded] = useState(true);
      return (
        <>
          <button
            type="button"
            id="region-trigger"
            aria-expanded={expanded}
            aria-controls="region-panel"
            onClick={() => setExpanded(!expanded)}
          >
            Toggle
          </button>
          <DisclosureRegion id="region-panel" labelledBy="region-trigger" expanded={expanded}>
            <input defaultValue="Draft" />
          </DisclosureRegion>
        </>
      );
    }
    renderDisclosure(<Example />);
    const input = container.querySelector('input')!;
    input.value = 'Unsaved draft';
    act(() => container.querySelector('button')!.click());
    const panel = container.querySelector<HTMLElement>('#region-panel')!;
    expect(panel.hidden).toBe(true);
    expect(panel.getAttribute('aria-labelledby')).toBe('region-trigger');
    expect(container.querySelector('input')).toBe(input);
    act(() => container.querySelector('button')!.click());
    expect(panel.hidden).toBe(false);
    expect(input.value).toBe('Unsaved draft');
  });

  it('unmounts only when explicitly requested and projects away untyped style escapes', () => {
    const escaped = {
      style: { background: 'red' },
      className: 'feature-skin',
      'data-geul-disclosure-region': 'overridden',
    };
    renderDisclosure(
      <DisclosureRegion expanded {...(escaped as {})}>
        Safe
      </DisclosureRegion>,
    );
    const panel = container.querySelector('[data-geul-disclosure-region]')!;
    expect(panel.getAttribute('style')).toBeNull();
    expect(panel.className).not.toContain('feature-skin');
    expect(panel.getAttribute('data-geul-disclosure-region')).toBe('true');
    renderDisclosure(
      <DisclosureRegion expanded={false} keepMounted={false}>
        Unmounted
      </DisclosureRegion>,
    );
    expect(container.querySelector('[data-geul-disclosure-region]')).toBeNull();
  });
});
