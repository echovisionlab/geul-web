// @vitest-environment jsdom

import { mockBrowserNavigation } from '../testing/browser-navigation';
import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import '@testing-library/jest-dom/vitest';
import { act, createRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DropdownMenu } from '../DropdownMenu';
import { TextButton } from './TextButton';

const browserNavigation = mockBrowserNavigation();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  browserNavigation.attach(container);
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
