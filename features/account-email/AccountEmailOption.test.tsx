// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import {
  AccountEmailOptionContent,
  AccountEmailSelectRightSection,
  getAccountEmailSelectRightSectionWidth,
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

function render(node: React.ReactNode) {
  return renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);
}

describe('AccountEmailOption', () => {
  it('renders email text with source labels and provider accessible names', () => {
    const html = render(<AccountEmailOptionContent email="primary.email@example.com" sources={currentAndProvider} />);

    expect(html).toContain('primary.email@example.com');
    expect(html).toContain('Current');
    expect(html).toContain('aria-label="GitHub account"');
  });

  it('keeps the select right section compact for provider-only sources', () => {
    expect(getAccountEmailSelectRightSectionWidth(providerOnly)).toBe(48);
    expect(getAccountEmailSelectRightSectionWidth(currentAndProvider)).toBe(132);

    const html = render(<AccountEmailSelectRightSection sources={providerOnly} />);

    expect(html).toContain('aria-label="Google account"');
    expect(html).not.toContain('Current');
  });
});
