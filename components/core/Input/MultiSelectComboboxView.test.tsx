// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiSelectComboboxView, type MultiSelectItem } from './MultiSelectComboboxView';

const ambient = { id: 'ambient', name: 'Ambient' };
const electronic = { id: 'electronic', name: 'Electronic' };
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(canEdit = true) {
  const onCreate = vi.fn();
  function Fixture() {
    const [options, setOptions] = useState<MultiSelectItem[]>([ambient, electronic]);
    const [selected, setSelected] = useState<MultiSelectItem[]>([ambient]);
    return (
      <MultiSelectComboboxView
        label="Genres"
        placeholder="Select genres"
        emptyMessage="No genres available"
        notFoundMessage="No genres found"
        options={options}
        selectedItems={selected}
        onSelect={(item) => setSelected((items) => [...items, item])}
        onDeselect={(item) => setSelected((items) => items.filter((selected) => selected.id !== item.id))}
        onCreate={(name) => {
          onCreate(name);
          const created = { id: `created-${name}`, name };
          setOptions((items) => [...items, created]);
          setSelected((items) => [...items, created]);
        }}
        createOptionLabel={(name) => `Create "${name}"`}
        canEdit={canEdit}
        canCreateNew
        combineWithSelected
      />
    );
  }
  act(() =>
    root.render(
      <I18nProvider locale="en-US">
        <Fixture />
      </I18nProvider>,
    ),
  );
  return onCreate;
}

function search(text: string) {
  const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  act(() => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function choose(label: string) {
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent === label,
  );
  expect(option).toBeDefined();
  act(() => option!.click());
}
const selectedLabels = () =>
  [...host.querySelectorAll('[data-core-multiselect-visible-pill]')].map((el) => el.querySelector('span')?.textContent);

describe('MultiSelectComboboxView editing', () => {
  it('keeps selected labels while searching and adds/removes existing options', () => {
    render();
    search('Electronic');
    expect(selectedLabels()).toEqual(['Ambient']);
    choose('Electronic');
    expect(selectedLabels()).toEqual(['Ambient', 'Electronic']);
    const remove = host.querySelector<HTMLButtonElement>('[data-core-multiselect-visible-pill] button')!;
    act(() => remove.click());
    expect(selectedLabels()).toEqual(['Electronic']);
  });

  it('creates a trimmed option, selects it and keeps its name during a later search', () => {
    const created = render();
    search('  Drone  ');
    choose('Create "  Drone  "');
    expect(created).toHaveBeenCalledExactlyOnceWith('Drone');
    expect(selectedLabels()).toEqual(['Ambient', 'Drone']);
    search('Electronic');
    expect(selectedLabels()).toEqual(['Ambient', 'Drone']);
  });

  it('prevents editing when the view is read-only', () => {
    render(false);
    expect(host.querySelector<HTMLInputElement>('input[role="combobox"]')?.disabled).toBe(true);
    expect(host.querySelector('[data-core-multiselect-visible-pill] button')).toBeNull();
  });
});
