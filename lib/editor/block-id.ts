const BLOCK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** Creates the durable identity used by rich-text blocks and Page containers. */
export function createBlockId(): string {
  return globalThis.crypto.randomUUID();
}

/** Accepts only UUID identities produced by the current runtime or migration. */
export function isBlockId(value: unknown): value is string {
  return typeof value === 'string' && BLOCK_ID_PATTERN.test(value);
}
