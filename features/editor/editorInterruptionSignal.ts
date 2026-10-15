import { parseServerMessage, type ServerMessageOf } from '@echovisionlab/geul-common/collaboration/protocol';

export function decodeEditorInterruptionSignal(payload: string): ServerMessageOf<'room.access_ended'> | null {
  const parsed = parseServerMessage(payload);
  return parsed.ok && parsed.message.kind === 'room.access_ended' ? parsed.message : null;
}
