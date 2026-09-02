type EditorInterruptionSignal =
  | { kind: 'permission_revoked'; reason: 'permission_revoked' }
  | { kind: 'session_expired'; reason: 'session_expired' }
  | { kind: 'reload_required'; reason: 'reload_required' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEditorInterruptionSignal(value: unknown): value is EditorInterruptionSignal {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.kind === 'permission_revoked' && value.reason === 'permission_revoked') ||
    (value.kind === 'session_expired' && value.reason === 'session_expired') ||
    (value.kind === 'reload_required' && value.reason === 'reload_required')
  );
}

export function decodeEditorInterruptionSignal(payload: string): EditorInterruptionSignal | null {
  try {
    const value: unknown = JSON.parse(payload);
    return isEditorInterruptionSignal(value) ? value : null;
  } catch {
    return null;
  }
}
