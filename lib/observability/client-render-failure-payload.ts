import { isRequestId } from '@echovisionlab/geul-telemetry/request-id';

export const CLIENT_RENDER_FAILURE_MAX_BODY_BYTES = 256;

const surfaces = new Set(['general', 'admin', 'global']);
const basePayloadKeys = ['kind', 'report_id', 'surface'] as const;
const classifiedPayloadKeys = ['kind', 'react_error_code', 'report_id', 'surface'] as const;
const reactErrorCodePattern = /^[0-9]{1,4}$/;

export interface ClientRenderFailurePayload {
  readonly surface: 'general' | 'admin' | 'global';
  readonly kind: 'react_error_boundary';
  readonly report_id: string;
  readonly react_error_code?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSurface(value: unknown): value is ClientRenderFailurePayload['surface'] {
  return typeof value === 'string' && surfaces.has(value);
}

export function parseClientRenderFailurePayload(value: unknown): ClientRenderFailurePayload | null {
  if (!isRecord(value)) {
    return null;
  }
  const keys = Object.keys(value).sort();
  const expectedKeys = value.react_error_code === undefined ? basePayloadKeys : classifiedPayloadKeys;
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    return null;
  }
  if (!isSurface(value.surface)) {
    return null;
  }
  if (value.kind !== 'react_error_boundary') {
    return null;
  }
  const reportId = value.report_id;
  if (typeof reportId !== 'string' || !isRequestId(reportId)) {
    return null;
  }
  const reactErrorCode = value.react_error_code;
  if (
    reactErrorCode !== undefined &&
    (typeof reactErrorCode !== 'string' || !reactErrorCodePattern.test(reactErrorCode))
  ) {
    return null;
  }
  return {
    surface: value.surface,
    kind: 'react_error_boundary',
    report_id: reportId,
    ...(reactErrorCode === undefined ? {} : { react_error_code: reactErrorCode }),
  };
}
