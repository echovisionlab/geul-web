import type { ReactElement, ReactNode } from 'react';
import { render as renderWithTestingLibrary, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from './TestProviders';

export * from '@testing-library/react';
export { userEvent };

interface ProviderOptions {
  locale?: string;
  messages?: Parameters<typeof TestProviders>[0]['messages'];
}

/**
 * Renders inside the application's providers (messages, design system) and returns a `user` for
 * realistic interaction. Testing Library unmounts after every test. Query by role, label or text,
 * prefer `findBy*` to waiting loops, and assert what the user can perceive.
 */
export function render(
  ui: ReactElement,
  { locale, messages, ...options }: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders locale={locale} messages={messages}>
        {children}
      </TestProviders>
    );
  }
  return { user: userEvent.setup(), ...renderWithTestingLibrary(ui, { wrapper: Wrapper, ...options }) };
}
