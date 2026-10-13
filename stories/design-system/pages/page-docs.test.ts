import { describe, expect, it } from 'vitest';
import sourceCatalog from '../../../docs/design-system/page-preview-coverage.json';
import routeCatalog from '../../../docs/design-system/ui-kit-route-index.json';
import {
  buildPageDocumentation,
  getPageDocumentation,
  pageDocumentation,
  previewStateGroups,
  storyIdFromPreview,
} from './page-docs';

describe('page documentation source contracts', () => {
  it('keeps only the selected CSF title when routes share display and editor branches', () => {
    const publicDocs = getPageDocumentation('Pages/Public/Documents');
    const route = publicDocs.find((entry) => entry.route === '/posts/[idOrSlug]');
    expect(route?.previews.map((preview) => preview.storyTitle)).toEqual(['Pages/Public/Documents']);
    const editor = getPageDocumentation('Pages/Editors/Post').find((entry) => entry.route === '/posts/[idOrSlug]');
    expect(editor?.previews.map((preview) => preview.storyTitle)).toEqual(['Pages/Editors/Post']);
    expect(editor?.previews[0].storyId).toBe('pages-editors-post--ready');
    const formEditor = getPageDocumentation('Pages/Editors/Form').find((entry) => entry.route === '/forms/[slug]');
    expect(formEditor?.previews[0].query).toBe('edit=true&tab=builder');
    expect(formEditor?.previews[0].owners).toContain('features/form/AdminFormLayoutClient.tsx');
  });

  it('exposes task specifications for every mapped story group without claiming execution results', () => {
    const previews = pageDocumentation.flatMap((entry) => entry.previews);
    expect(previews.length).toBeGreaterThan(0);
    expect(previews.filter((preview) => preview.contract === null).map((preview) => preview.storyTitle)).toEqual([]);
    expect(pageDocumentation.every((entry) => !('browserPassed' in entry) && !('accessibilityPassed' in entry))).toBe(
      true,
    );
  });

  it('keeps a parent-blocked route explicit even when its production View has a story', () => {
    const blocked = pageDocumentation.find((entry) => entry.route === '/admin/forms/[id]/submissions');
    expect(blocked?.disposition).toBe('disabled-by-terminal-layout');
    expect(blocked?.inheritedTerminalLayouts).toContain('app/admin/forms/[id]/layout.tsx');
    expect(blocked?.previews[0].storyId).toBe('pages-forms-operations--submissions');
  });

  it('preserves redirect-only routes as source entries without inventing independent pages', () => {
    const redirected = pageDocumentation.find((entry) => entry.route === '/files');
    expect(redirected?.disposition).toBe('redirect-only');
    expect(redirected?.previews).toEqual([]);
    expect(redirected?.redirects.some((redirect) => redirect.expression.includes('/admin/files'))).toBe(true);
  });

  it('rejects divergence between the page census and route navigation catalog', () => {
    const altered = {
      ...routeCatalog,
      routes: routeCatalog.routes.filter((entry) => entry.route !== '/login'),
    };
    expect(() => buildPageDocumentation(sourceCatalog, altered)).toThrow('Page catalog mapping mismatch');
  });

  it('does not classify another domain or the shared default Phone story as the selected route state', () => {
    const page = getPageDocumentation('Pages/Admin/Content Lists').find((entry) => entry.route === '/admin/pages');
    expect(page).toBeDefined();
    const states = previewStateGroups(page!.previews[0]);
    expect(states.focused.map((state) => state.variant)).toEqual([
      'Pages',
      'PagesEmpty',
      'PagesError',
      'PageCreateFailed',
      'KeyboardPageDeletion',
    ]);
    expect(states.related.map((state) => state.variant)).toContain('Phone');
    expect(states.related.map((state) => state.variant)).toContain('Posts');
  });

  it('extracts story identity without carrying a generated localhost port into navigation', () => {
    expect(storyIdFromPreview('http://localhost:6010/?path=/story/pages-auth-login--email')).toBe(
      'pages-auth-login--email',
    );
    expect(storyIdFromPreview('/?path=/docs/pages-auth-login--docs')).toBe('');
  });
});
