// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider, Pill } from '@mantine/core';
import { MultiSelect } from './MultiSelect';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const selectedValues = ['Ambient', 'Field recording', 'Installation'];
const pillWidths = [72, 112, 96];
let pillsListWidth = 420;
let pillMeasurementReads = 0;
let resizeObservers: ResizeObserverMock[] = [];

class ResizeObserverMock {
  readonly callback: ResizeObserverCallback;
  active = true;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObservers.push(this);
  }

  disconnect() {
    this.active = false;
  }
  observe() {}
  unobserve() {}

  trigger() {
    if (this.active) {
      this.callback([], this as unknown as ResizeObserver);
    }
  }
}

function rect(width: number): DOMRect {
  return {
    bottom: 0,
    height: 22,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  pillsListWidth = 420;
  pillMeasurementReads = 0;
  resizeObservers = [];
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.hasAttribute('data-core-multiselect-summary-measure')) {
      return rect(34);
    }

    if (this.hasAttribute('data-core-multiselect-summary')) {
      return rect(34);
    }

    if (this.hasAttribute('data-core-multiselect-selected-pill')) {
      pillMeasurementReads += 1;
      const index = Number(this.getAttribute('data-core-multiselect-selected-pill-index'));
      return rect(pillWidths[index] ?? 0);
    }

    if (this instanceof HTMLInputElement && this.dataset.type === 'visible') {
      return rect(100);
    }

    if (this instanceof HTMLElement && this.querySelector(':scope > input[data-type]')) {
      return rect(pillsListWidth);
    }

    return rect(0);
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function renderMultiSelect(data: MantineMultiSelectData = selectedValues) {
  act(() => {
    root.render(
      <MantineProvider>
        <MultiSelect
          aria-label="Tags"
          collapseSelectedValuesToOneLine
          data={data}
          defaultValue={selectedValues}
          searchable
        />
      </MantineProvider>,
    );
  });
}

type MantineMultiSelectData = NonNullable<ComponentProps<typeof MultiSelect>['data']>;

function selectedPills() {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-core-multiselect-selected-pill]'));
}

describe('MultiSelect collapsed selected values', () => {
  it('keeps every selected pill when the values fit on one line', () => {
    renderMultiSelect();

    expect(selectedPills()).toHaveLength(3);
    expect(container.querySelector('[data-core-multiselect-summary]')).toBeNull();
  });

  it('renders leading pills and a +N summary when selected values overflow', () => {
    pillsListWidth = 290;
    renderMultiSelect();

    expect(selectedPills()).toHaveLength(1);
    expect(selectedPills()[0]?.textContent).toContain('Ambient');
    expect(container.querySelector('[data-core-multiselect-summary]')?.textContent).toContain('+2');
    expect(container.querySelector('[data-core-multiselect-summary] [aria-label]')?.getAttribute('aria-label')).toBe(
      '2 more selected values',
    );
  });

  it('shows all values while searchable and recalculates after blur closes the dropdown', () => {
    pillsListWidth = 290;
    renderMultiSelect();
    expect(selectedPills()).toHaveLength(1);

    const input = container.querySelector<HTMLInputElement>('input[data-type]');
    expect(input).not.toBeNull();
    act(() => {
      input?.focus();
    });

    expect(selectedPills()).toHaveLength(3);
    expect(container.querySelector('[data-core-multiselect-summary]')).toBeNull();

    pillsListWidth = 320;
    act(() => {
      input?.blur();
    });
    expect(selectedPills()).toHaveLength(2);
    expect(container.querySelector('[data-core-multiselect-summary]')?.textContent).toContain('+1');

    pillsListWidth = 420;
    act(() => {
      resizeObservers.forEach((observer) => observer.trigger());
    });

    expect(selectedPills()).toHaveLength(3);
    expect(container.querySelector('[data-core-multiselect-summary]')).toBeNull();
  });

  it('does not remeasure when a parent recreates semantically identical data', () => {
    pillsListWidth = 290;
    const makeData = () => selectedValues.map((item) => ({ label: item, value: item }));

    renderMultiSelect(makeData());
    expect(selectedPills()).toHaveLength(1);
    const readsAfterInitialMeasure = pillMeasurementReads;

    renderMultiSelect(makeData());
    expect(selectedPills()).toHaveLength(1);
    expect(pillMeasurementReads).toBe(readsAfterInitialMeasure);

    renderMultiSelect([
      { label: 'Long ambient recording label', value: 'Ambient' },
      { label: 'Field recording', value: 'Field recording' },
      { label: 'Installation', value: 'Installation' },
    ]);
    expect(pillMeasurementReads).toBeGreaterThan(readsAfterInitialMeasure);
  });

  it('keeps one reorder target and supports keyboard reordering with a custom pill in closed overflow', () => {
    pillsListWidth = 290;
    const onChange = vi.fn();
    act(() => {
      root.render(
        <MantineProvider>
          <MultiSelect
            aria-label="Tags"
            collapseSelectedValuesToOneLine
            data={selectedValues}
            defaultValue={selectedValues}
            onChange={onChange}
            renderPill={(pillProps) => <Pill {...pillProps.reorderProps}>{pillProps.option.label}</Pill>}
            searchable
            withPillsReorder
          />
        </MantineProvider>,
      );
    });

    expect(selectedPills()).toHaveLength(1);
    expect(container.querySelectorAll('[data-mantine-pill-index]')).toHaveLength(1);
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(1);

    const firstPill = selectedPills()[0];
    act(() => {
      firstPill?.focus();
      firstPill?.dispatchEvent(
        new KeyboardEvent('keydown', {
          altKey: true,
          bubbles: true,
          key: 'ArrowRight',
        }),
      );
    });

    expect(onChange).toHaveBeenLastCalledWith(['Field recording', 'Ambient', 'Installation']);
    expect(selectedPills()).toHaveLength(1);
    expect(selectedPills()[0]?.textContent).toContain('Field recording');
    expect(container.querySelectorAll('[data-mantine-pill-index]')).toHaveLength(1);
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-mantine-pill-index]')?.getAttribute('data-mantine-pill-index')).toBe('0');
  });
});
