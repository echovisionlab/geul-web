import { describe, expect, it } from 'vitest';
import { buildSubmissionHref } from './submission-href';
describe('submission detail navigation', () => {
  it('starts a query on a bare route', () => {
    expect(buildSubmissionHref('/admin/forms/form-1/submissions', 'row/2')).toBe(
      '/admin/forms/form-1/submissions?submission=row%2F2',
    );
  });
  it('preserves an editor query and anchor, replacing the prior submission', () => {
    expect(buildSubmissionHref('/forms/form-1?edit=submissions&submission=old#responses', 'new')).toBe(
      '/forms/form-1?edit=submissions&submission=new#responses',
    );
  });
});
