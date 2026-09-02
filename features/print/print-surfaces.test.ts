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
  it('resets Page sections, pinned layouts, and columns to paged block flow', () => {
    const layout = printRules('features/document-layout/ui/ContentLayoutView.module.css');
    const page = printRules('features/page/PageView/BlockRenderer.module.css');

    expect(layout).toContain('display: block !important');
    expect(layout).toContain('position: static !important');
    expect(page).toContain(':global(.columns-section)');
    expect(page).toContain('display: block !important');
    expect(page).toContain('overflow: visible !important');
  });

  it('prints the Work featured image and metadata as one overlay header fragment', () => {
    const header = printRules('features/work/WorkPublicHeaderLayout.module.css');
    const document = printRules('app/(general)/works/[idOrSlug]/WorkViewClient.module.css');

    expect(header).toContain('min-height: 62mm');
    expect(header).toContain('break-inside: avoid');
    expect(header).toContain('print-color-adjust: exact');
    expect(header).toContain('position: absolute');
    expect(document).toContain('display: block !important');
    expect(document).toContain('overflow: visible !important');
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
