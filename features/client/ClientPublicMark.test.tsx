// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it } from 'vitest';
import { ClientPublicMark, type ClientPublicMarkProps } from './ClientPublicMark';

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

function renderMark(props: ClientPublicMarkProps) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <MantineProvider>
        <ClientPublicMark {...props} />
      </MantineProvider>,
    );
  });
  return host;
}

describe('ClientPublicMark', () => {
  it('uses the client logo itself as the single website link', () => {
    const element = renderMark({
      name: 'Arts Council Korea',
      website: 'https://www.arko.or.kr',
      logoLightUrl: 'https://cdn.example.com/arko.svg',
    });

    const link = element.querySelector<HTMLAnchorElement>('a');
    expect(link?.href).toBe('https://www.arko.or.kr/');
    expect(link?.getAttribute('aria-label')).toBe('Arts Council Korea');
    expect(link?.querySelector('img')?.alt).toBe('Arts Council Korea');
    expect(element.querySelectorAll('a')).toHaveLength(1);
    expect(link?.textContent).toBe('');
  });

  it('uses the client name as the website link only when no logo exists', () => {
    const element = renderMark({ name: 'Text Client', website: 'https://client.example.com' });

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('a')?.textContent).toBe('Text Client');
  });
});
