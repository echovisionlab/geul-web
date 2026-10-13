'use client';

import { useEffect, useRef } from 'react';

import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';

import { Button } from '@/components/core/Button';
import { PasswordInput } from '@/components/core/Input';
import { PageHeader } from '@/components/core/PageHeader';

export interface SharePasswordViewProps {
  password: string;
  onPasswordChange: (value: string) => void;
  pending: boolean;
  error?: string;
  labels: {
    title: string;
    description: string;
    password: string;
    submit: string;
  };
}

export function SharePasswordView({ password, onPasswordChange, pending, error, labels }: SharePasswordViewProps) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const wasPending = useRef(pending);
  const previousError = useRef(error);
  useEffect(() => {
    if (!pending && error && (wasPending.current || error !== previousError.current)) {
      passwordRef.current?.focus();
    }
    wasPending.current = pending;
    previousError.current = error;
  }, [error, pending]);
  return (
    <div style={{ maxWidth: 420, marginInline: 'auto' }} aria-busy={pending}>
      <DsLayoutInset block="xl" inline="md">
        <DsLayoutStack gap="lg">
          <PageHeader title={labels.title} description={labels.description} />
          <PasswordInput
            ref={passwordRef}
            name="password"
            label={labels.password}
            value={password}
            onChange={(event) => onPasswordChange(event.currentTarget.value)}
            error={error}
            autoComplete="current-password"
            required
            readOnly={pending}
          />
          <Button type="submit" emphasis="strong" loading={pending} disabled={!password}>
            {labels.submit}
          </Button>
        </DsLayoutStack>
      </DsLayoutInset>
    </div>
  );
}
