// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { IconUsers } from '@tabler/icons-react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StatCard, type StatCardProps } from './StatCard';

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
function render(props: Partial<StatCardProps> = {}) {
  act(() =>
    root.render(
      <I18nProvider locale="en-US">
        <StatCard label="Users" value="1,284" icon={IconUsers} {...props} />
      </I18nProvider>,
    ),
  );
}

describe('Core StatCard', () => {
  it('owns the decorative glyph geometry', () => {
    render();
    const glyph = container.querySelector('svg')!;
    expect(glyph).toHaveAttribute('width', '20');
    expect(glyph).toHaveAttribute('stroke-width', '1.5');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('a')).toBeNull();
  });

  it('turns the whole card into one navigation link when href is supplied', () => {
    render({ href: '/admin/users' });
    const link = container.querySelector('a')!;
    expect(link).toHaveAttribute('href', '/admin/users');
    expect(link).toHaveAttribute('data-appearance', 'block');
    expect(link).toHaveTextContent('Users1,284');
  });
});
