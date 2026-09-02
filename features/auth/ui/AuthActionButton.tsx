import type { ButtonHTMLAttributes } from 'react';
import { Button, type ButtonProps } from '@/components/core/Button';

export type AuthActionButtonProps = Omit<ButtonProps, 'fullWidth'> &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>;

/**
 * Keeps every login method on the same Core Button sizing and full-width
 * contract. Method-specific tone, emphasis, icon, and loading state remain
 * owned by the caller.
 */
export function AuthActionButton(props: AuthActionButtonProps) {
  return <Button {...props} fullWidth />;
}
