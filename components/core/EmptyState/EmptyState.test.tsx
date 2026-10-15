// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { IconFolder } from '@tabler/icons-react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmptyState, type EmptyStateProps } from './EmptyState';

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
function render(props: Partial<EmptyStateProps> = {}) {
  act(() => root.render(<EmptyState title="No files" {...props} />));
  return container.querySelector<HTMLElement>('[data-empty-state]')!;
}

describe('Core EmptyState', () => {
  it('orders a decorative glyph, title, description and action', () => {
    const root = render({
      icon: IconFolder,
      description: 'Upload a file to start.',
      action: <button type="button">Upload</button>,
    });
    const glyph = root.querySelector('[data-tone="neutral"][data-size="lg"]');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(root.textContent).toBe('No filesUpload a file to start.Upload');
    expect(root.lastElementChild).toHaveTextContent('Upload');
    expect(root).not.toHaveAttribute('role');
  });

  it('announces politely only when requested and keeps semantic relationships', () => {
    const root = render({ live: true, id: 'empty', 'aria-describedby': 'context', 'data-testid': 'state' });
    expect(root).toHaveAttribute('role', 'status');
    expect(root).toHaveAttribute('id', 'empty');
    expect(root).toHaveAttribute('aria-describedby', 'context');
    expect(root.dataset.testid).toBe('state');
  });

  it('owns the section inset unless an owning surface supplies it', () => {
    render();
    expect(container.firstElementChild).not.toHaveAttribute('data-empty-state');
    render({ inset: 'none' });
    expect(container.firstElementChild).toHaveAttribute('data-empty-state');
  });

  it('rejects unsupported insets', () => {
    expect(() => render({ inset: 'lg' as 'none' })).toThrow('Invalid empty state inset');
  });
});
