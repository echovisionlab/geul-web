// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { IconButton } from './IconButton';
import classes from './IconButton.module.css';

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

function renderIconButton(node: React.ReactNode): HTMLButtonElement {
  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });

  const button = container?.querySelector('button');
  if (!button) {
    throw new Error('Expected IconButton to render a button element.');
  }
  return button;
}

describe('IconButton', () => {
  it('renders an accessible icon button', () => {
    const button = renderIconButton(<IconButton label="Edit">E</IconButton>);

    expect(button.getAttribute('aria-label')).toBe('Edit');
  });

  it('uses low-emphasis neutral treatment by default', () => {
    const button = renderIconButton(<IconButton label="Edit">E</IconButton>);

    expect(button.getAttribute('data-variant')).toBe('subtle');
    expect(button.getAttribute('data-tone')).toBe('neutral');
    expect(button.getAttribute('data-emphasis')).toBe('low');
  });

  it('maps semantic danger tone without exposing raw colors', () => {
    const button = renderIconButton(
      <IconButton label="Delete" tone="danger">
        D
      </IconButton>,
    );

    expect(button.getAttribute('data-tone')).toBe('danger');
  });

  it('preserves aria-labelledby when the label is external', () => {
    const button = renderIconButton(<IconButton aria-labelledby="external-icon-button-label">E</IconButton>);

    expect(button.getAttribute('aria-labelledby')).toBe('external-icon-button-label');
    expect(button.hasAttribute('aria-label')).toBe(false);
  });

  it('preserves disabled state', () => {
    const button = renderIconButton(
      <IconButton label="Disabled edit" disabled>
        E
      </IconButton>,
    );

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('data-emphasis')).toBe('low');
    expect(button.classList.contains(classes.root)).toBe(true);
  });

  it('applies the same Core low-emphasis disabled treatment to semantic tones', () => {
    const button = renderIconButton(
      <IconButton label="Disabled delete" tone="danger" emphasis="low" disabled>
        D
      </IconButton>,
    );

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('data-tone')).toBe('danger');
    expect(button.getAttribute('data-emphasis')).toBe('low');
    expect(button.classList.contains(classes.root)).toBe(true);
  });
});
