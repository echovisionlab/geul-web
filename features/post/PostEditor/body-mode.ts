export type PostEditorBodyMode = 'locale-editor' | 'missing-target-fallback' | 'loading';

interface ResolvePostEditorBodyModeInput {
  isSourceLocaleReady: boolean;
  isEditingScopedLocale: boolean;
  hasLiveRow: boolean;
  isEditorReady: boolean;
}

export function resolvePostEditorBodyMode({
  isSourceLocaleReady,
  isEditingScopedLocale,
  hasLiveRow,
  isEditorReady,
}: ResolvePostEditorBodyModeInput): PostEditorBodyMode {
  if (!isSourceLocaleReady) {
    return 'loading';
  }

  if (isEditingScopedLocale && !hasLiveRow) {
    return 'missing-target-fallback';
  }

  if (isEditorReady) {
    return 'locale-editor';
  }

  return 'loading';
}
