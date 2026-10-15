/**
 * Yjs marks every `applyUpdate` transaction as remote (`transaction.local === false`), even when
 * the update carries the author's own edits, as when IME composition is transferred from a shadow
 * document. Origins registered here identify such transactions as local author intent for the
 * intent journal and the durable save tracker.
 */
const localAuthorOrigins = new WeakSet<object>();

export function markLocalAuthorOrigin(origin: object): void {
  localAuthorOrigins.add(origin);
}

export function isLocalAuthorTransaction(transaction: { local: boolean; origin: unknown }): boolean {
  return (
    transaction.local ||
    (typeof transaction.origin === 'object' &&
      transaction.origin !== null &&
      localAuthorOrigins.has(transaction.origin))
  );
}
