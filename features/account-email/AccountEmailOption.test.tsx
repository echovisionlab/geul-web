// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AccountEmailOptionContent, type AccountEmailOptionSource } from './AccountEmailOption';

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
  return renderToStaticMarkup(<DesignSystemProvider forceColorScheme="light">{node}</DesignSystemProvider>);
}

describe('AccountEmailOption', () => {
  it('renders email text with source labels and provider accessible names', () => {
    const html = render(<AccountEmailOptionContent email="primary.email@example.com" sources={currentAndProvider} />);

    expect(html).toContain('primary.email@example.com');
    expect(html).toContain('Current');
    expect(html).toContain('aria-label="GitHub account"');
  });
});
