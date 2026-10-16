'use server';

import { listMcpOAuthGrants, revokeMcpOAuthGrant, type McpOAuthGrant } from '@/features/auth/hydra-mcp-oauth';
import { getSessionFromCookie } from '@/lib/auth';
import { logServerFailure } from '@/lib/logging/logger';

export interface McpOAuthGrantListResult {
  grants: McpOAuthGrant[];
  error?: 'not_authenticated' | 'not_authorized' | 'request_failed';
}

export async function listMyMcpOAuthGrants(): Promise<McpOAuthGrantListResult> {
  const session = await getSessionFromCookie();
  if (!session) {
    return { grants: [], error: 'not_authenticated' };
  }
  if (session.user.role !== 'author' && session.user.role !== 'admin') {
    return { grants: [], error: 'not_authorized' };
  }
  try {
    return { grants: await listMcpOAuthGrants(session) };
  } catch (error) {
    logServerFailure('mcp-oauth-grant-actions', 'listMyMcpOAuthGrants', error);
    return { grants: [], error: 'request_failed' };
  }
}

export async function revokeMyMcpOAuthGrant(grantId: string): Promise<{ success?: true; error?: string }> {
  const session = await getSessionFromCookie();
  if (!session) {
    return { error: 'not_authenticated' };
  }
  if (session.user.role !== 'author' && session.user.role !== 'admin') {
    return { error: 'not_authorized' };
  }
  try {
    await revokeMcpOAuthGrant(session, grantId);
    return { success: true };
  } catch (error) {
    logServerFailure('mcp-oauth-grant-actions', 'revokeMyMcpOAuthGrant', error);
    return { error: 'request_failed' };
  }
}
