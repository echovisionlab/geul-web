// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiSelect, type MultiSelectProps } from './MultiSelect';
const values = ['Ambient', 'Field recording', 'Installation'];
let container: HTMLDivElement;
let root: Root;
let width: number;
const rect = (width: number) =>
  ({ width, height: 22, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 22, toJSON: () => ({}) }) as DOMRect;
beforeEach(() => {
  width = 420;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.hasAttribute('data-core-multiselect-values')) {
      return rect(width);
    }
    if (this.hasAttribute('data-core-multiselect-summary-measure')) {
      return rect(34);
    }
    if (this.hasAttribute('data-core-multiselect-selected-pill')) {
      return rect([72, 112, 96][Number(this.getAttribute('data-core-multiselect-selected-pill-index'))] ?? 0);
    }
    if (this instanceof HTMLInputElement && this.dataset.type === 'visible') {
      return rect(100);
    }
    return rect(0);
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function render(props: Partial<MultiSelectProps> = {}) {
  act(() =>
    root.render(
      <MultiSelect
        aria-label="Tags"
        data={values}
        defaultValue={values}
        searchable
        collapseSelectedValuesToOneLine
        {...props}
      />,
    ),
  );
}
const pills = () => Array.from(container.querySelectorAll<HTMLElement>('[data-core-multiselect-visible-pill]'));
describe('MultiSelect React Aria selected-value contract', () => {
  it('keeps an empty selected-tag collection out of the keyboard focus order', () => {
    render({ defaultValue: [] });
    const collection = container.querySelector('[data-core-multiselect-values] [role="group"]') as HTMLElement;
    expect(collection).toBeNull();
    expect(container.querySelector('input[role="combobox"]')).not.toBeNull();
    render({ value: ['Ambient'] });
    expect(container.querySelector('[data-core-multiselect-visible-pill]')).not.toBeNull();
  });

  it('preserves selected-value descriptions together with external field help and errors', () => {
    act(() =>
      root.render(
        <>
          <span id="audience-help" hidden>
            Downloads for registered members
          </span>
          <span id="audience-error" role="alert">
            Saving failed. Try again.
          </span>
          <MultiSelect
            label="Download audience"
            id="audience"
            data={values}
            defaultValue={[values[0]]}
            aria-describedby="audience-help audience-error"
          />
        </>,
      ),
    );
    const input = container.querySelector('input')!;
    expect(input.id).toBe('audience');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Ambient'));
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Downloads for registered members'));
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Saving failed. Try again.'));
    for (const id of input.getAttribute('aria-describedby')!.split(/\s+/)) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('collapses values that do not fit into a non-removable summary', () => {
    width = 290;
    render();
    expect(pills()).toHaveLength(1);
    expect(pills()[0].textContent).toContain('Ambient');
    const summary = container.querySelector('[data-core-multiselect-summary]');
    expect(summary?.textContent).toBe('+2');
    expect(summary?.querySelector('button')).toBeNull();
  });
  it('makes selected-tag controls inert while React Aria hides them behind the open popup', () => {
    render({ dropdownOpened: true });
    const value = pills()[0].closest('[inert]');
    expect(value).not.toBeNull();
    expect(value?.textContent).toContain('Ambient');
    expect(container.querySelector('input[role="combobox"]')?.closest('[inert]')).toBeNull();
    render({ dropdownOpened: false });
    expect(pills()[0].closest('[inert]')).toBeNull();
  });
  it('restores every value while the dropdown is open', () => {
    width = 290;
    render();
    expect(pills()).toHaveLength(1);
    render({ dropdownOpened: true });
    expect(pills()).toHaveLength(3);
    render({ dropdownOpened: false });
    expect(pills()).toHaveLength(1);
  });
  it('removes values through React Aria tag buttons', () => {
    const onChange = vi.fn();
    render({ onChange, collapseSelectedValuesToOneLine: false });
    const remove = pills()[0].querySelector('button');
    act(() => remove?.click());
    expect(onChange).toHaveBeenLastCalledWith(values.slice(1));
  });
  it('preserves Alt+Arrow reorder behavior without a consumer-supplied pill skin', () => {
    width = 290;
    const onChange = vi.fn();
    render({ withPillsReorder: true, onChange });
    act(() =>
      pills()[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight', altKey: true })),
    );
    expect(onChange).toHaveBeenLastCalledWith(['Field recording', 'Ambient', 'Installation']);
    expect(pills()[0].textContent).toContain('Field recording');
    expect(pills()).toHaveLength(1);
  });
  it('blocks changes and remove buttons for a read-only input', () => {
    const onChange = vi.fn();
    render({ readOnly: true, withPillsReorder: true, onChange });
    expect(pills()[0].querySelector('button')).toBeNull();
    act(() =>
      pills()[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight', altKey: true })),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the controlled search value before removing a pill with Backspace', () => {
    const onChange = vi.fn();
    render({ searchValue: 'Field', onChange });
    const input = container.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace' })));
    expect(onChange).not.toHaveBeenCalled();

    render({ searchValue: '', onChange });
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace' })));
    expect(onChange).toHaveBeenLastCalledWith(values.slice(0, -1));
  });
});
