import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DraftModeAlert } from './DraftModeAlert';

describe('DraftModeAlert', () => {
  it('injects the visible draft status message into the pure view', () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider forceColorScheme="light">
        <DraftModeAlert id="post-1" status="draft" />
      </DesignSystemProvider>,
    );

    expect(html).toContain('id="draft-mode-alert-post-1"');
    expect(html).toContain('Draft mode (Draft) - This link expires in 24 hours');
  });
});
