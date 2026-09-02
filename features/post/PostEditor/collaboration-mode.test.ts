import { describe, expect, it } from 'vitest';
import { resolvePostEditorAiTarget } from './collaboration-mode';

describe('resolvePostEditorAiTarget', () => {
  it('targets the authenticated exact source or target room locale', () => {
    expect(resolvePostEditorAiTarget({ postId: 'post-1', roomLocale: 'ko', canEditLocaleDocument: true })).toEqual({
      type: 'post',
      id: 'post-1',
      locale: 'ko',
    });
    expect(resolvePostEditorAiTarget({ postId: 'post-1', roomLocale: 'en', canEditLocaleDocument: true })).toEqual({
      type: 'post',
      id: 'post-1',
      locale: 'en',
    });
  });

  it('hides AI before exact-room mutation authority or while read-only', () => {
    expect(
      resolvePostEditorAiTarget({ postId: 'post-1', roomLocale: null, canEditLocaleDocument: true }),
    ).toBeUndefined();
    expect(
      resolvePostEditorAiTarget({ postId: 'post-1', roomLocale: 'en', canEditLocaleDocument: false }),
    ).toBeUndefined();
  });
});
