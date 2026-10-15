// @vitest-environment jsdom

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import '@testing-library/jest-dom/vitest';
import { act, createRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenu } from '../DropdownMenu';
import { TextButton } from './TextButton';

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
  vi.restoreAllMocks();
});

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

function render(node: ReactNode) {
  act(() => root.render(node));
}

describe('TextButton', () => {
  it('retains descriptive copy through a hidden relation when React Aria filters aria-description', () => {
    render(
      <>
        <span id="control-help" hidden>
          Opens preferences
        </span>
        <TextButton aria-description="Cookie settings" aria-describedby="control-help">
          Settings
        </TextButton>
      </>,
    );
    const button = container.querySelector('button')!;
    expect(button).toHaveAccessibleName('Settings');
    expect(button).toHaveAccessibleDescription('Opens preferences Cookie settings');
    expect(button.querySelector('[hidden]')?.textContent).toBe('Cookie settings');
  });
  it('uses the same description contract for links without renaming their visible text', () => {
    render(
      <TextButton href="/terms" aria-description="Current terms">
        Terms
      </TextButton>,
    );
    const link = container.querySelector('a')!;
    expect(link).toHaveAccessibleName('Terms');
    expect(link).toHaveAccessibleDescription('Current terms');
    expect(link.querySelectorAll('[hidden]')).toHaveLength(1);
  });

  it('renders a native button with semantic visual data and forwarded props', () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();

    render(
      <TextButton
        ref={ref}
        onClick={onClick}
        appearance="muted"
        size="xs"
        controlSize="xs"
        weight="semibold"
        display="flex"
        fullWidth
        nowrap
        aria-label="Open cookie settings"
        data-consumer="footer"
      >
        Cookie settings
      </TextButton>,
    );

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button).toBe(ref.current);
    expect(button?.type).toBe('button');
    expect(button?.getAttribute('data-control-kind')).toBe('text');
    expect(button?.getAttribute('aria-label')).toBe('Open cookie settings');
    expect(button?.getAttribute('data-consumer')).toBe('footer');
    expect(button?.getAttribute('data-appearance')).toBe('muted');
    expect(button?.getAttribute('data-size')).toBe('xs');
    expect(button?.getAttribute('data-control-size')).toBe('xs');
    expect(button?.getAttribute('data-weight')).toBe('semibold');
    expect(button?.getAttribute('data-display')).toBe('flex');
    expect(button?.getAttribute('data-full-width')).toBe('true');
    expect(button?.getAttribute('data-nowrap')).toBe('true');

    act(() => button?.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('preserves native button type and disabled behavior', () => {
    const onClick = vi.fn();

    render(
      <TextButton type="submit" appearance="accent" disabled onClick={onClick}>
        Submit
      </TextButton>,
    );

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button?.type).toBe('submit');
    expect(button?.disabled).toBe(true);

    act(() => button?.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('retains text typography and explicit control sizing without changing the native role', () => {
    render(
      <TextButton size="xs" display="block">
        Download file
      </TextButton>,
    );
    const button = container.querySelector('button');
    expect(button?.hasAttribute('data-control-size')).toBe(false);
    expect(button?.getAttribute('data-weight')).toBe('regular');
    render(<TextButton controlSize="sm">Open settings</TextButton>);
    expect(container.querySelector('button')?.getAttribute('data-weight')).toBe('medium');
  });

  it('renders href actions through an accessible anchor and forwards anchor props and refs', () => {
    const ref = createRef<HTMLAnchorElement>();

    render(
      <TextButton
        ref={ref}
        href="/about"
        prefetch={false}
        target="_blank"
        rel="noopener"
        download="about.txt"
        aria-current="page"
        appearance="accent"
      >
        About
      </TextButton>,
    );

    const link = container.querySelector<HTMLAnchorElement>('a');
    expect(link).toBe(ref.current);
    expect(link?.getAttribute('href')).toBe('/about');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener');
    expect(link?.getAttribute('download')).toBe('about.txt');
    expect(link?.getAttribute('aria-current')).toBe('page');
    expect(link?.getAttribute('data-appearance')).toBe('accent');
  });

  it('preserves external href values for native browser navigation', () => {
    render(
      <TextButton href="https://example.com/docs" target="_blank" rel="noopener noreferrer">
        Documentation
      </TextButton>,
    );

    const link = container.querySelector<HTMLAnchorElement>('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/docs');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('runs navigation callbacks for an internal route and leaves external links native', () => {
    const onNavigate = vi.fn();
    render(
      <TextButton href="/privacy" onNavigate={onNavigate}>
        Privacy
      </TextButton>,
    );
    act(() => container.querySelector('a')?.click());
    expect(onNavigate).toHaveBeenCalledWith('/privacy');
  });

  it('distinguishes current navigation, toggle state, and selected visual ancestry', () => {
    render(
      <TextButton href="#current" selected aria-current="page">
        Current
      </TextButton>,
    );
    const link = container.querySelector('a')!;
    expect(link).toHaveAttribute('data-selected', 'true');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.hasAttribute('aria-pressed')).toBe(false);
    render(
      <TextButton selected aria-haspopup="menu" aria-expanded={false}>
        Section
      </TextButton>,
    );
    const menu = container.querySelector('button')!;
    expect(menu.hasAttribute('aria-pressed')).toBe(false);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    render(<TextButton aria-pressed>Bold</TextButton>);
    expect(container.querySelector('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not turn a real navigation link into a Space-activated command', () => {
    const onNavigate = vi.fn();
    render(
      <TextButton href="#target" onNavigate={onNavigate}>
        Target
      </TextButton>,
    );
    const link = container.querySelector('a')!;
    act(() => {
      link.focus();
      link.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      link.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
    });
    expect(onNavigate).not.toHaveBeenCalled();
    act(() => link.click());
    expect(onNavigate).toHaveBeenCalledWith('#target');
  });

  it.each([false, true])('retains a long menu name and trigger semantics with nowrap=%s', (nowrap) => {
    const name = 'Language and regional formatting preferences';
    render(
      <DesignSystemProvider>
        <DropdownMenu portal={false}>
          <DropdownMenu.Target>
            <TextButton indicator="menu" fullWidth display="flex" nowrap={nowrap}>
              {name}
            </TextButton>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item>English</DropdownMenu.Item>
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      </DesignSystemProvider>,
    );
    const button = container.querySelector('button')!;
    expect(button).toHaveAccessibleName(name);
    expect(button.hasAttribute('data-nowrap')).toBe(nowrap);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    act(() => button.click());
    expect(button).toHaveAccessibleName(name);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    const glyph = button.querySelector('svg')!;
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(button.firstElementChild?.textContent).toBe(name);
  });

  it('accepts ref and interaction props injected by DropdownMenu.Target', () => {
    const ref = createRef<HTMLButtonElement>();

    render(
      <DesignSystemProvider>
        <DropdownMenu portal={false}>
          <DropdownMenu.Target>
            <TextButton ref={ref} appearance="muted">
              Language
            </TextButton>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item>English</DropdownMenu.Item>
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      </DesignSystemProvider>,
    );

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button).toBe(ref.current);
    expect(['true', 'menu']).toContain(button?.getAttribute('aria-haspopup'));
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    act(() => button?.click());

    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
  });
  it('forwards accepted native advisory text on actions and links', () => {
    render(
      <>
        <TextButton title="Opens preferences">Settings</TextButton>
        <TextButton href="/help" title="Opens help">
          Help
        </TextButton>
      </>,
    );
    expect(container.querySelector('button')!.title).toBe('Opens preferences');
    expect(container.querySelector('a')!.title).toBe('Opens help');
  });
});
