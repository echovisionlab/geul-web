import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function printRules(path: string): string {
  const css = read(path);
  return /@media print\s*\{([\s\S]*)\}\s*$/u.exec(css)?.[1] ?? '';
}

describe('public document print surfaces', () => {
  it('removes fixed-chrome offsets from every frame kind and prints on paper in every theme', () => {
    const frame = printRules('components/core/ApplicationFrame/ApplicationFrame.module.css');
    const variables = printRules('lib/styles/variables.css');
    const print = read('lib/styles/print.css');

    expect(frame).toMatch(/\.root\[data-frame-kind\] \.main\s*\{[^}]*margin:\s*0;[^}]*padding:\s*0;/su);
    expect(variables).toMatch(/html\[data-geul-theme\] body\s*\{[^}]*var\(--geul-paper-background\) !important/su);
    // Image-backed (inverse) headings keep their contrast; every other heading prints in paper ink.
    expect(print).toContain(":is(h1, h2, h3, h4, h5, h6):not([data-tone='inverse'])");
  });

  it('separates document chrome from the body once, in the shared layout', () => {
    const layout = read('features/document-layout/ui/ContentLayoutView.module.css');
    const post = read('features/post/PostViewContent.tsx');

    expect(layout).toMatch(/\.flowChrome\s*\{[^}]*margin-block-end:\s*var\(--geul-spacing-md\);/su);
    expect(layout).toMatch(/\.pinnedChrome \+ \.body\s*\{[^}]*padding-block-start:\s*var\(--geul-spacing-md\);/su);
    expect(post).not.toContain('blockStart=');
  });

  it('resets Page sections, pinned layouts, and columns to paged block flow', () => {
    const layout = printRules('features/document-layout/ui/ContentLayoutView.module.css');
    const page = printRules('features/page/PageView/BlockRenderer.module.css');

    expect(layout).toContain('display: block !important');
    expect(layout).toContain('position: static !important');
    expect(page).toContain(':global(.columns-section)');
    expect(page).toContain('display: block !important');
    expect(page).toContain('overflow: visible !important');
  });

  it('prints an overlay entity detail as one image-backed header fragment', () => {
    const detail = printRules('features/document-layout/ui/EntityDetailLayout.module.css');
    const work = read('app/(general)/works/[idOrSlug]/WorkViewClient.tsx');

    expect(work).toContain('printMedia="overlay"');
    expect(detail).toContain("[data-print-media='overlay']");
    expect(detail).toContain('min-height: 62mm');
    expect(detail).toContain('break-inside: avoid');
    expect(detail).toContain('print-color-adjust: exact');
    expect(detail).toContain('position: absolute');
  });

  it('prints active, preview, shared, and archived Policy documents through one module boundary', () => {
    const policy = printRules('features/policy/LegalDocumentView.module.css');
    const privacy = read('app/(general)/privacy/PrivacyPageClient.tsx');
    const terms = read('app/(general)/terms/TermsPageClient.tsx');
    const shared = read('features/policy/LegalShareDocumentView.tsx');

    expect(policy).toContain('display: table-header-group');
    expect(policy).toContain('break-inside: avoid');
    expect(privacy).toContain('data-legal-document="privacy"');
    expect(terms).toContain('data-legal-document="terms"');
    expect(shared).toContain('data-legal-document={document.entityType}');
  });
});
