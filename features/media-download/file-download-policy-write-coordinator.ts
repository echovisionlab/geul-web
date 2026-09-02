const targetWriteTails = new Map<string, Promise<void>>();

export function enqueueFileDownloadPolicyWrite<Result>(
  targetKey: string,
  write: () => Promise<Result>,
): Promise<Result> {
  const previousTail = targetWriteTails.get(targetKey);
  let result: Promise<Result>;
  if (previousTail) {
    result = previousTail.then(write, write);
  } else {
    try {
      result = Promise.resolve(write());
    } catch (error) {
      result = Promise.reject(error);
    }
  }
  const nextTail = result.then(
    () => undefined,
    () => undefined,
  );
  targetWriteTails.set(targetKey, nextTail);
  void nextTail.then(() => {
    if (targetWriteTails.get(targetKey) === nextTail) {
      targetWriteTails.delete(targetKey);
    }
  });
  return result;
}

export function waitForFileDownloadPolicyWrites(targetKey: string): Promise<void> {
  return targetWriteTails.get(targetKey) ?? Promise.resolve();
}

export function runAfterFileDownloadPolicyWrites<Result>(
  targetKey: string,
  read: () => Promise<Result>,
): Promise<Result> {
  const currentTail = targetWriteTails.get(targetKey);
  if (currentTail) {
    return currentTail.then(read, read);
  }
  try {
    return Promise.resolve(read());
  } catch (error) {
    return Promise.reject(error);
  }
}
