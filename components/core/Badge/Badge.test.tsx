// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LabelBadge } from './LabelBadge';
import { StatusBadge } from './StatusBadge';

describe('Badge primitives', () => {
  it('renders label and status badges with their content', () => {
    const html = renderToStaticMarkup(
      <>
        <LabelBadge tone="accent">Campaign</LabelBadge>
        <StatusBadge tone="positive">Published</StatusBadge>
      </>,
    );

    expect(html).toContain('Campaign');
    expect(html).toContain('Published');
    expect(html).toContain('data-appearance="soft"');
  });
});
