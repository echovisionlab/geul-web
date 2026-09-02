'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconKey, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Group, Stack, Text } from '@mantine/core';
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
  hasSettingsFlowError,
  isSettingsFlowFreshnessError,
  readSettingsFlowError,
  requestSettingsFlow,
  type SettingsFlow,
} from '@/features/auth/settings-flow';
import { getPublicAuthUrl } from '@/lib/public-runtime-config';

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

  return (
    <>
      <SectionHeader title={t('title')} description={t('description')} />

      <Stack gap="sm" data-testid="security-passkeys-section">
        {error ? (
          <Alert tone="danger">
            <Text size="sm">{error}</Text>
          </Alert>
        ) : null}

        {loading ? (
          <SectionCard p="sm">
            <Text size="sm" c="dimmed">
              {t('loading')}
            </Text>
          </SectionCard>
        ) : passkeys.length > 0 ? (
          passkeys.map((passkey) => (
            <SectionCard key={passkey.id} p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <IconKey size={22} aria-hidden />
                  <Box>
                    <Text size="sm" fw={600}>
                      {passkey.displayName}
                    </Text>
                    {passkey.addedAt ? (
                      <Text size="xs" c="dimmed">
                        {t('added', {
                          date: dateTime.date(passkey.addedAt, { dateStyle: 'medium' }),
                        })}
                      </Text>
                    ) : null}
                  </Box>
                </Group>
                <Tooltip label={passkey.disabled ? t('lastMethod') : tCommonActions('remove')} withArrow>
                  <span>
                    <IconButton
                      tone="danger"
                      emphasis="low"
                      aria-label={t('removeNamed', { name: passkey.displayName })}
                      disabled={passkey.disabled}
                      loading={removingId === passkey.id}
                      onClick={() => onRemove(passkey)}
                      data-testid={`security-remove-passkey-${passkey.id}`}
                    >
                      <IconTrash size={17} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Group>
            </SectionCard>
          ))
        ) : (
          <SectionCard p="sm">
            <Text size="sm" c="dimmed">
              {t('empty')}
            </Text>
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
              leftSection={<IconPlus size={16} />}
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
      </Stack>
    </>
  );
}

export function PasskeySettingsSection({
  subjectId,
  hasRecoverableAuthenticationMethod = true,
  onCredentialCountChange,
}: PasskeySettingsSectionProps) {
  const t = useTranslations('security.passkeys');
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
      const next = await requestSettingsFlow({ returnTo: '/my/security' });
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
  }, [t]);

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
      const next = await requestSettingsFlow({ returnTo: '/my/security' });
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
                createData: typeof createDataNode?.attributes.value === 'string' ? createDataNode.attributes.value : '',
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
