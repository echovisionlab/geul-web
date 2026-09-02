'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearAcceptedAuthCodeDelivery,
  getAuthCodeTiming,
  readAcceptedAuthCodeDeliveryAt,
  recordAcceptedAuthCodeDelivery,
  type AuthCodePurpose,
  type AuthCodeTiming,
} from './auth-code-timing';
import { getPublicAuthCodeLifespanSeconds, getPublicAuthCodeResendCooldownSeconds } from '@/lib/public-runtime-config';

interface UseAuthCodeTimingOptions {
  active: boolean;
  flowExpiresAt?: string | null;
  flowId: string;
  purpose: AuthCodePurpose;
}

interface UseAuthCodeTimingResult {
  clearAcceptedDelivery: () => void;
  recordAcceptedDelivery: (acceptedFlowId?: string) => void;
  timing: AuthCodeTiming | null;
}

export function useAuthCodeTiming({
  active,
  flowExpiresAt,
  flowId,
  purpose,
}: UseAuthCodeTimingOptions): UseAuthCodeTimingResult {
  const [acceptedDeliveryAt, setAcceptedDeliveryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setAcceptedDeliveryAt(active ? readAcceptedAuthCodeDeliveryAt(purpose, flowId) : null);
    setNow(Date.now());
  }, [active, flowId, purpose]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  const recordAcceptedDelivery = useCallback(
    (acceptedFlowId = flowId) => {
      const acceptedAt = Date.now();
      recordAcceptedAuthCodeDelivery(purpose, acceptedFlowId, acceptedAt);
      if (acceptedFlowId === flowId) {
        setAcceptedDeliveryAt(acceptedAt);
        setNow(acceptedAt);
      }
    },
    [flowId, purpose],
  );

  const clearAcceptedDelivery = useCallback(() => {
    clearAcceptedAuthCodeDelivery(purpose, flowId);
    setAcceptedDeliveryAt(null);
    setNow(Date.now());
  }, [flowId, purpose]);

  return {
    clearAcceptedDelivery,
    recordAcceptedDelivery,
    timing: active
      ? getAuthCodeTiming(
          {
            acceptedDeliveryAt,
            codeLifespanSeconds: getPublicAuthCodeLifespanSeconds(),
            flowExpiresAt,
            resendCooldownSeconds: getPublicAuthCodeResendCooldownSeconds(),
          },
          now,
        )
      : null,
  };
}
