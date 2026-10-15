import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionRowSizeProvider, ToolbarDensityProvider, resolveActionSize } from './control-context';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { TextButton } from './TextButton';
describe('action composition geometry', () => {
  it('keeps every action kind on its row size despite conflicting standalone sizes', () => {
    const html = renderToStaticMarkup(
      <ActionRowSizeProvider size="xs">
        <Button size="lg">Save</Button>
        <IconButton label="Remove" size="xl" />
        <TextButton controlSize="md">Cancel</TextButton>
      </ActionRowSizeProvider>,
    );
    expect(html.match(/data-control-size="xs"/g)).toHaveLength(3);
    expect(html).not.toMatch(/data-control-size="(?:lg|xl|md)"/);
  });
  it('lets compact composition own geometry while preserving an uncomposed prose link', () => {
    const html = renderToStaticMarkup(
      <ToolbarDensityProvider density="compact">
        <ActionRowSizeProvider size="md">
          <Button>Save</Button>
          <IconButton label="Remove" />
          <TextButton>Cancel</TextButton>
        </ActionRowSizeProvider>
      </ToolbarDensityProvider>,
    );
    expect(html.match(/data-control-size="compact"/g)).toHaveLength(3);
    expect(renderToStaticMarkup(<TextButton href="/about">About</TextButton>)).not.toContain('data-control-size');
  });
  it('rejects raw geometry even in JS and cast callers', () => {
    expect(() => resolveActionSize('44px', undefined, 'comfortable')).toThrow(RangeError);
  });
});
