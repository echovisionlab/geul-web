'use client';

import { Stack } from '@mantine/core';
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
  return (
    <Stack gap="lg" maw={420} mx="auto" py="xl" px="md">
      <PageHeader title={labels.title} description={labels.description} />
      <PasswordInput
        name="password"
        label={labels.password}
        value={password}
        onChange={(event) => onPasswordChange(event.currentTarget.value)}
        error={error}
        autoComplete="current-password"
        required
      />
      <Button type="submit" loading={pending} disabled={!password}>
        {labels.submit}
      </Button>
    </Stack>
  );
}
