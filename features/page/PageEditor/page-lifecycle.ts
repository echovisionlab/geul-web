import { flushEditorSaves } from '@/lib/editor/editor-save-registry';

export async function runPageLifecycleActionAfterSave(
  pageId: string,
  action: () => Promise<unknown>,
  onSaveFailure: () => void,
): Promise<boolean> {
  let saved = false;
  try {
    saved = await flushEditorSaves(`page:${pageId}`);
  } catch {
    saved = false;
  }
  if (!saved) {
    onSaveFailure();
    return false;
  }
  await action();
  return true;
}

export function runPageStatusChangeAfterSave(
  pageId: string,
  nextStatus: 'draft' | 'published',
  actions: { publish: () => Promise<unknown>; unpublish: () => Promise<unknown> },
  onSaveFailure: () => void,
): Promise<boolean> {
  return runPageLifecycleActionAfterSave(
    pageId,
    nextStatus === 'published' ? actions.publish : actions.unpublish,
    onSaveFailure,
  );
}
