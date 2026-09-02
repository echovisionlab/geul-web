export type ProgramEventEditorAction = 'edit' | 'publish' | 'archive' | 'delete';

export function resolveProgramEventEditorActions(
  isAdmin: boolean,
  status: 'draft' | 'published' | 'archived',
): ProgramEventEditorAction[] {
  if (!isAdmin) {
    return [];
  }

  return ['edit', 'delete', ...(status === 'published' ? (['archive'] as const) : (['publish'] as const))];
}
