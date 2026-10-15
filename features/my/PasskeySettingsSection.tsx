'use client';
import { SupportingText, Text as DsText, VisuallyHidden } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconKey, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';
import {
  invokeKratosBrowserCeremony,
  isKratosWebAuthnRuntimeReady,
  type KratosUiNode,
} from '@/features/auth/kratos-flow';
import { KratosWebAuthnScript } from '@/features/auth/KratosWebAuthnScript';
import { startPrivilegedReauthentication } from '@/features/auth/login-redirect';
import {
  PASSKEY_SECURITY_CONTINUATION_PARAM,
  consumePasskeySecurityContinuation,
  passkeySecurityReauthenticationReturnTo,
  rememberPasskeySecurityContinuation,
  type PasskeySecurityContinuation,
} from '@/features/auth/security-reauthentication';
import {
  getSettingsFlowCsrfToken,
  getSettingsPasskeyCreateData,
  hasSettingsFlowError,
  isSettingsFlowFreshnessError,
  readSettingsFlowError,
  requestSettingsFlow,
  type SettingsFlow,
} from '@/features/auth/settings-flow';
import { getPublicAuthUrl } from '@/lib/public-runtime-config';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';

export interface PasskeyItem {
  id: string;
  displayName: string;
  addedAt: string | null;
  disabled: boolean;
}

export interface PasskeySettingsViewProps {
  passkeys: PasskeyItem[];
  loading: boolean;
  error: string | null;
  removingId: string | null;
  registrationReady: boolean;
  registration: {
    action: string;
    csrfToken: string;
    createData: string;
  } | null;
  onAdd: () => void;
  onRemove: (passkey: PasskeyItem) => void;
}

interface PasskeySettingsSectionProps {
  subjectId: string;
  requestFlow?: typeof requestSettingsFlow;
  hasRecoverableAuthenticationMethod?: boolean;
  onCredentialCountChange?: (count: number) => void;
}

function asKratosNodes(flow: SettingsFlow | null): KratosUiNode[] {
  return (flow?.ui?.nodes ?? []).filter(
    (node): node is KratosUiNode =>
      typeof node.type === 'string' && typeof node.group === 'string' && Boolean(node.attributes),
  );
}

export function getPasskeyItems(flow: SettingsFlow | null): PasskeyItem[] {
  return asKratosNodes(flow)
    .filter((node) => node.attributes.name === 'passkey_remove')
    .map((node) => {
      const value = node.attributes.value;
      const context = node.meta?.label?.context;
      return {
        id: typeof value === 'string' ? value : '',
        displayName:
          typeof context?.display_name === 'string' && context.display_name.trim()
            ? context.display_name
            : node.meta?.label?.text || 'Passkey',
        addedAt: typeof context?.added_at === 'string' ? context.added_at : null,
        disabled: node.attributes.disabled === true,
      };
    })
    .filter((item) => item.id);
}

