'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { SharePasswordView, type SharePasswordViewProps } from './SharePasswordView';

export interface SharePasswordAccessState<TError extends string = string> {
  content?: ReactNode;
  error?: TError;
}

export interface SharePasswordFormProps<TError extends string> {
  action: (
    state: SharePasswordAccessState<TError>,
    formData: FormData,
  ) => SharePasswordAccessState<TError> | Promise<SharePasswordAccessState<TError>>;
  initialState: SharePasswordAccessState<TError>;
  hiddenFields: Readonly<Record<string, string>>;
  labels: SharePasswordViewProps['labels'];
  getErrorMessage: (error: TError) => string;
}

export function SharePasswordForm<TError extends string>({
  action,
  initialState,
  hiddenFields,
  labels,
  getErrorMessage,
}: SharePasswordFormProps<TError>) {
  const [password, setPassword] = useState('');
  const [state, formAction, pending] = useActionState<SharePasswordAccessState<TError>, FormData>(action, initialState);

  if (state.content) {
    return state.content;
  }

  return (
    <form action={formAction}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SharePasswordView
        password={password}
        onPasswordChange={setPassword}
        pending={pending}
        error={state.error ? getErrorMessage(state.error) : undefined}
        labels={labels}
      />
    </form>
  );
}
