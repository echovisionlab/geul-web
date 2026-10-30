import { create } from '@bufbuild/protobuf';
import {
  MailAdapterType,
  SESConfigSchema,
  SMTPConfigSchema,
} from '@echovisionlab/geul-proto/secure/mail_adapter_pb.ts';
import type { PlainMailAdapter, CreateMailAdapterInput } from '@/lib/actions/mail-adapter';
import type { MailAdaptersPageBindings } from '@/features/admin/mail-adapter/MailAdaptersPage';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
export function mailAdaptersFixture(
  state: 'ready' | 'empty' | 'failed' | 'pending' | 'action-failed',
): MailAdaptersPageBindings {
  const date = '2026-10-01T00:00:00Z';
  let adapters: PlainMailAdapter[] =
    state === 'empty'
      ? []
      : [
          {
            id: 'logging',
            name: 'Local logging',
            type: MailAdapterType.LOGGING,
            isActive: true,
            priority: 0,
            config: { case: undefined },
            createdAt: date,
            updatedAt: date,
          },
          {
            id: 'smtp',
            name: 'Studio SMTP',
            type: MailAdapterType.SMTP,
            isActive: false,
            priority: 1,
            config: {
              case: 'smtpConfig',
              value: create(SMTPConfigSchema, {
                host: 'smtp.example.invalid',
                port: 587,
                fromEmail: 'studio@example.com',
              }),
            },
            createdAt: date,
            updatedAt: date,
          },
        ];
  const failure = () =>
    state === 'action-failed' ? actionFailure('Local mail adapter action failed', 'ACTION_FAILED') : null;
  function config(input: Pick<CreateMailAdapterInput, 'sesConfig' | 'smtpConfig'>): PlainMailAdapter['config'] {
    return input.sesConfig
      ? { case: 'sesConfig', value: create(SESConfigSchema, input.sesConfig) }
      : input.smtpConfig
        ? { case: 'smtpConfig', value: create(SMTPConfigSchema, input.smtpConfig) }
        : { case: undefined };
  }
  return {
    listMailAdaptersAction: async () =>
      state === 'pending'
        ? new Promise(() => {})
        : state === 'failed'
          ? actionFailure('Local adapter list unavailable', 'ACTION_FAILED')
          : actionSuccess({ adapters }),
    createMailAdapterAction: async (input) => {
      const error = failure();
      if (error) {
        return error;
      }
      const adapter: PlainMailAdapter = {
        id: `adapter-${adapters.length + 1}`,
        name: input.name,
        type: input.type,
        isActive: input.isActive,
        priority: input.priority ?? 0,
        config: config(input),
        createdAt: date,
        updatedAt: date,
      };
      adapters = [...adapters, adapter];
      return actionSuccess({ adapter });
    },
    updateMailAdapterAction: async (input) => {
      const error = failure();
      if (error) {
        return error;
      }
      const current = adapters.find((adapter) => adapter.id === input.id);
      if (!current) {
        return actionFailure('Missing local adapter', 'ACTION_FAILED');
      }
      const adapter: PlainMailAdapter = {
        ...current,
        name: input.name ?? current.name,
        type: input.type ?? current.type,
        isActive: input.isActive ?? current.isActive,
        priority: input.priority ?? current.priority,
        config: input.sesConfig || input.smtpConfig ? config(input) : current.config,
      };
      adapters = adapters.map((row) => (row.id === adapter.id ? adapter : row));
      return actionSuccess({ adapter });
    },
    deleteMailAdapterAction: async (id) => {
      const error = failure();
      if (error) {
        return error;
      }
      adapters = adapters.filter((row) => row.id !== id);
      return actionSuccess({ success: true as const });
    },
    toggleMailAdapterAction: async (id, isActive) => {
      const error = failure();
      if (error) {
        return error;
      }
      adapters = adapters.map((row) => (row.id === id ? { ...row, isActive } : row));
      return actionSuccess({ adapter: adapters.find((row) => row.id === id) });
    },
    testMailAdapterAction: async () => failure() ?? { success: true, messageId: 'local-only-no-mail-sent' },
    testMailAdapterConfigAction: async () => failure() ?? { success: true, messageId: 'local-only-no-mail-sent' },
  };
}
