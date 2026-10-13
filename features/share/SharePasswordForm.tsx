'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
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
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [state, formAction, pending] = useActionState<SharePasswordAccessState<TError>, FormData>(action, initialState);
  const startRef = useRef<HTMLSpanElement>(null);
  const endRef = useRef<HTMLSpanElement>(null);
  const wasLocked = useRef(!initialState.content);
  useEffect(() => {
    if (!state.content || !wasLocked.current) {
      return;
    }
    wasLocked.current = false;
    const roots: HTMLElement[] = [];
    for (
      let node = startRef.current?.nextElementSibling;
      node && node !== endRef.current;
      node = node.nextElementSibling
    ) {
      if (node instanceof HTMLElement) {
        roots.push(node);
      }
    }
    const selector = 'h1, [role="heading"][aria-level="1"]';
    const heading = roots.flatMap((node) =>
      node.matches(selector) ? [node] : Array.from(node.querySelectorAll<HTMLElement>(selector)),
    )[0];
    const target = heading ?? roots.find((node) => node.matches('article, [role="article"]'));
    if (!target) {
      return;
    }
    const existingTabIndex = target.getAttribute('tabindex');
    if (existingTabIndex === null) {
      target.tabIndex = -1;
    }
    target.focus();
    const restore = () => {
      if (existingTabIndex === null && target.getAttribute('tabindex') === '-1') {
        target.removeAttribute('tabindex');
      }
    };
    target.addEventListener('blur', restore, { once: true });
    return () => {
      target.removeEventListener('blur', restore);
      restore();
    };
  }, [state.content]);

  if (state.content) {
    return (
      <>
        <span ref={startRef} hidden aria-hidden />
        {state.content}
        <span ref={endRef} hidden aria-hidden />
      </>
    );
  }

  return (
    <>
      <span ref={startRef} hidden aria-hidden />
      <form
        action={(formData) => {
          setErrorDismissed(false);
          formAction(formData);
        }}
      >
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <SharePasswordView
          password={password}
          onPasswordChange={(value) => {
            setPassword(value);
            setErrorDismissed(true);
          }}
          pending={pending}
          error={state.error && !pending && !errorDismissed ? getErrorMessage(state.error) : undefined}
          labels={labels}
        />
      </form>
      <span ref={endRef} hidden aria-hidden />
    </>
  );
}
