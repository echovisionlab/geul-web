import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

/** The declarations that `@media print` applies to `selector` in one stylesheet, `!important` kept. */
function printDeclarations(path: string, selector: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  postcss.parse(readFileSync(resolve(process.cwd(), path), 'utf8')).walkAtRules('media', (media) => {
    if (!/\bprint\b/u.test(media.params)) {
      return;
    }
    media.walkRules((rule) => {
      if (rule.selectors.includes(selector)) {
        rule.walkDecls((declaration) => {
          declarations[declaration.prop] = `${declaration.value}${declaration.important ? ' !important' : ''}`;
        });
      }
    });
  });
  return declarations;
}

describe('public document print surfaces', () => {
  it('removes the fixed-chrome offsets of every frame kind from the printed main area', () => {
    expect(
      printDeclarations('components/core/ApplicationFrame/ApplicationFrame.module.css', '.root[data-frame-kind] .main'),
    ).toMatchObject({ margin: '0', padding: '0' });
  });

  it('prints every theme on paper and every non-inverse heading in paper ink', () => {
    expect(printDeclarations('lib/styles/variables.css', 'html[data-geul-theme] body')).toMatchObject({
      'background-color': 'var(--geul-paper-background) !important',
    });
    // Image-backed (inverse) headings keep their contrast on the printed image.
    expect(
      printDeclarations('lib/styles/print.css', ":is(h1, h2, h3, h4, h5, h6):not([data-tone='inverse'])"),
    ).toMatchObject({ color: 'var(--geul-paper-ink) !important' });
  });

  it.each([
    ['features/document-layout/ui/ContentLayoutView.module.css', ".root[data-content-height='viewport']"],
    ['features/document-layout/ui/ContentLayoutView.module.css', ".root[data-content-height='viewport'] .body"],
    ['features/page/PageView/BlockRenderer.module.css', ":global([data-footer-layout='pinned']) .sections"],
    ['features/page/PageView/BlockRenderer.module.css', '.section'],
  ])('resets %s %s to paged block flow', (path, selector) => {
    expect(printDeclarations(path, selector)).toMatchObject({
      display: 'block !important',
      overflow: 'visible !important',
    });
  });

  it('prints pinned document chrome in flow and Page columns as stacked blocks', () => {
    expect(
      printDeclarations('features/document-layout/ui/ContentLayoutView.module.css', '.pinnedChrome'),
    ).toMatchObject({ position: 'static !important' });
    expect(
      printDeclarations('features/page/PageView/BlockRenderer.module.css', ':global(.columns-section)'),
    ).toMatchObject({ display: 'block !important' });
  });

  it('prints an overlay entity detail header as one unbroken fragment over its exact-colour image', () => {
    const layout = 'features/document-layout/ui/EntityDetailLayout.module.css';

    expect(printDeclarations(layout, ".root[data-print-media='overlay'] .header")).toMatchObject({
      'break-inside': 'avoid',
    });
    expect(printDeclarations(layout, ".root[data-print-media='overlay'] .media")).toMatchObject({
      'print-color-adjust': 'exact',
    });
    expect(printDeclarations(layout, ".root[data-print-media='overlay'] .image")).toMatchObject({
      'print-color-adjust': 'exact',
    });
  });

  it('repeats Policy table headers on every printed page and keeps rows whole', () => {
    const policy = 'features/policy/LegalDocumentView.module.css';

    expect(printDeclarations(policy, '.content thead')).toMatchObject({ display: 'table-header-group' });
    expect(printDeclarations(policy, '.content tr')).toMatchObject({ 'break-inside': 'avoid' });
  });
});
