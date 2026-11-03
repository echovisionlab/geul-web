// @vitest-environment jsdom
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { McpConsentPageView } from './McpConsentPageView';

describe('MCP consent pending decisions', () => {
  it.each(['Connect', 'Cancel'] as const)(
    'marks %s pending and locks the alternative until its action settles',
    async (label) => {
      let finish!: () => void;
      const request = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      const alternate = vi.fn();
      const { user } = render(
        <McpConsentPageView
          clientName="Client"
          delegationName="Account"
          offlineAccess
          description="Permissions"
          offlineDescription="Offline"
          revokeDescription="Can revoke"
          cancelLabel="Cancel"
          connectLabel="Connect"
          approveAction={label === 'Connect' ? request : alternate}
          rejectAction={label === 'Cancel' ? request : alternate}
        />,
      );
      await user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-busy', 'true');
      const other = screen.getByRole('button', { name: label === 'Connect' ? 'Cancel' : 'Connect' });
      expect(other).toBeDisabled();
      await user.click(other);
      expect(alternate).not.toHaveBeenCalled();
      await act(async () => finish());
      expect(other).toBeEnabled();
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
});
