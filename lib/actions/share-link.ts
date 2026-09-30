'use server';

import { connectActionErrorCode, isConnectErrorCode } from '@/lib/api/connect-error';
import {
  actionFailure,
  actionSuccess,
  type ActionResult,
  type LocalActionErrorCode,
} from '@/lib/actions/action-result';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { createShareLinkClient } from '@/lib/api/server-client';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('share-link-actions');

function shareLinkFailure(
  err: unknown,
  fallback: string,
  fallbackCode: LocalActionErrorCode,
  messageOverrides: Partial<Record<Code, string>>,
) {
  let message = err instanceof Error ? err.message : fallback;
  if (isConnectErrorCode(err, Code.Unauthenticated)) {
    message = messageOverrides[Code.Unauthenticated] ?? message;
  } else if (isConnectErrorCode(err, Code.NotFound)) {
    message = messageOverrides[Code.NotFound] ?? message;
  } else if (isConnectErrorCode(err, Code.PermissionDenied)) {
    message = messageOverrides[Code.PermissionDenied] ?? message;
  }
  return actionFailure(message.trim() ? message : fallback, connectActionErrorCode(err, fallbackCode));
}

function toAbsoluteShareUrl(rawUrl: string): string {
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  if (rawUrl.startsWith('//')) {
    return `https:${rawUrl}`;
  }

  const host = env.HOST.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const base = `https://${host}`;
  const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return new URL(path, base).toString();
}

function prependHost(link: ShareLinkItem): ShareLinkItem {
  link.url = toAbsoluteShareUrl(link.url);
  return link;
}

export async function listShareLinksAction(
  entityType: ShareLinkEntityType,
  entityId: string,
): Promise<ShareLinkItem[]> {
  try {
    const client = await createShareLinkClient();
    const response = await client.listShareLinks({ entityType, entityId });
    return response.shareLinks.map(prependHost);
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return [];
    }
    logger.error('Failed to list share links', { error: err });
    return [];
  }
}

export async function createShareLinkAction(
  entityType: ShareLinkEntityType,
  entityId: string,
  options?: {
    label?: string;
    expiresAt?: Date;
    password?: string;
  },
): Promise<ActionResult<{ shareLink: ShareLinkItem }>> {
  try {
    const client = await createShareLinkClient();
    const response = await client.createShareLink({
      entityType,
      entityId,
      label: options?.label,
      expiresAt: options?.expiresAt ? timestampFromDate(options.expiresAt) : undefined,
      password: options?.password,
    });
    if (!response.shareLink) {
      return actionFailure('Failed to create share link', 'SHARE_LINK_CREATE_FAILED');
    }
    return actionSuccess({ shareLink: prependHost(response.shareLink) });
  } catch (err) {
    logger.error('Failed to create share link', { error: err });
    return shareLinkFailure(err, 'Failed to create share link', 'SHARE_LINK_CREATE_FAILED', {
      [Code.Unauthenticated]: 'Unauthorized',
      [Code.NotFound]: 'Entity not found',
      [Code.PermissionDenied]: 'No permission to create share link',
    });
  }
}

export async function deleteShareLinkAction(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    const client = await createShareLinkClient();
    const response = await client.deleteShareLink({ id });
    return response.success
      ? actionSuccess({ success: true })
      : actionFailure('Failed to delete share link', 'SHARE_LINK_DELETE_FAILED');
  } catch (err) {
    logger.error('Failed to delete share link', { error: err });
    return shareLinkFailure(err, 'Failed to delete share link', 'SHARE_LINK_DELETE_FAILED', {
      [Code.Unauthenticated]: 'Unauthorized',
      [Code.NotFound]: 'Share link not found',
      [Code.PermissionDenied]: 'No permission to delete share link',
    });
  }
}
