export type WaveformPeaks = number[] | number[][];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseWaveformPayload(payload: unknown): WaveformPeaks | undefined {
  if (!Array.isArray(payload) || payload.length === 0) {
    return undefined;
  }

  if (payload.every(isFiniteNumber)) {
    return payload;
  }

  if (payload.every((item) => Array.isArray(item) && item.length > 0 && item.every((value) => isFiniteNumber(value)))) {
    return payload as number[][];
  }

  return undefined;
}

export async function fetchWaveformData(url?: string | null): Promise<WaveformPeaks | undefined> {
  if (!url) {
    return undefined;
  }

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    return undefined;
  }

  return parseWaveformPayload(await response.json());
}
