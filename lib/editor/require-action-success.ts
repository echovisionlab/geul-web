/** Convert fulfilled server-action errors into rejected saves at the transport boundary. */
export async function requireActionSuccess(result: Promise<{ error?: string } | { success: boolean }>): Promise<void> {
  const response = await result;
  if ('error' in response && response.error) {
    throw new Error(response.error);
  }
}
