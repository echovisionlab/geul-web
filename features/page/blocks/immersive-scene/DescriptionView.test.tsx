import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ImmersiveSceneDescriptionView } from './DescriptionView';

describe('ImmersiveSceneDescriptionView', () => {
  it('renders headings, links, lists, emphasis, and authored line breaks', () => {
    const html = renderToStaticMarkup(
      <ImmersiveSceneDescriptionView>
        {
          '# Context\nFirst line\nSecond **bold** line with [Example Studio](https://studio.example.com).\n\n- One\n- Two'
        }
      </ImmersiveSceneDescriptionView>,
    );

    expect(html).toContain('<h3>Context</h3>');
    expect(html).toContain('First line<br/>\nSecond <strong>bold</strong> line');
    expect(html).toContain('href="https://studio.example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>One</li>');
  });

  it('drops raw HTML and unsafe link destinations', () => {
    const unsafeUrl = ['java', 'script:alert(1)'].join('');
    const html = renderToStaticMarkup(
      <ImmersiveSceneDescriptionView>
        {`<script>alert(1)</script>\n\n[unsafe](${unsafeUrl})`}
      </ImmersiveSceneDescriptionView>,
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain(unsafeUrl);
    expect(html).toContain('unsafe');
  });

  it('renders attribution Markdown with safe external links', () => {
    const unsafeUrl = ['java', 'script:alert(1)'].join('');
    const html = renderToStaticMarkup(
      <ImmersiveSceneDescriptionView variant="attribution">
        {`Created by [Artist A](https://example.com/artists/a) and [unsafe](${unsafeUrl})`}
      </ImmersiveSceneDescriptionView>,
    );

    expect(html).toContain('data-variant="attribution"');
    expect(html).toContain('href="https://example.com/artists/a"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).not.toContain(unsafeUrl);
    expect(html).toContain('unsafe');
  });
});
