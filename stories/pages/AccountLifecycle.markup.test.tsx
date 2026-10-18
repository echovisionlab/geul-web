// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { CancelDeletionPageView } from '@/features/account/CancelDeletionPageView';
import { ConfirmDeletionPageView } from '@/features/account/ConfirmDeletionPageView';
import { ConfirmRecoveryPageView } from '@/features/account/ConfirmRecoveryPageView';

it.each([
  ['deletion confirmation', ConfirmDeletionPageView],
  ['deletion cancellation', CancelDeletionPageView],
  ['recovery confirmation', ConfirmRecoveryPageView],
] as const)('renders %s success and invalid-token results', (_name, View) => {
  const successful = renderToStaticMarkup(
    <TestProviders>
      <View hasToken result={{ success: true, message: 'Applied' }} />
    </TestProviders>,
  );
  expect(successful).toContain('role="alert"');
  expect(successful).toContain('Applied');
  const invalid = renderToStaticMarkup(
    <TestProviders>
      <View hasToken={false} />
    </TestProviders>,
  );
  expect(invalid).toMatch(/<[^>]*role="alert"[^>]*>/);
  expect(invalid).toContain('data-tone="warning"');
  expect(invalid).toContain('href="/"');
});
