import { componentBindings } from '@/components/core/bindings';
import { Button, type ButtonActionProps } from '@/components/core/Button';

export type AuthActionButtonProps = Omit<ButtonActionProps, 'fullWidth'>;

/**
 * Keeps every login method on the same Core Button sizing and full-width
 * contract. Method-specific tone, emphasis, icon, and loading state remain
 * owned by the caller.
 */
export function AuthActionButton(props: AuthActionButtonProps) {
  return <Button labelWrap="wrap" {...componentBindings(props)} fullWidth />;
}
