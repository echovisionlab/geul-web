// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { Button } from './Button';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

function renderButton(node: React.ReactNode): HTMLButtonElement {
  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });

  const button = container?.querySelector('button');
  if (!button) {
    throw new Error('Expected Button to render a button element.');
  }
  return button;
}

describe('Button', () => {
  it('renders an accessible button with the provided label', () => {
    const button = renderButton(<Button>Save</Button>);

    expect(button.textContent).toBe('Save');
  });

  it('maps neutral medium emphasis to the default visual variant', () => {
    const button = renderButton(
      <Button tone="neutral" emphasis="medium">
        Secondary
      </Button>,
    );

    expect(button.getAttribute('data-variant')).toBe('default');
  });

  it('maps danger controls to the filled red treatment', () => {
    const button = renderButton(<Button tone="danger">Delete</Button>);

    expect(button.getAttribute('data-variant')).toBe('filled');
    expect(button.getAttribute('data-tone')).toBe('danger');
  });

  it('preserves disabled state', () => {
    const button = renderButton(<Button disabled>Disabled</Button>);

    expect(button.disabled).toBe(true);
  });

  it('marks loading state', () => {
    const button = renderButton(<Button loading>Saving</Button>);

    expect(button.getAttribute('data-loading')).toBe('true');
  });
});
