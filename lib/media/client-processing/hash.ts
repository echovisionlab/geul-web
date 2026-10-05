import { checkAbort } from './contracts';

export const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;

export function hexDigest(digest: ArrayBuffer | Uint8Array): string {
  const bytes = digest instanceof Uint8Array ? digest : new Uint8Array(digest);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hash one bounded artifact; source identity uses a separate streaming chain. */
export async function hashArtifact(file: Blob, signal: AbortSignal): Promise<string> {
  checkAbort(signal);
  if (file.size > MAX_ARTIFACT_BYTES) {
    throw new Error('A media artifact exceeds the browser hash budget.');
  }
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  checkAbort(signal);
  return hexDigest(digest);
}
