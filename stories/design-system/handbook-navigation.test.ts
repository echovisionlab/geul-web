import { describe, expect, it } from 'vitest';
import { handbookDocumentId, handbookTarget, headingAnchors } from './handbook-navigation';
import handbook from './handbook.generated.json';
import { storybookHref } from '../shared/StorybookLink';

describe('design system document navigation', () => {
  it('keeps a Korean cross-document heading fragment', () => {
    expect(
      handbookTarget('core-specifications.md#c02-버튼과-아이콘-명령', 'docs/design-system/release-readiness.md'),
    ).toEqual({
      path: 'docs/design-system/core-specifications.md',
      hash: '#c02-%EB%B2%84%ED%8A%BC%EA%B3%BC-%EC%95%84%EC%9D%B4%EC%BD%98-%EB%AA%85%EB%A0%B9',
    });
  });
  it('adds stable Unicode anchors and disambiguates repeated headings', () => {
    const headings = ['C02 버튼과 아이콘 명령', 'C02 버튼과 아이콘 명령', 'API `value`'].map((value) => ({
      type: 'heading',
      children: [{ type: 'text', value }],
      data: { hProperties: {} as Record<string, unknown> },
    }));
    headingAnchors()({ type: 'root', children: headings });
    expect(headings.map((heading) => heading.data.hProperties.id)).toEqual([
      'c02-버튼과-아이콘-명령',
      'c02-버튼과-아이콘-명령-1',
      'api-value',
    ]);
  });
  it('keeps the requested handbook document and current toolbar settings', () => {
    const destination = new URL(
      storybookHref(
        `/?path=/story/design-system-handbook--reference&args=initialDocument:${handbookDocumentId('docs/design-system/button-api-review.md')}`,
        'http://localhost:6010/?path=/docs/core-actions-button--documentation&globals=theme:dark;locale:ko',
      ),
      'http://localhost:6010',
    );
    expect(destination.searchParams.get('args')).toBe('initialDocument:button-api-review');
    expect(destination.searchParams.get('globals')).toBe('theme:dark;locale:ko');
  });
  it('gives every source document a unique ID accepted by Storybook URL args', () => {
    const ids = handbook.documents.map((document) => handbookDocumentId(document.path));
    expect(new Set(ids).size).toBe(handbook.documents.length);
    expect(ids.every((id) => /^[a-zA-Z0-9_-]+$/.test(id))).toBe(true);
  });
  it('leaves external and static evidence links unchanged', () => {
    expect(
      storybookHref(
        '/ui-kit-docs/design-system/page-preview-coverage.json',
        'http://localhost:6010/?globals=theme:dark',
      ),
    ).toBe('/ui-kit-docs/design-system/page-preview-coverage.json');
    expect(storybookHref('https://carbondesignsystem.com/', 'http://localhost:6010')).toBe(
      'https://carbondesignsystem.com/',
    );
  });
});
