import type { EditorRuntimeContextValue } from '@/lib/contexts/editor-runtime-context-value';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';

export function createTranslationSaveBarriers({
  entityType,
  entityId,
  runtimeContext,
}: {
  entityType: string;
  entityId: string;
  runtimeContext: Pick<EditorRuntimeContextValue, 'entityType' | 'entityId' | 'persistNow'> | null;
}) {
  const flushRegisteredSaves = async () => {
    if (!(await flushEditorSaves(`${entityType}:${entityId}`))) {
      throw new Error('Pending editor saves did not complete.');
    }
  };
  const persistRuntime = async () => {
    const entityTypeMatches =
      runtimeContext?.entityType === entityType ||
      (runtimeContext?.entityType === 'series' && entityType === 'post_series');
    if (runtimeContext && entityTypeMatches && runtimeContext.entityId === entityId) {
      await runtimeContext.persistNow();
    }
  };

  return {
    beforeRegenerate: async () => {
      await flushRegisteredSaves();
      await persistRuntime();
    },
    beforeSourceChange: async () => {
      await persistRuntime();
      await flushRegisteredSaves();
    },
  };
}
