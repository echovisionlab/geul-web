// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import koMessages from '@/messages/ko.json';
import { McpOAuthGrantSettings } from './McpOAuthGrantSettings';

vi.mock('@/lib/providers/LocaleProvider', () => ({ useLocale: () => 'ko' }));
vi.mock('@/features/my/mcp-oauth-grant-actions', () => ({ revokeMyMcpOAuthGrant: vi.fn() }));

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

function render(grants = [{ id: 'grant-1', clientName: 'Codex', connectedAt: '2026-08-28T09:00:00Z' }]) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <MantineProvider env="test">
          <McpOAuthGrantSettings initialGrants={grants} />
        </MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe('McpOAuthGrantSettings', () => {
  it('shows Hydra-owned MCP grants separately from browser sessions', () => {
    render();
    expect(container.textContent).toContain('연결된 MCP 클라이언트');
    expect(container.textContent).toContain('Codex');
    expect(container.textContent).toContain('권한 해제');
  });

  it('shows an explicit empty state', () => {
    render([]);
    expect(container.textContent).toContain('연결된 MCP 클라이언트가 없습니다.');
  });
});
