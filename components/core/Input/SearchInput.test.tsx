// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchInput } from './SearchInput';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
function render(node: ReactNode) {
  act(() => root.render(<I18nProvider locale="en-US">{node}</I18nProvider>));
}

describe('Core SearchInput', () => {
  it('exposes native search semantics with the Core leading glyph', () => {
    const onChange = vi.fn();
    render(<SearchInput aria-label="Search users" placeholder="Search users" value="" onChange={onChange} />);
    const input = container.querySelector('input')!;
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('inputmode', 'search');
    expect(input).toHaveAccessibleName('Search users');
    expect(container.querySelector('[data-search-glyph] svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
