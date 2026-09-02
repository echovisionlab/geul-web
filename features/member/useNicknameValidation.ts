'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { checkNicknameAvailabilityAction } from '@/lib/actions/user';

export type NicknameValidationStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'error';

export interface NicknameValidationState {
  normalized: string;
  length: number;
  valid: boolean;
  status: NicknameValidationStatus;
}

export type NicknameAvailabilityCheck = (nickname: string) => Promise<{ available?: boolean; error?: string }>;

export function normalizeNickname(value: string): Pick<NicknameValidationState, 'normalized' | 'length' | 'valid'> {
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  return { normalized, length, valid: length >= 1 && length <= 100 };
}

export function useNicknameValidation(
  value: string,
  options: { check?: NicknameAvailabilityCheck; debounceMs?: number } = {},
): NicknameValidationState {
  const { check = checkNicknameAvailabilityAction, debounceMs = 350 } = options;
  const normalized = useMemo(() => normalizeNickname(value), [value]);
  const [status, setStatus] = useState<NicknameValidationStatus>(
    normalized.normalized.length === 0 ? 'idle' : normalized.valid ? 'checking' : 'invalid',
  );
  const sequenceRef = useRef(0);

  useEffect(() => {
    sequenceRef.current += 1;
    const sequence = sequenceRef.current;

    if (normalized.normalized.length === 0) {
      setStatus('idle');
      return;
    }
    if (!normalized.valid) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');
    const timeout = window.setTimeout(() => {
      void check(normalized.normalized)
        .then((result) => {
          if (sequence !== sequenceRef.current) {
            return;
          }
          if (result.error || result.available === undefined) {
            setStatus('error');
          } else {
            setStatus(result.available ? 'available' : 'unavailable');
          }
        })
        .catch(() => {
          if (sequence === sequenceRef.current) {
            setStatus('error');
          }
        });
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [check, debounceMs, normalized.normalized, normalized.valid]);

  return { ...normalized, status };
}
