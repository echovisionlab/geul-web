export type BrowserFlowOutcome<TFlow> =
  | { kind: 'continued'; flow: TFlow; ok: boolean }
  | { kind: 'completed'; payload: unknown }
  | { kind: 'restart'; url: string }
  | { kind: 'rate-limited'; retryAfterSeconds: number }
  | { kind: 'failed'; status: number; payload: unknown };

interface DecodeBrowserFlowResponseOptions<TFlow> {
  asFlow: (payload: unknown) => TFlow | null;
  now?: number;
  restartUrl?: (payload: unknown) => string | null;
}

function retryAfterSeconds(value: string | null, now: number): number {
  if (!value?.trim()) {
    return 1;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds));
  }
  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) {
    return 1;
  }
  return Math.max(1, Math.ceil((retryAt - now) / 1000));
}

export async function decodeBrowserFlowResponse<TFlow>(
  response: Response,
  options: DecodeBrowserFlowResponseOptions<TFlow>,
): Promise<BrowserFlowOutcome<TFlow>> {
  const payload = await response.json().catch(() => null);
  if (response.status === 429) {
    return {
      kind: 'rate-limited',
      retryAfterSeconds: retryAfterSeconds(response.headers.get('Retry-After'), options.now ?? Date.now()),
    };
  }
  if (response.status === 410) {
    const url = options.restartUrl?.(payload) ?? null;
    if (url) {
      return { kind: 'restart', url };
    }
  }

  const flow = options.asFlow(payload);
  if (flow) {
    return { kind: 'continued', flow, ok: response.ok };
  }
  if (response.ok) {
    return { kind: 'completed', payload };
  }
  return { kind: 'failed', status: response.status, payload };
}
