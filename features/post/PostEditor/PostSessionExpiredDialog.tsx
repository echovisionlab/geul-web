'use client';

import { EditorSessionExpiredDialog } from '@/features/editor/EditorSessionExpiredDialog';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';

type NavigateToLogin = (destination: string) => void;

function currentEditorPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function PostSessionExpiredDialog({
  opened,
  returnTo,
  navigate = (destination) => window.location.assign(destination),
}: {
  opened: boolean;
  returnTo?: string;
  navigate?: NavigateToLogin;
}) {
  const handleConfirm = () => {
    navigate(buildLoginRedirectHref(returnTo ?? currentEditorPath()));
  };

  return <EditorSessionExpiredDialog opened={opened} onConfirm={handleConfirm} />;
}
