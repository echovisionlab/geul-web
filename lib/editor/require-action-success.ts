import { saveFailureFromAction } from './save-failure';

/** Convert fulfilled server-action errors into rejected saves at the transport boundary. */
export async function requireActionSuccess(
  result: Promise<{ error?: string; errorCode?: unknown } | { success: boolean }>,
): Promise<void> {
  const response = await result;
  if ('error' in response && response.error) {
    throw saveFailureFromAction({ error: response.error, errorCode: response.errorCode });
  }
}
