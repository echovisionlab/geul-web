// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import koMessages from '@/messages/ko.json';
import { McpOAuthGrantSettings } from './McpOAuthGrantSettings';
import { revokeMyMcpOAuthGrant } from './mcp-oauth-grant-actions';

vi.mock('@/lib/providers/LocaleProvider', () => ({ useLocale: () => 'ko' }));
vi.mock('@/features/my/mcp-oauth-grant-actions', () => ({ revokeMyMcpOAuthGrant: vi.fn() }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
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

function openConfirmation() {
  act(() => {
    container.querySelector<HTMLButtonElement>('button')!.click();
  });
}

function confirmationButton(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
    (button) => button.textContent === label,
  )!;
}

async function confirmRevoke() {
  await act(async () => {
    confirmationButton('권한 해제').click();
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

  it.each(['rejection', 'throw', 'resolved error'] as const)(
    'retains the grant and enables retry after an action %s',
    async (failure) => {
      const action = vi.mocked(revokeMyMcpOAuthGrant);
      if (failure === 'rejection') {
        action.mockRejectedValueOnce(new Error('Connection interrupted'));
      } else if (failure === 'throw') {
        action.mockImplementationOnce(() => {
          throw new Error('Action unavailable');
        });
      } else {
        action.mockResolvedValueOnce({ error: 'request_failed' });
      }
      action.mockResolvedValueOnce({ success: true });
      render();
      openConfirmation();

      await confirmRevoke();

      expect(container.querySelector('[data-testid="settings-mcp-oauth-grant-grant-1"]')).not.toBeNull();
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      expect(confirmationButton('권한 해제').disabled).toBe(false);
      expect(confirmationButton('취소').disabled).toBe(false);
      expect(notifications.show).toHaveBeenLastCalledWith({
        color: 'red',
        message: koMessages.security.mcpIntegration.revokeFailed,
      });

      await confirmRevoke();

      expect(action).toHaveBeenNthCalledWith(1, 'grant-1');
      expect(action).toHaveBeenNthCalledWith(2, 'grant-1');
      expect(container.textContent).toContain('연결된 MCP 클라이언트가 없습니다.');
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(notifications.show).toHaveBeenLastCalledWith({
        color: 'green',
        message: koMessages.security.mcpIntegration.revokeSuccess,
      });
    },
  );

  it('disables confirmation and grant buttons until revocation succeeds', async () => {
    let resolve!: (result: { success: true }) => void;
    vi.mocked(revokeMyMcpOAuthGrant).mockReturnValueOnce(
      new Promise((complete) => {
        resolve = complete;
      }),
    );
    render();
    openConfirmation();

    await confirmRevoke();

    expect(confirmationButton('권한 해제').disabled).toBe(true);
    expect(confirmationButton('취소').disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    await confirmRevoke();
    expect(revokeMyMcpOAuthGrant).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ success: true }));

    expect(container.textContent).toContain('연결된 MCP 클라이언트가 없습니다.');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
