import { siGithub } from 'simple-icons';
import { useLocale } from 'next-intl';
import type { AuthProvider } from '@/features/auth/providers';
import { getKratosCsrfToken, type KratosBrowserFlow } from './kratos-flow';
import { AuthActionButton } from './ui/AuthActionButton';

const PROVIDERS = ['google', 'github'] as const satisfies readonly AuthProvider[];

export function serializeAuthTransientPayload(locale: string): string {
  return JSON.stringify({ preferred_locale: locale.trim() });
}

function ProviderLogo({ provider }: { provider: AuthProvider }) {
  if (provider === 'google') {
    return <img src="/providers/google-g-logo.svg" alt="" width={18} height={18} aria-hidden="true" />;
  }

  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" focusable="false">
      <path d={siGithub.path} fill="currentColor" />
    </svg>
  );
}

export function getAvailableAuthProviders(flow: KratosBrowserFlow): AuthProvider[] {
  return PROVIDERS.filter((provider) =>
    flow.ui.nodes.some(
      (node) => node.group === 'oidc' && node.attributes.name === 'provider' && node.attributes.value === provider,
    ),
  );
}

interface SocialAuthButtonsProps {
  disabled: boolean;
  flow: KratosBrowserFlow;
  fallbackActionUrl: string;
  label: (provider: AuthProvider) => string;
  onSubmit: (provider: AuthProvider) => void;
  submittingProvider: AuthProvider | null;
}

export function SocialAuthButtons({
  disabled,
  flow,
  fallbackActionUrl,
  label,
  onSubmit,
  submittingProvider,
}: SocialAuthButtonsProps) {
  const locale = useLocale();
  const providers = getAvailableAuthProviders(flow);
  const actionUrl = flow.ui.action || fallbackActionUrl;

  return providers.map((provider) => (
    <form key={provider} action={actionUrl} method="POST" onSubmit={() => onSubmit(provider)}>
      <input type="hidden" name="csrf_token" value={getKratosCsrfToken(flow)} />
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="transient_payload" value={serializeAuthTransientPayload(locale)} />
      <AuthActionButton
        type="submit"
        leftSection={<ProviderLogo provider={provider} />}
        tone="neutral"
        emphasis="medium"
        disabled={disabled && submittingProvider !== provider}
        loading={submittingProvider === provider}
      >
        {label(provider)}
      </AuthActionButton>
    </form>
  ));
}
