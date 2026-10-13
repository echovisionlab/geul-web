// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox';
import { InputSizeProvider } from './InputParts';
import { NumberInput } from './NumberInput';
import { Select } from './Select';
import { Switch } from './Switch';
import { TextInput } from './TextInput';

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
function render(node: ReactNode) {
  act(() => root.render(<I18nProvider locale="en-US">{node}</I18nProvider>));
}
function sizes() {
  return [...host.querySelectorAll('[data-geul-input-size]')].map((node) => node.getAttribute('data-geul-input-size'));
}

describe('InputSizeProvider', () => {
  it('gives every Core input in the region one size', () => {
    render(
      <InputSizeProvider size="xs">
        <TextInput label="Title" />
        <NumberInput label="Columns" />
        <Select label="Sort" data={[{ value: 'a', label: 'A' }]} />
        <Switch label="Loop" />
        <Checkbox label="Indicators" />
      </InputSizeProvider>,
    );
    expect(sizes()).toHaveLength(5);
    expect(new Set(sizes())).toEqual(new Set(['xs']));
  });

  it('lets an explicit size win and leaves inputs outside the region at the default', () => {
    render(
      <>
        <InputSizeProvider size="xs">
          <TextInput label="Explicit" size="md" />
        </InputSizeProvider>
        <TextInput label="Outside" />
      </>,
    );
    expect(sizes()).toEqual(['md', 'sm']);
  });
});
