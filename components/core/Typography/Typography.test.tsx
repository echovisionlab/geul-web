// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../IconButton';
import { Code, List, VisuallyHidden } from './index';

describe('closed typography and image chrome', () => {
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
