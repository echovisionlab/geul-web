// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { LocationPlaceMenu } from './LocationPlaceMenu';
import { LocationPlaceMetadataRows } from './LocationPlaceMetadataRows';

vi.mock('@/components/core/DropdownMenu', async () => {
  const React = await import('react');

  const DropdownMenuContext = React.createContext<{
    opened: boolean;
    setOpened: React.Dispatch<React.SetStateAction<boolean>>;
  } | null>(null);

  function MockDropdownMenu({ children }: { children: ReactNode }) {
    const [opened, setOpened] = React.useState(false);

    return <DropdownMenuContext.Provider value={{ opened, setOpened }}>{children}</DropdownMenuContext.Provider>;
  }

  function MockDropdownMenuTarget({ children }: { children: ReactNode }) {
    const context = React.useContext(DropdownMenuContext);
    const child = children as React.ReactElement<{ onClick?: (event: MouseEvent) => void }>;

    return React.cloneElement(child, {
      onClick: (event: MouseEvent) => {
        child.props.onClick?.(event);
        context?.setOpened((opened) => !opened);
      },
    });
  }

  function MockDropdownMenuDropdown({ children }: { children: ReactNode }) {
    const context = React.useContext(DropdownMenuContext);

    if (!context?.opened) {
      return null;
    }

    return <div data-testid="menu-dropdown">{children}</div>;
  }

  function MockDropdownMenuItem({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
    return (
      <button type="button" role="menuitem" onClick={onClick}>
        {children}
      </button>
    );
  }

  function MockDropdownMenuLabel({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  return {
    DropdownMenu: Object.assign(MockDropdownMenu, {
      Target: MockDropdownMenuTarget,
      Dropdown: MockDropdownMenuDropdown,
      Item: MockDropdownMenuItem,
      Label: MockDropdownMenuLabel,
    }),
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

Object.defineProperty(navigator, 'maxTouchPoints', {
  configurable: true,
  value: 0,
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const messages = {
  common: {
    actions: {
      openIn: 'Open in',
    },
    labels: {
      location: 'Location',
      latitude: 'Latitude',
      longitude: 'Longitude',
      coordinates: 'Coordinates',
    },
  },
};

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

function renderLocationPlaceMenu(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickElement(element: Element | null | undefined) {
  expect(element).not.toBeNull();
  expect(element).not.toBeUndefined();

  act(() => {
    element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  await flushUpdates();
}

describe('LocationPlaceMenu', () => {
  it('shows Google and Naver map options and opens the selected provider link', async () => {
    const windowOpen = vi.fn();
    window.open = windowOpen;

    renderLocationPlaceMenu(<LocationPlaceMenu place={{ name: 'Custom Studio', lat: 37.5665, lng: 126.978 }} />);

    await clickElement(document.querySelector('button'));

    expect(document.body.textContent).toContain('Custom Studio');
    expect(document.body.textContent).toContain('Latitude 37.566500');
    expect(document.body.textContent).toContain('Longitude 126.978000');

    expect(document.body.textContent).toContain('Google Maps');
    expect(document.body.textContent).toContain('Naver Maps');

    const googleButton = Array.from(document.querySelectorAll('[role="menuitem"]')).find((button) =>
      button.textContent?.includes('Google Maps'),
    );

    await clickElement(googleButton);

    expect(windowOpen).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=37.5665%2C126.978',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('uses a Google place id when the selected place came from Google Places', async () => {
    const windowOpen = vi.fn();
    window.open = windowOpen;

    renderLocationPlaceMenu(
      <LocationPlaceMenu
        place={{
          name: 'Polarfront Lab',
          lat: 37.539639,
          lng: 126.9904063,
          googlePlaceId: 'google-place-123',
        }}
      />,
    );

    await clickElement(document.querySelector('button'));

    const googleButton = Array.from(document.querySelectorAll('[role="menuitem"]')).find((button) =>
      button.textContent?.includes('Google Maps'),
    );

    await clickElement(googleButton);

    expect(windowOpen).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=Polarfront+Lab&query_place_id=google-place-123',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('uses a multi-line location summary for the trigger aria label', () => {
    renderLocationPlaceMenu(<LocationPlaceMenu place={{ name: 'Custom Studio', lat: 37.5665, lng: 126.978 }} />);

    expect(document.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Open in Custom Studio. Latitude 37.566500. Longitude 126.978000.',
    );
    expect(document.querySelector('button')?.getAttribute('data-appearance')).toBe('default');
    expect(document.querySelector('button')?.classList.contains('mantine-UnstyledButton-root')).toBe(false);
  });

  it('supports a compact name-only trigger for metadata rows', () => {
    renderLocationPlaceMenu(
      <LocationPlaceMenu
        place={{ name: 'Custom Studio', lat: 37.5665, lng: 126.978 }}
        variant="name"
        showIcon={false}
        showChevron={false}
      />,
    );

    expect(document.body.textContent).toContain('Custom Studio');
    expect(document.body.textContent).not.toContain('Latitude 37.566500');
    expect(document.body.textContent).not.toContain('Longitude 126.978000');
    expect(document.querySelector('button')?.getAttribute('data-hover-accent')).toBe('true');
    expect(document.querySelector('button')?.getAttribute('data-appearance')).toBe('default');
    expect(document.querySelector('button')?.getAttribute('data-display')).toBe('block');
    expect(document.querySelector('button')?.hasAttribute('data-control-size')).toBe(false);
  });
});

describe('LocationPlaceMetadataRows', () => {
  it('renders labeled location, latitude, and longitude rows', () => {
    renderLocationPlaceMenu(
      <LocationPlaceMetadataRows place={{ name: 'Custom Studio', lat: 37.5665, lng: 126.978 }} />,
    );

    expect(document.body.textContent).toContain('Location');
    expect(document.body.textContent).toContain('Custom Studio');
    expect(document.body.textContent).toContain('Latitude');
    expect(document.body.textContent).toContain('37.566500');
    expect(document.body.textContent).toContain('Longitude');
    expect(document.body.textContent).toContain('126.978000');
  });

  it('can omit latitude and longitude rows when coordinates are hidden', () => {
    renderLocationPlaceMenu(
      <LocationPlaceMetadataRows
        place={{ name: 'Custom Studio', lat: 37.5665, lng: 126.978 }}
        coordinateVisibility="never"
      />,
    );

    expect(document.body.textContent).toContain('Location');
    expect(document.body.textContent).toContain('Custom Studio');
    expect(document.body.textContent).not.toContain('Latitude');
    expect(document.body.textContent).not.toContain('Longitude');
  });
});
