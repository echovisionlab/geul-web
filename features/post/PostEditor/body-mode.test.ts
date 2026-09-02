import { describe, expect, it } from 'vitest';
import { resolvePostEditorBodyMode } from './body-mode';

describe('resolvePostEditorBodyMode', () => {
  it('opens an existing target locale in the resident editor and waits for its room', () => {
    expect(
      resolvePostEditorBodyMode({
        isSourceLocaleReady: true,
        isEditingScopedLocale: true,
        hasLiveRow: true,
        isEditorReady: true,
      }),
    ).toBe('locale-editor');

    expect(
      resolvePostEditorBodyMode({
        isSourceLocaleReady: true,
        isEditingScopedLocale: true,
        hasLiveRow: true,
        isEditorReady: false,
      }),
    ).toBe('loading');
  });

  it('shows the source-room fallback when the selected target does not exist', () => {
    expect(
      resolvePostEditorBodyMode({
        isSourceLocaleReady: true,
        isEditingScopedLocale: true,
        hasLiveRow: false,
        isEditorReady: true,
      }),
    ).toBe('missing-target-fallback');
  });

  it('keeps the source editor for non-scoped editing and shows a loader until sync', () => {
    expect(
      resolvePostEditorBodyMode({
        isSourceLocaleReady: true,
        isEditingScopedLocale: false,
        hasLiveRow: true,
        isEditorReady: true,
      }),
    ).toBe('locale-editor');

    expect(
      resolvePostEditorBodyMode({
        isSourceLocaleReady: true,
        isEditingScopedLocale: false,
        hasLiveRow: true,
        isEditorReady: false,
      }),
    ).toBe('loading');
  });

  it('keeps the body loading while source-locale ownership is unresolved', () => {
    expect(
      resolvePostEditorBodyMode({
        isSourceLocaleReady: false,
        isEditingScopedLocale: false,
        hasLiveRow: true,
        isEditorReady: true,
      }),
    ).toBe('loading');
  });
});
