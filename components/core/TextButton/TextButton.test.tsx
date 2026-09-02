// @vitest-environment jsdom

import { act, createRef, forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
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
        className="consumer-class"
        style={{ justifyContent: 'center' }}
        aria-label="Open cookie settings"
        data-consumer="footer"
      >
        Cookie settings
      </TextButton>,
    );

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button).toBe(ref.current);
    expect(button?.type).toBe('button');
    expect(button?.classList.contains('consumer-class')).toBe(true);
    expect(button?.style.justifyContent).toBe('center');
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

  it('keeps geometry opt-in and exposes block display with typed CSS variables', () => {
    render(
      <TextButton
        size="xs"
        display="block"
        style={{
          '--text-button-min-height': '0px',
          '--text-button-padding-block': '0px',
          '--text-button-padding-inline': '0px',
          '--text-button-line-height': 1.2,
        }}
      >
        Download file
      </TextButton>,
    );

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button?.hasAttribute('data-control-size')).toBe(false);
    expect(button?.getAttribute('data-display')).toBe('block');
    expect(button?.style.getPropertyValue('--text-button-min-height')).toBe('0px');
    expect(button?.style.getPropertyValue('--text-button-padding-block')).toBe('0px');
    expect(button?.style.getPropertyValue('--text-button-padding-inline')).toBe('0px');
    expect(button?.style.getPropertyValue('--text-button-line-height')).toBe('1.2');
  });

  it('renders href actions through Next Link and forwards anchor props and refs', () => {
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

  it('uses an injected link transport and forwards anchor navigation events', () => {
    const onNavigate = vi.fn();
    const ref = createRef<HTMLAnchorElement>();
    const TestLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(
      ({ href, onClick: handleClick, ...props }, linkRef) => (
        <a
          {...props}
          ref={linkRef}
          href={href}
          data-test-link-transport
          onClick={(event) => {
            event.preventDefault();
            handleClick?.(event);
          }}
        />
      ),
    );

    render(
      <TextButton ref={ref} href="/privacy" linkComponent={TestLink} onNavigate={onNavigate}>
        Privacy
      </TextButton>,
    );

    const link = container.querySelector<HTMLAnchorElement>('a[data-test-link-transport]');
    expect(link).toBe(ref.current);
    expect(link?.getAttribute('href')).toBe('/privacy');

    act(() => link?.click());
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledWith('/privacy');
  });

  it('does not synthesize an event handler for a server-renderable link', () => {
    let receivedOnClick: ComponentPropsWithoutRef<'a'>['onClick'] = vi.fn();
    const TestLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(({ onClick, ...props }, linkRef) => {
      receivedOnClick = onClick;
      return <a {...props} ref={linkRef} />;
    });

    render(
      <TextButton href="/" linkComponent={TestLink}>
        Go home
      </TextButton>,
    );

    expect(receivedOnClick).toBeUndefined();
  });

  it('accepts ref and interaction props injected by DropdownMenu.Target', () => {
    const ref = createRef<HTMLButtonElement>();

    render(
      <MantineProvider env="test">
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
      </MantineProvider>,
    );

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button).toBe(ref.current);
    expect(button?.getAttribute('aria-haspopup')).toBe('menu');
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    act(() => button?.click());

    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
  });
});
