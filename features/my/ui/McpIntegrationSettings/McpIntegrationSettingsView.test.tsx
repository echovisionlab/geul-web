// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpIntegrationSettingsView } from './McpIntegrationSettingsView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
});

describe('McpIntegrationSettingsView', () => {
  it('shows the canonical Remote MCP endpoint with OAuth as the default connection', () => {
    act(() => {
      root.render(
        <MantineProvider env="test">
          <McpIntegrationSettingsView
            endpoint="https://site.example/mcp"
            setupGuideUrl="https://site.example/guides/remote-mcp.md"
            labels={{
              title: 'Remote MCP',
              description: 'Connect supported AI clients with browser sign-in and consent.',
              endpoint: 'Endpoint',
              openGuide: 'Open setup guide',
            }}
          />
        </MantineProvider>,
      );
    });

    expect(document.body.textContent).toContain('Remote MCP');
    expect(document.body.textContent).toContain('OAuth 2.1');
    expect(document.body.textContent).toContain('browser sign-in and consent');
    expect(document.body.textContent).toContain('https://site.example/mcp');
    expect(document.body.textContent).not.toContain('Bearer');
    expect(document.querySelector('button')).toBeNull();
    expect(document.querySelector('a')?.getAttribute('href')).toBe('https://site.example/guides/remote-mcp.md');
  });
});
