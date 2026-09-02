'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { Code } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  CreateMailAdapterRequestSchema,
  DeleteMailAdapterRequestSchema,
  ListMailAdaptersAdminRequestSchema,
  MailAdapterType,
  SESConfigSchema,
  SMTPConfigSchema,
  TestMailAdapterConfigRequestSchema,
  TestMailAdapterRequestSchema,
  UpdateMailAdapterRequestSchema,
  type MailAdapter,
  type SESConfig,
  type SMTPConfig,
} from '@echovisionlab/geul-proto/secure/mail_adapter_pb.ts';
import { createMailAdapterClient } from '@/lib/api/server-client';

// Helper to convert proto MailAdapter to plain object
function toPlainAdapter(adapter: MailAdapter): PlainMailAdapter {
  return {
    id: adapter.id,
    name: adapter.name,
    type: adapter.type,
    isActive: adapter.isActive,
    priority: adapter.priority,
    config: adapter.config,
    createdAt: adapter.createdAt,
    updatedAt: adapter.updatedAt,
  };
}

// Plain object type for client consumption (no proto methods)
export interface PlainMailAdapter {
  id: string;
  name: string;
  type: MailAdapterType;
  isActive: boolean;
  priority: number;
  config:
    | { case: 'sesConfig'; value: SESConfig }
    | { case: 'smtpConfig'; value: SMTPConfig }
    | { case: undefined; value?: undefined };
  createdAt: string;
  updatedAt: string;
}

export async function listMailAdaptersAction(
  activeOnly?: boolean,
): Promise<{ adapters?: PlainMailAdapter[]; error?: string }> {
  try {
    const client = await createMailAdapterClient();
    const request = create(ListMailAdaptersAdminRequestSchema, {
      filters: activeOnly
        ? [create(FilterSpecSchema, { field: 'is_active', op: FilterOp.EQ, value: 'true' })]
        : undefined,
    });
    const response = await client.listMailAdaptersAdmin(request);
    return { adapters: response.adapters.map(toPlainAdapter) };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to list mail adapters' };
  }
}

export interface CreateMailAdapterInput {
  name: string;
  type: MailAdapterType;
  isActive: boolean;
  priority?: number;
  sesConfig?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    fromEmail: string;
    fromName?: string;
  };
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromEmail: string;
    fromName?: string;
  };
}

export async function createMailAdapterAction(
  input: CreateMailAdapterInput,
): Promise<{ adapter?: PlainMailAdapter; error?: string }> {
  try {
    const client = await createMailAdapterClient();
    const request = create(CreateMailAdapterRequestSchema, {
      name: input.name,
      type: input.type,
      isActive: input.isActive,
      priority: input.priority,
    });

    // Set config based on type
    if (input.type === MailAdapterType.SES && input.sesConfig) {
      request.config = {
        case: 'sesConfig',
        value: create(SESConfigSchema, {
          region: input.sesConfig.region,
          accessKeyId: input.sesConfig.accessKeyId,
          secretAccessKey: input.sesConfig.secretAccessKey,
          fromEmail: input.sesConfig.fromEmail,
          fromName: input.sesConfig.fromName,
        }),
      };
    } else if (input.type === MailAdapterType.SMTP && input.smtpConfig) {
      request.config = {
        case: 'smtpConfig',
        value: create(SMTPConfigSchema, {
          host: input.smtpConfig.host,
          port: input.smtpConfig.port,
          secure: input.smtpConfig.secure,
          user: input.smtpConfig.user,
          password: input.smtpConfig.password,
          fromEmail: input.smtpConfig.fromEmail,
          fromName: input.smtpConfig.fromName,
        }),
      };
    }

    const response = await client.create(request);
    return { adapter: response.adapter ? toPlainAdapter(response.adapter) : undefined };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create mail adapter' };
  }
}

export interface UpdateMailAdapterInput {
  id: string;
  name?: string;
  type?: MailAdapterType;
  isActive?: boolean;
  priority?: number;
  sesConfig?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    fromEmail: string;
    fromName?: string;
  };
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromEmail: string;
    fromName?: string;
  };
}

