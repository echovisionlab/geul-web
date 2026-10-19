// @vitest-environment jsdom

import { DesignSystemTestProvider as DesignSystemProvider } from '@/test/TestProviders';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

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
        <DesignSystemProvider forceColorScheme="light">
          <McpIntegrationSettingsView
            endpoint="https://site.example/mcp"
            setupGuideUrl="https://site.example/guides/remote-mcp.md"
            labels={{
              title: 'Remote MCP',
              endpoint: 'Endpoint',
              openGuide: 'Open setup guide',
            }}
          />
        </DesignSystemProvider>,
      );
    });

    expect(document.body.textContent).toContain('Remote MCP');
    expect(document.body.textContent).toContain('OAuth 2.1');
    expect(document.body.textContent).toContain('https://site.example/mcp');
    const endpoint = container.querySelector('[role="definition"]')!;
    expect(endpoint).toHaveAccessibleName('Endpoint');
    expect(endpoint).toHaveTextContent('https://site.example/mcp');
    const term = document.getElementById(endpoint.getAttribute('aria-labelledby')!)!;
    expect(term).toHaveAttribute('role', 'term');
    expect(term).toHaveTextContent('Endpoint');
    expect(term.firstElementChild?.tagName).toBe('SPAN');
    expect(term.firstElementChild).not.toHaveAttribute('aria-hidden');
    expect(document.body.textContent).not.toContain('Bearer');
    expect(document.querySelector('button')).toBeNull();
    expect(document.querySelector('a')?.getAttribute('href')).toBe('https://site.example/guides/remote-mcp.md');
  });
});