export function PasskeySettingsView({
  passkeys,
  loading,
  error,
  removingId,
  registrationReady,
  registration,
  onAdd,
  onRemove,
}: PasskeySettingsViewProps) {
  const t = useTranslations('security.passkeys');
  const tCommonActions = useTranslations('common.actions');
  const dateTime = useDateTimeFormatter();
  const scopeId = useId();

  return (
    <DsLayoutStack gap="md">
      <SectionHeader
        title={
          <span role="heading" aria-level={2}>
            {t('title')}
          </span>
        }
        description={t('description')}
      />

      <DsLayoutStack gap="sm" data-testid="security-passkeys-section">
        {error ? (
          <Alert tone="danger">
            <DsText size="sm">{error}</DsText>
          </Alert>
        ) : null}

        {loading ? (
          <SectionCard appearance="plain" padding="sm">
            <SupportingText tone="secondary" role="status">
              {t('loading')}
            </SupportingText>
          </SectionCard>
        ) : passkeys.length > 0 ? (
          passkeys.map((passkey) => (
            <SectionCard
              appearance="plain"
              key={passkey.id}
              padding="sm"
              role="group"
              aria-labelledby={`${scopeId}-${passkey.id}-name`}
              aria-describedby={passkey.disabled ? `${scopeId}-${passkey.id}-reason` : undefined}
            >
              <DsLayoutInline justify="between" wrap="nowrap">
                <DsLayoutInline gap="sm" wrap="nowrap">
                  <IconKey size={22} aria-hidden />
                  <div>
                    <DsText id={`${scopeId}-${passkey.id}-name`} size="sm" weight="strong">
                      {passkey.displayName}
                    </DsText>
                    {passkey.addedAt ? (
                      <DsText size="xs" tone="secondary">
                        {t('added', {
                          date: dateTime.date(passkey.addedAt, { dateStyle: 'medium' }),
                        })}
                      </DsText>
                    ) : null}
                  </div>
                </DsLayoutInline>
                <Tooltip label={passkey.disabled ? t('lastMethod') : tCommonActions('remove')} withArrow>
                  <span>
                    <IconButton
                      tone="danger"
                      emphasis="low"
                      aria-label={t('removeNamed', { name: passkey.displayName })}
                      aria-describedby={passkey.disabled ? `${scopeId}-${passkey.id}-reason` : undefined}
                      disabled={passkey.disabled}
                      loading={removingId === passkey.id}
                      onClick={() => onRemove(passkey)}
                      data-testid={`security-remove-passkey-${passkey.id}`}
                    >
                      <IconTrash size={17} aria-hidden />
                    </IconButton>
                  </span>
                </Tooltip>
              </DsLayoutInline>
              {passkey.disabled ? (
                <VisuallyHidden id={`${scopeId}-${passkey.id}-reason`}>{t('lastMethod')}</VisuallyHidden>
              ) : null}
            </SectionCard>
          ))
        ) : (
          <SectionCard appearance="plain" padding="sm">
            <SupportingText tone="secondary">{t('empty')}</SupportingText>
          </SectionCard>
        )}

        {!loading && registration ? (
          <form action={registration.action} method="POST">
            <input type="hidden" name="csrf_token" value={registration.csrfToken} />
            <input type="hidden" name="method" value="passkey" />
            <input type="hidden" name="passkey_settings_register" value="" />
            <input type="hidden" name="passkey_create_data" value={registration.createData} />
            <Button
              type="button"
              emphasis="medium"
              leftSection={<IconPlus size={16} aria-hidden />}
              onClick={onAdd}
              disabled={!registrationReady}
              loading={!registrationReady}
              aria-busy={!registrationReady}
              data-testid="security-add-passkey"
            >
              {t('add')}
            </Button>
          </form>
        ) : null}
      </DsLayoutStack>
    </DsLayoutStack>
  );
}

