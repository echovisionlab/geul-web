// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { badgeToneFromColor, getBadgeToneColor, statusToneFromColor } from './badge-tones';
import { getBadgeVariant, LabelBadge } from './LabelBadge';
import { StatusBadge } from './StatusBadge';

describe('Badge primitives', () => {
  it('maps product tones to Mantine colors', () => {
    expect(getBadgeToneColor('neutral')).toBe('gray');
    expect(getBadgeToneColor('danger')).toBe('red');
    expect(badgeToneFromColor('grape')).toBe('accent');
    expect(statusToneFromColor('grape')).toBe('accent');
    expect(getBadgeVariant('soft')).toBe('light');
    expect(getBadgeVariant('outline')).toBe('outline');
    expect(getBadgeVariant('solid')).toBe('filled');
    expect(getBadgeVariant('dot')).toBe('dot');
  });

  it('renders label and status badges with their content', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <LabelBadge tone="accent">Campaign</LabelBadge>
        <StatusBadge tone="positive">Published</StatusBadge>
      </MantineProvider>,
    );

    expect(html).toContain('Campaign');
    expect(html).toContain('Published');
    expect(html).toContain('data-appearance="soft"');
  });
});
