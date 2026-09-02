// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Divider, MantineProvider, Stack } from '@mantine/core';
import type { UserFull } from '@/lib/types/user/model';
import enMessages from '@/messages/en.json';
import {
  UserBanStateSection,
  UserDeliveryEmailSection,
  UserSsoProvidersSection,
  type UserEmailSuppressionStatus,
} from './auth';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function render(node: ReactNode) {
  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

function renderAuthSections({
  user,
  suppression = null,
  onReleaseSuppression,
  onSetCanonicalEmail,
}: {
  user: UserFull;
  suppression?: UserEmailSuppressionStatus | null;
  onReleaseSuppression?: (email: string) => void;
  onSetCanonicalEmail?: (email: string) => boolean | Promise<boolean>;
}) {
  render(
    <Stack gap="lg">
      <UserDeliveryEmailSection
        user={user}
        suppression={suppression}
        onReleaseSuppression={onReleaseSuppression}
        onSetCanonicalEmail={onSetCanonicalEmail}
      />
      <Divider />
      <UserSsoProvidersSection auth={user.auth_details} />
      <Divider />
      <UserBanStateSection user={user} />
    </Stack>,
  );
}

const baseUser: UserFull = {
  id: 'user-1',
  tag_ids: [],
  nickname: 'John Doe',
  email: 'johndoe@example.com',
  email_verified: true,
  image: null,
  bio: null,
  website: null,
  social_links: {},
  role: 'user',
  banned: false,
  onboarded: true,
  ban_reason: null,
  ban_expires: null,
  status: 'active',
  created_at: new Date('2026-04-19T00:00:00Z'),
  updated_at: null,
  auth_details: {
    providers: [
      { provider: 'google', identifier: 'google-subject' },
      { provider: 'github', identifier: 'github-subject' },
    ],
    email_candidates: [
      {
        email: 'johndoe@example.com',
        normalized_email: 'johndoe@example.com',
        current: true,
        kratos_verified: true,
        effective_trusted: true,
        usable_for_delivery: true,
        sources: [
          {
            source_type: 'kratos_current',
            provider: null,
            provider_subject: null,
          },
          {
            source_type: 'oidc_provider',
            provider: 'google',
            provider_subject: 'google-subject',
          },
        ],
      },
      {
        email: 'john@github.example',
        normalized_email: 'john@github.example',
        current: false,
        kratos_verified: true,
        effective_trusted: true,
        usable_for_delivery: true,
        sources: [
          {
            source_type: 'oidc_provider',
            provider: 'github',
            provider_subject: 'github-subject',
          },
        ],
      },
    ],
  },
  ban_details: {
    metadata_banned: false,
    identity_state: 'active',
    inactive_state: false,
    reason: null,
    expires_at: null,
  },
};

describe('admin user auth sections', () => {
  it('shows provider-backed delivery addresses without password or external-email controls', () => {
    renderAuthSections({ user: baseUser });

    expect(document.body.textContent).toContain('johndoe@example.com');
    expect(document.body.textContent).toContain('Google');
    expect(document.body.textContent).toContain('GitHub');
    expect(document.body.textContent).not.toContain('Password login');
    expect(document.body.textContent).not.toContain('External email');
    expect(document.body.textContent).not.toContain('Kratos');
  });

  it('shows delivery suppression without changing authentication state', () => {
    const onRelease = vi.fn();

    renderAuthSections({
      user: baseUser,
      suppression: {
        email: 'johndoe@example.com',
        reason: 'invalid_recipient',
        lastError: '550 user unknown',
        suppressedAt: new Date('2026-04-18T10:00:00.000Z'),
      },
      onReleaseSuppression: onRelease,
    });

    expect(document.body.textContent).toContain('Email delivery is blocked');
    expect(document.body.textContent).toContain('invalid_recipient');
    const releaseButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Release email'),
    );

    act(() => {
      releaseButton?.click();
    });

    expect(onRelease).toHaveBeenCalledWith('johndoe@example.com');
  });

  it('shows inactive identity state separately from ban metadata', () => {
    renderAuthSections({
      user: {
        ...baseUser,
        banned: true,
        ban_details: {
          metadata_banned: false,
          identity_state: 'inactive',
          inactive_state: true,
          reason: null,
          expires_at: null,
        },
      },
    });

    expect(document.body.textContent).toContain('No ban');
    expect(document.body.textContent).toContain('Inactive');
  });
});
