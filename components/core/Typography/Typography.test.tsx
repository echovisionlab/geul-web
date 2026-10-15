// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { TextButton } from '../TextButton';
import { Code, Heading, ImageChrome, List, Text, VisuallyHidden, type TextProps } from './index';

describe('closed typography and image chrome', () => {
  it('keeps semantic heading levels separate from responsive visual scale', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <Heading level={1} scale={{ base: 3, sm: 2 }} lines={2}>
        Document
      </Heading>,
    );
    const heading = host.querySelector('h1')!;
    expect(heading.dataset.level).toBe('3');
    expect(heading.style.getPropertyValue('--_typography-heading-scale-sm')).toBe('var(--geul-heading-h2)');
    expect(heading.dataset.lines).toBe('2');
  });
  it('exposes the document title as a named heading role above the section steps', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <Heading level={1} scale="title">
        Document
      </Heading>,
    );
    const heading = host.querySelector('h1')!;
    expect(heading.dataset.level).toBe('title');
    expect(heading.style.getPropertyValue('--_typography-heading-scale-base')).toBe('var(--geul-heading-title)');
    expect(heading.style.getPropertyValue('--_typography-heading-scale-xl')).toBe('var(--geul-heading-title)');
    expect(() =>
      renderToStaticMarkup(<Heading {...({ scale: 'display' } as unknown as { scale: 1 })}>Escape</Heading>),
    ).toThrow(RangeError);
  });
  it('blocks visual overrides while preserving native meaning', () => {
    const html = renderToStaticMarkup(
      <Text
        {...({
          as: 'span',
          tone: 'secondary',
          style: { color: 'magenta' },
          className: 'escape',
          'aria-label': 'Value',
        } as unknown as TextProps)}
      >
        Value
      </Text>,
    );
    expect(html).toContain('aria-label="Value"');
    expect(html).not.toContain('magenta');
    expect(html).not.toContain('escape');
  });
  it('keeps code, ordered list and hidden heading native and accessible', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <>
        <Code block scroll="standard" wrap="anywhere">
          code
        </Code>
        <List ordered>
          <List.Item>First</List.Item>
        </List>
        <VisuallyHidden as="h2" id="footer-title">
          Footer
        </VisuallyHidden>
      </>,
    );
    expect(host.querySelector('pre')?.textContent).toBe('code');
    expect(host.querySelector('ol > li')?.textContent).toBe('First');
    expect(host.querySelector('h2#footer-title')?.textContent).toBe('Footer');
  });
  it('projects one inverse action contract to buttons, icon buttons and text actions on media', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <ImageChrome placement="cover" shade="header">
        <Button>Read</Button>
        <IconButton label="Edit">+</IconButton>
        <TextButton>Share</TextButton>
      </ImageChrome>,
    );
    const controls = host.querySelectorAll('[data-control-kind]');
    expect(controls).toHaveLength(3);
    for (const item of controls) {
      expect(item.getAttribute('data-contrast')).toBe('inverse');
    }
  });
  it('counts repeated filter/sort state without making the count an extra accessible control', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      <IconButton count={120} label="Filters (120)">
        F
      </IconButton>,
    );
    const button = host.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Filters (120)');
    expect(button.querySelector('[aria-hidden]')?.textContent).toBe('99+');
    expect(() =>
      renderToStaticMarkup(
        <IconButton count={-1} label="Filters">
          F
        </IconButton>,
      ),
    ).toThrow('nonnegative');
  });
});