export async function updateMailAdapterAction(
  input: UpdateMailAdapterInput,
): Promise<{ adapter?: PlainMailAdapter; error?: string }> {
  try {
    const client = await createMailAdapterClient();
    const request = create(UpdateMailAdapterRequestSchema, {
      id: input.id,
      name: input.name,
      type: input.type,
      isActive: input.isActive,
      priority: input.priority,
    });

    // Set config if provided
    if (input.sesConfig) {
      request.config = {
        case: 'sesConfig',
        value: create(SESConfigSchema, {
          region: input.sesConfig.region,
          accessKeyId: input.sesConfig.accessKeyId,
          secretAccessKey: input.sesConfig.secretAccessKey,
          fromEmail: input.sesConfig.fromEmail,
          fromName: input.sesConfig.fromName,
        }),
      };
    } else if (input.smtpConfig) {
      request.config = {
        case: 'smtpConfig',
        value: create(SMTPConfigSchema, {
          host: input.smtpConfig.host,
          port: input.smtpConfig.port,
          secure: input.smtpConfig.secure,
          user: input.smtpConfig.user,
          password: input.smtpConfig.password,
          fromEmail: input.smtpConfig.fromEmail,
          fromName: input.smtpConfig.fromName,
        }),
      };
    }

    const response = await client.update(request);
    return { adapter: response.adapter ? toPlainAdapter(response.adapter) : undefined };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      if (err.code === Code.NotFound) {
        return { error: 'Not found' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update mail adapter' };
  }
}

export async function deleteMailAdapterAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createMailAdapterClient();
    const request = create(DeleteMailAdapterRequestSchema, { id });
    await client.delete(request);
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      if (err.code === Code.NotFound) {
        return { error: 'Not found' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete mail adapter' };
  }
}

export async function testMailAdapterAction(
  id: string,
  testEmail: string,
): Promise<{ success?: boolean; error?: string; messageId?: string }> {
  try {
    const client = await createMailAdapterClient();
    const request = create(TestMailAdapterRequestSchema, { id, testEmail });
    const response = await client.test(request);
    return {
      success: response.success,
      error: response.error,
      messageId: response.messageId,
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      if (err.code === Code.NotFound) {
        return { error: 'Not found' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to test mail adapter' };
  }
}

export interface TestMailAdapterConfigInput {
  type: MailAdapterType;
  testEmail: string;
  sesConfig?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    fromEmail: string;
    fromName?: string;
  };
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromEmail: string;
    fromName?: string;
  };
}

export async function testMailAdapterConfigAction(
  input: TestMailAdapterConfigInput,
): Promise<{ success?: boolean; error?: string; messageId?: string }> {
  try {
    const client = await createMailAdapterClient();
    const request = create(TestMailAdapterConfigRequestSchema, {
      type: input.type,
      testEmail: input.testEmail,
    });

    if (input.type === MailAdapterType.SES && input.sesConfig) {
      request.config = {
        case: 'sesConfig',
        value: create(SESConfigSchema, {
          region: input.sesConfig.region,
          accessKeyId: input.sesConfig.accessKeyId,
          secretAccessKey: input.sesConfig.secretAccessKey,
          fromEmail: input.sesConfig.fromEmail,
          fromName: input.sesConfig.fromName,
        }),
      };
    } else if (input.type === MailAdapterType.SMTP && input.smtpConfig) {
      request.config = {
        case: 'smtpConfig',
        value: create(SMTPConfigSchema, {
          host: input.smtpConfig.host,
          port: input.smtpConfig.port,
          secure: input.smtpConfig.secure,
          user: input.smtpConfig.user,
          password: input.smtpConfig.password,
          fromEmail: input.smtpConfig.fromEmail,
          fromName: input.smtpConfig.fromName,
        }),
      };
    }

    const response = await client.testConfig(request);
    return {
      success: response.success,
      error: response.error,
      messageId: response.messageId,
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'Forbidden' };
      }
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to test adapter config' };
  }
}

// Toggle adapter active state (convenience action)
export async function toggleMailAdapterAction(
  id: string,
  isActive: boolean,
): Promise<{ adapter?: PlainMailAdapter; error?: string }> {
  return updateMailAdapterAction({ id, isActive });
}
