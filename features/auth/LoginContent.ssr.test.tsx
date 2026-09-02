import { MantineProvider } from '@mantine/core';
import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { LoginContent } from './LoginContent';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('flow=flow-1'),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/auth/client', () => ({
  useSession: () => ({ data: null, isPending: false }),
}));

vi.mock('@/lib/actions/newsletter', () => ({
  setCurrentUserNewsletterSubscriptionAction: vi.fn(),
}));

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicAuthUrl: () => '/api/auth',
  getPublicAuthCodeLifespanSeconds: () => 900,
  getPublicAuthCodeResendCooldownSeconds: () => 60,
}));

it('renders a login flow during server-side rendering without a browser global', () => {
  expect(() =>
    renderToString(
      <MantineProvider>
        <LoginContent
          transport={{
            actionUrl: vi.fn(),
            browserUrl: vi.fn(),
            load: vi.fn(),
            submit: vi.fn(),
          }}
        />
      </MantineProvider>,
    ),
  ).not.toThrow();
});
