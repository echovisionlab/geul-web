// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/render';

import {
  AccountEmailOptionContent,
  AccountEmailSelectRightSection,
  type AccountEmailOptionSource,
} from './AccountEmailOption';

const providerOnly: AccountEmailOptionSource[] = [
  {
    key: 'google',
    kind: 'provider',
    label: 'Google account',
    provider: 'google',
  },
];

const currentAndProvider: AccountEmailOptionSource[] = [
  {
    key: 'current',
    kind: 'current',
    label: 'Current',
  },
  {
    key: 'github',
    kind: 'provider',
    label: 'GitHub account',
    provider: 'github',
  },
];

function renderMarkup(node: React.ReactNode) {
  return renderToStaticMarkup(<DesignSystemProvider forceColorScheme="light">{node}</DesignSystemProvider>);
}

describe('AccountEmailOption', () => {
  it('renders email text with source labels and provider accessible names', () => {
    const html = renderMarkup(
      <AccountEmailOptionContent email="primary.email@example.com" sources={currentAndProvider} />,
    );

    expect(html).toContain('primary.email@example.com');
    expect(html).toContain('Current');
    expect(html).toContain('aria-label="GitHub account"');
  });

  it('shows a provider-only selection as a named provider mark', () => {
    render(<AccountEmailSelectRightSection sources={providerOnly} />);

    expect(screen.getByRole('img', { name: 'Google account' })).toBeInTheDocument();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });

  it('shows only the primary source of the selected email', () => {
    render(<AccountEmailSelectRightSection sources={currentAndProvider} />);

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'GitHub account' })).not.toBeInTheDocument();
  });
});
