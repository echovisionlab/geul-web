import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ConfirmDialogHost } from './confirm-dialogs';

it('renders nothing on the server', () => {
  expect(
    renderToString(<ConfirmDialogHost loadError={{ message: 'Could not open confirmation.', retryLabel: 'Retry' }} />),
  ).toBe('');
});