export function PasskeySettingsSection({
  subjectId,
  requestFlow = requestSettingsFlow,
  hasRecoverableAuthenticationMethod = true,
  onCredentialCountChange,
}: PasskeySettingsSectionProps) {
  const t = useTranslations('security.passkeys');
  const { settings } = useSiteSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flow, setFlow] = useState<SettingsFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [registrationReady, setRegistrationReady] = useState(false);
  const [registrationRequested, setRegistrationRequested] = useState(false);
  const [resumedAction, setResumedAction] = useState<PasskeySecurityContinuation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodes = useMemo(() => asKratosNodes(flow), [flow]);
  const passkeys = useMemo(
    () =>
      getPasskeyItems(flow).map((passkey) => ({
        ...passkey,
        disabled: passkey.disabled || !hasRecoverableAuthenticationMethod,
      })),
    [flow, hasRecoverableAuthenticationMethod],
  );
  const registerNode = nodes.find((node) => node.attributes.name === 'passkey_register_trigger');
  const registerPayload = nodes.find((node) => node.attributes.name === 'passkey_settings_register');
  const createDataNode = nodes.find((node) => node.attributes.name === 'passkey_create_data');
  const csrfToken = flow ? getSettingsFlowCsrfToken(flow) : null;
  const canRegister = Boolean(registerNode && registerPayload && createDataNode && csrfToken);

  const loadFlow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await requestFlow({ returnTo: '/my/security' });
      setRegistrationReady(false);
      setFlow(next.flow);
      if (hasSettingsFlowError(next.flow)) {
        setError(t('errors.load'));
      }
    } catch (cause) {
      if (isSettingsFlowFreshnessError(cause)) {
        startPrivilegedReauthentication('/my/security');
      } else {
        setError(t('errors.load'));
      }
    } finally {
      setLoading(false);
    }
  }, [t, requestFlow]);

  useEffect(() => {
    void loadFlow();
  }, [loadFlow]);

  useEffect(() => {
    onCredentialCountChange?.(passkeys.length);
  }, [onCredentialCountChange, passkeys.length]);

  useEffect(() => {
    if (searchParams.get(PASSKEY_SECURITY_CONTINUATION_PARAM) !== '1') {
      return;
    }
    const continuation = consumePasskeySecurityContinuation(subjectId);
    window.history.replaceState(window.history.state, '', '/my/security');
    if (!continuation) {
      return;
    }
    setResumedAction(continuation);
  }, [searchParams, subjectId]);

  const removePasskey = useCallback(
    async (passkey: PasskeyItem) => {
      if (!flow?.id || !csrfToken || passkey.disabled || removingId) {
        return;
      }

      setRemovingId(passkey.id);
      setError(null);
      try {
        const response = await fetch(
          `${getPublicAuthUrl()}/self-service/settings?flow=${encodeURIComponent(flow.id)}`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              method: 'passkey',
              passkey_remove: passkey.id,
              csrf_token: csrfToken,
            }),
          },
        );

        if (!response.ok) {
          throw await readSettingsFlowError(response, t('errors.remove'));
        }
        await loadFlow();
      } catch (cause) {
        if (isSettingsFlowFreshnessError(cause)) {
          rememberPasskeySecurityContinuation({ action: 'remove_passkey', id: passkey.id }, subjectId);
          startPrivilegedReauthentication(passkeySecurityReauthenticationReturnTo());
        } else {
          setError(t('errors.remove'));
        }
      } finally {
        setRemovingId(null);
      }
    },
    [csrfToken, flow?.id, loadFlow, removingId, subjectId, t],
  );

  const requestPasskeyRegistration = useCallback(async () => {
    setRegistrationReady(false);
    setRegistrationRequested(true);
    setError(null);
    try {
      const next = await requestFlow({ returnTo: '/my/security' });
      setFlow(next.flow);
    } catch (cause) {
      setRegistrationRequested(false);
      if (isSettingsFlowFreshnessError(cause)) {
        rememberPasskeySecurityContinuation({ action: 'add_passkey' }, subjectId);
        startPrivilegedReauthentication(passkeySecurityReauthenticationReturnTo());
      } else {
        setError(t('errors.load'));
      }
    }
  }, [subjectId, t]);

  useEffect(() => {
    if (!resumedAction || loading) {
      return;
    }
    if (resumedAction.action === 'add_passkey') {
      setResumedAction(null);
      setRegistrationRequested(true);
      return;
    }
    const passkey = passkeys.find((item) => item.id === resumedAction.id);
    if (!passkey) {
      setResumedAction(null);
      return;
    }
    setResumedAction(null);
    void removePasskey(passkey);
  }, [loading, passkeys, removePasskey, resumedAction]);

  useEffect(() => {
    if (!registrationRequested || !registrationReady) {
      return;
    }
    setRegistrationRequested(false);
    void invokeKratosBrowserCeremony(registerNode?.attributes.onclickTrigger, {
      operation: 'create',
      resultFieldName: 'passkey_settings_register',
    })
      .then((submitted) => {
        if (!submitted) {
          setRegistrationReady(isKratosWebAuthnRuntimeReady('create', [registerNode?.attributes.onclickTrigger]));
          setError(t('errors.unsupported'));
          router.replace('/my/security');
        }
      })
      .catch(() => {
        setRegistrationReady(isKratosWebAuthnRuntimeReady('create', [registerNode?.attributes.onclickTrigger]));
        setError(t('errors.unsupported'));
        router.replace('/my/security');
      });
  }, [registerNode?.attributes.onclickTrigger, registrationReady, registrationRequested, router, t]);

  return (
    <>
      <KratosWebAuthnScript
        nodes={nodes.filter((node) => node.type === 'script')}
        readyKey={flow?.id ?? 'no-settings-flow'}
        credentialOperation="create"
        requiredTriggers={[registerNode?.attributes.onclickTrigger]}
        onReady={() => {
          setRegistrationReady(true);
          setError(null);
        }}
        onError={() => {
          setRegistrationReady(false);
          setError(t('errors.unsupported'));
        }}
      />
      <PasskeySettingsView
        passkeys={passkeys}
        loading={loading}
        error={error}
        removingId={removingId}
        registrationReady={registrationReady}
        registration={
          !loading && canRegister && flow?.id
            ? {
                action: `${getPublicAuthUrl()}/self-service/settings?flow=${encodeURIComponent(flow.id)}`,
                csrfToken: csrfToken ?? '',
                createData: getSettingsPasskeyCreateData(createDataNode?.attributes.value, settings.site_title),
              }
            : null
        }
        onAdd={() => {
          void requestPasskeyRegistration();
        }}
        onRemove={(passkey) => void removePasskey(passkey)}
      />
    </>
  );
}
