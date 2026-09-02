export function ensureShareLinkMutationSucceeded<T>(result: T): T {
  const error = (result as T & { error?: string }).error;
  if (error) {
    throw new Error(error);
  }
  return result;
}
