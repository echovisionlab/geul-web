// @vitest-environment jsdom

import { act, lazy, Suspense, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortaDJTool } from './PortaDJTool';

const mocks = vi.hoisted(() => ({
  options: null as { ssr: boolean } | null,
  imports: 0,
  mounts: 0,
  unmounts: 0,
}));

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<(typeof import('@dsub/portadj/react'))['PortaDJ']>, options: { ssr: boolean }) => {
    mocks.options = options;
    return lazy(async () => ({ default: await loader() }));
  },
}));

vi.mock('@dsub/portadj/react', () => {
  mocks.imports += 1;
  return {
    PortaDJ: ({ theme }: { theme: 'light' | 'dark' }) => {
      useEffect(() => {
        mocks.mounts += 1;
        return () => {
          mocks.unmounts += 1;
        };
      }, []);
      return <div data-portadj-player data-theme={theme} />;
    },
  };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mocks.mounts = 0;
  mocks.unmounts = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('PortaDJTool', () => {
  it('loads the browser player and changes theme without remounting it', async () => {
    expect(mocks.options).toEqual({ ssr: false });
    expect(mocks.imports).toBe(0);

    await renderTheme('light');
    const player = container.querySelector('[data-portadj-player]');
    expect(player?.getAttribute('data-theme')).toBe('light');
    expect(mocks.mounts).toBe(1);
    expect(mocks.imports).toBe(1);

    await renderTheme('dark');
    expect(container.querySelector('[data-portadj-player]')).toBe(player);
    expect(player?.getAttribute('data-theme')).toBe('dark');
    expect(mocks.mounts).toBe(1);
    expect(mocks.unmounts).toBe(0);
  });
});

async function renderTheme(theme: 'light' | 'dark') {
  await act(async () => {
    root.render(
      <MantineProvider forceColorScheme={theme}>
        <Suspense>
          <PortaDJTool />
        </Suspense>
      </MantineProvider>,
    );
  });
}
