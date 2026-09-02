import { getPublicAuthUrl } from '@/lib/public-runtime-config';
import { decodeBrowserFlowResponse } from './auth-browser-transport';
import {
  getVerificationCsrfToken,
  getVerificationNodeValue,
  parseVerificationFlow,
  type VerificationFlow,
} from './verification-flow';

export async function loadVerificationFlow(flowId: string) {
  const response = await fetch(`${getPublicAuthUrl()}/self-service/verification/flows?id=${flowId}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return decodeBrowserFlowResponse(response, {
    asFlow: (payload) => parseVerificationFlow(payload, flowId),
  });
}

export async function submitVerificationCodeRequest(
  flow: VerificationFlow,
  code: string,
  locale: string,
): Promise<{ ok: boolean; payload: unknown; flow: VerificationFlow | null }> {
  const response = await fetch(`${getPublicAuthUrl()}/self-service/verification?flow=${flow.id}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      method: 'code',
      csrf_token: getVerificationCsrfToken(flow),
      code,
      transient_payload: { locale },
    }),
  });
  const payload: unknown = await response.json().catch(() => null);
  return { ok: response.ok, payload, flow: parseVerificationFlow(payload, flow.id) };
}

export async function resendVerificationCode(flow: VerificationFlow, email: string, locale: string) {
  const response = await fetch(`${getPublicAuthUrl()}/self-service/verification?flow=${flow.id}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      method: 'code',
      csrf_token: getVerificationCsrfToken(flow),
      email,
      resend: getVerificationNodeValue(flow, 'resend') || 'code',
      transient_payload: { locale },
    }),
  });
  const outcome = await decodeBrowserFlowResponse(response, {
    asFlow: (payload) => parseVerificationFlow(payload, flow.id),
  });
  return { outcome, status: response.status };
}
