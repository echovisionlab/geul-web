// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PersonalAccessTokenSettingsView,
  type PersonalAccessTokenSettingsLabels,
} from './PersonalAccessTokenSettingsView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }),
});
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const labels: PersonalAccessTokenSettingsLabels = {
  title: 'Personal access token',
  description: 'Use this credential with Geul APIs.',
  empty: 'No token',
  created: 'Created',
  create: 'Create',
  regenerate: 'Regenerate',
  delete: 'Delete',
  copy: 'Copy',
  cancel: 'Cancel',
  close: 'Close',
  regenerateTitle: 'Regenerate token',
  regenerateConfirmation: 'The current credential will stop working immediately.',
  deleteTitle: 'Delete token',
  deleteConfirmation: 'This credential will stop working immediately.',
  oneTimeTitle: 'Copy token',
  oneTimeWarning: 'Shown once',
  secret: 'Secret',
  loadFailed: 'Failed to load',
};

let container: HTMLDivElement;
let root: Root;
const onCreate = vi.fn().mockResolvedValue(true);
const onRegenerate = vi.fn().mockResolvedValue(true);
const onDelete = vi.fn().mockResolvedValue(true);
const onCopySecret = vi.fn();
const onCloseSecret = vi.fn();

function render(overrides: Partial<React.ComponentProps<typeof PersonalAccessTokenSettingsView>> = {}) {
  act(() => {
    root.render(
      <MantineProvider env="test">
        <PersonalAccessTokenSettingsView
          token={null}
          labels={labels}
          onCreate={onCreate}
          onRegenerate={onRegenerate}
          onDelete={onDelete}
          onCopySecret={onCopySecret}
          onCloseSecret={onCloseSecret}
          {...overrides}
        />
      </MantineProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('PersonalAccessTokenSettingsView', () => {
  it('creates the single generic token directly without name or capability controls', async () => {
    render();

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-testid="security-create-personal-access-token"]')?.click(),
    );

    expect(onCreate).toHaveBeenCalledWith();
    expect(document.querySelector('[data-testid*="capability"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/MCP|Discogs/i);
  });

  it('hides creation after a token exists and exposes regenerate and delete', async () => {
    render({ token: { id: 'pat-1', createdAtLabel: 'Aug 23, 2026', canRegenerate: true } });

    expect(container.querySelector('[data-testid="security-create-personal-access-token"]')).toBeNull();
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="security-regenerate-personal-access-token-pat-1"]')
        ?.click(),
    );
    await act(async () =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
        .find((button) => button.textContent === 'Regenerate')
        ?.click(),
    );
    expect(onRegenerate).toHaveBeenCalledWith('pat-1');

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="security-delete-personal-access-token-pat-1"]')
        ?.click(),
    );
    await act(async () =>
      [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
        .find((button) => button.textContent === 'Delete')
        ?.click(),
    );
    expect(onDelete).toHaveBeenCalledWith('pat-1');
  });

  it('shows the credential once and forwards copy intent', () => {
    render({ secret: { value: 'pat-secret-value' } });

    expect(document.body.textContent).toContain('pat-secret-value');
    act(() =>
      document.querySelector<HTMLButtonElement>('[data-testid="security-copy-personal-access-token-secret"]')?.click(),
    );
    expect(onCopySecret).toHaveBeenCalledWith('pat-secret-value');
  });
});
