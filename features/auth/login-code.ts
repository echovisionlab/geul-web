import { getKratosNodeStringValue, type KratosBrowserFlow } from './kratos-flow';

export function getLoginCodeIdentifier(flow: KratosBrowserFlow, enteredEmail: string): string {
  return getKratosNodeStringValue(flow, 'identifier') || enteredEmail.trim();
}

export function buildLoginCodePayload({
  flow,
  enteredEmail,
  code,
  resend,
  locale,
}: {
  flow: KratosBrowserFlow;
  enteredEmail: string;
  code?: string;
  resend?: string;
  locale?: string;
}): Record<string, unknown> {
  return {
    method: 'code',
    identifier: getLoginCodeIdentifier(flow, enteredEmail),
    ...(code ? { code } : {}),
    ...(resend ? { resend } : {}),
    ...(locale?.trim() ? { transient_payload: { preferred_locale: locale.trim() } } : {}),
  };
}
