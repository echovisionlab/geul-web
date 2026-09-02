import { revalidatePath } from 'next/cache';
import { createLogger } from '@/lib/utils/logger';

type RevalidationType = 'layout' | 'page';

/**
 * Cache invalidation is best-effort after an RPC mutation has committed.
 * A Next cache failure must never make the client retry an already committed
 * mutation (especially deletes and asset changes).
 */
export function createCommittedMutationRevalidator(module: string, resource: string) {
  const logger = createLogger(module);

  return (path: string, type?: RevalidationType): void => {
    try {
      if (type) {
        revalidatePath(path, type);
      } else {
        revalidatePath(path);
      }
    } catch (error) {
      void logger.warn('Committed mutation cache revalidation failed', {
        data: {
          resource_type: resource,
        },
        error,
      });
    }
  };
}
