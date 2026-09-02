import type { ActionResult } from '@/lib/actions/email';
import { getPublicAuthUrl } from '@/lib/public-runtime-config';
import { isValidUuid } from '@/lib/utils/validation';
import {
  clearSettingsPendingEmail,
  getSettingsVerificationContinuation,
  hasSettingsFlowError,
  isSettingsFlowFreshnessError,
  requestSettingsFlow,
  submitSettingsPendingEmail,
} from './settings-flow';

export type CanonicalEmailVerificationResult =
  | {
      kind: 'verification_started';
      flowId: string;
      verifiableAddress: string;
    }
  | {
      kind: 'preflight_rejected';
      message: string;
    }
  | {
      kind: 'reauth_required';
    }
  | {
      kind: 'failed';
    };

interface EmailVerificationRequest {
  fetchFn?: typeof fetch;
  newEmail: string;
  preflight: (email: string) => Promise<ActionResult>;
  locale?: string;
}

async function beginEmailVerification({
  fetchFn = fetch,
  newEmail,
  preflight,
  locale,
}: EmailVerificationRequest): Promise<CanonicalEmailVerificationResult> {
  const email = newEmail.trim();
  const preflightResult = await preflight(email);
  if (!preflightResult.success) {
    if (preflightResult.error === 'reauth_required') {
      return { kind: 'reauth_required' };
    }
    return {
      kind: 'preflight_rejected',
      message: preflightResult.message,
    };
  }

  try {
    const settings = await requestSettingsFlow({
      fetchFn,
      returnTo: '/my/security',
    });
    const canonicalEmail = settings.flow.identity?.traits?.email;
    if (typeof canonicalEmail !== 'string' || !canonicalEmail.trim()) {
      return { kind: 'failed' };
    }
    const updatedSettings = await submitSettingsPendingEmail({ fetchFn, flow: settings.flow, newEmail: email, locale });
    const continuation = getSettingsVerificationContinuation(updatedSettings, email, canonicalEmail);
    return continuation ? { kind: 'verification_started', ...continuation } : { kind: 'failed' };
  } catch (cause) {
    return isSettingsFlowFreshnessError(cause) ? { kind: 'reauth_required' } : { kind: 'failed' };
  }
}

export async function beginCanonicalEmailVerification(
  args: EmailVerificationRequest,
): Promise<CanonicalEmailVerificationResult> {
  return beginEmailVerification(args);
}

async function restartEmailVerification({
  fetchFn = fetch,
  newEmail,
  preflight,
  locale,
}: EmailVerificationRequest): Promise<CanonicalEmailVerificationResult> {
  try {
    const settings = await requestSettingsFlow({
      fetchFn,
      returnTo: '/my/security',
    });
    const cleared = await clearSettingsPendingEmail({ fetchFn, flow: settings.flow });
    if (hasSettingsFlowError(cleared)) {
      return { kind: 'failed' };
    }
    return beginEmailVerification({ fetchFn, newEmail, preflight, locale });
  } catch (cause) {
    return isSettingsFlowFreshnessError(cause) ? { kind: 'reauth_required' } : { kind: 'failed' };
  }
}

export async function restartCanonicalEmailVerification(
  args: EmailVerificationRequest,
): Promise<CanonicalEmailVerificationResult> {
  return restartEmailVerification(args);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function getReplacementVerificationFlowId(payload: unknown): string | null {
  const body = objectValue(payload);
  const replacementFlowId = body?.use_flow_id;
  return typeof replacementFlowId === 'string' && isValidUuid(replacementFlowId) ? replacementFlowId : null;
}

export type CanonicalEmailChangeObservation =
  | { kind: 'applied'; email: string }
  | { kind: 'applying'; email: string }
  | { kind: 'proof_pending'; email: string }
  | { kind: 'conflict'; email: string }
  | { kind: 'unavailable' };

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hasVerifiedEmailAddress(identity: Record<string, unknown>, email: string): boolean {
  const addresses = Array.isArray(identity.verifiable_addresses) ? identity.verifiable_addresses : [];
  return addresses.some((value) => {
    const address = objectValue(value);
    return (
      normalizeEmail(address?.value) === email &&
      normalizeEmail(address?.via) === 'email' &&
      (address?.verified === true || normalizeEmail(address?.status) === 'completed')
    );
  });
}

/**
 * Reads the Kratos authority after a verification submission. The browser does
 * not infer an API phase from hook error identifiers and does not persist a
 * recovery checkpoint.
 */
export async function observeCanonicalEmailChange({
  fetchFn = fetch,
  targetEmail,
}: {
  fetchFn?: typeof fetch;
  targetEmail: string;
}): Promise<CanonicalEmailChangeObservation> {
  const normalizedTarget = normalizeEmail(targetEmail);
  if (!normalizedTarget) {
    return { kind: 'unavailable' };
  }

  try {
    const response = await fetchFn(`${getPublicAuthUrl()}/sessions/whoami`, {
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return { kind: 'unavailable' };
    }

    const payload = objectValue(await response.json());
    const identity = objectValue(payload?.identity);
    const traits = objectValue(identity?.traits);
    if (!identity || !traits) {
      return { kind: 'unavailable' };
    }

    const canonicalEmail = normalizeEmail(traits.email);
    const pendingEmail = normalizeEmail(traits.pending_email);
    if (canonicalEmail === normalizedTarget && pendingEmail === '') {
      return { kind: 'applied', email: normalizedTarget };
    }
    if (pendingEmail === normalizedTarget) {
      return hasVerifiedEmailAddress(identity, normalizedTarget)
        ? { kind: 'applying', email: normalizedTarget }
        : { kind: 'proof_pending', email: normalizedTarget };
    }
    return { kind: 'conflict', email: normalizedTarget };
  } catch {
    return { kind: 'unavailable' };
  }
}
