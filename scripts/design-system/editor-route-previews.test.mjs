import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasQueryEditorBranch, missingEditorPreviews } from './editor-route-previews.mjs';
test('a public story does not cover a query-driven editor on the same route', () => {
  const pages = [{ route: '/posts/[id]', source: 'if (isEntityEditView(query)) return <PostEditor />;' }];
  const publicOnly = [{ route: '/posts/[id]', coverage: 'page-view' }];
  assert.deepEqual(missingEditorPreviews(pages, publicOnly), pages);
  assert.deepEqual(missingEditorPreviews(pages, [...publicOnly, { route: '/posts/[id]', branch: 'edit' }]), []);
});
test('detects direct query access and does not classify a normal public page as an editor', () => {
  assert.equal(hasQueryEditorBranch('const edit = query.edit;'), true);
  assert.equal(hasQueryEditorBranch('return <PostView />;'), false);
});
