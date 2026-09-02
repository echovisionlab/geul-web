'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { createAccountClient, createPublicNewsletterClient } from '@/lib/api/server-client';

export interface NewsletterMutationResult {
  success: boolean;
  message: string;
}

export async function unsubscribeNewsletterAction(token: string): Promise<NewsletterMutationResult> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return { success: false, message: 'A signed unsubscribe token is required.' };
  }

  try {
    const client = createPublicNewsletterClient();
    await client.unsubscribe({ token: normalizedToken });
    return { success: true, message: 'You have been successfully unsubscribed.' };
  } catch (error) {
    return {
      success: false,
      message: isConnectError(error) || error instanceof Error ? error.message : 'Failed to unsubscribe',
    };
  }
}

export async function setCurrentUserNewsletterSubscriptionAction(
  subscribed: boolean,
): Promise<NewsletterMutationResult> {
  try {
    const client = await createAccountClient();
    await client.setMyNewsletterSubscription({ subscribed });
    revalidatePath('/my/settings');
    return {
      success: true,
      message: subscribed ? 'You are subscribed to the newsletter.' : 'You have been unsubscribed from the newsletter.',
    };
  } catch (error) {
    return {
      success: false,
      message: isConnectError(error) || error instanceof Error ? error.message : 'Failed to update subscription',
    };
  }
}

export async function unsubscribeUserFromNewsletterAction(memberId: string): Promise<NewsletterMutationResult> {
  const normalizedMemberId = memberId.trim();
  if (!normalizedMemberId) {
    return { success: false, message: 'A user is required.' };
  }

  try {
    const client = await createAccountClient();
    await client.unsubscribeAccountFromNewsletter({ memberId: normalizedMemberId });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${normalizedMemberId}`);
    return { success: true, message: 'The user has been unsubscribed from the newsletter.' };
  } catch (error) {
    return {
      success: false,
      message: isConnectError(error) || error instanceof Error ? error.message : 'Failed to unsubscribe user',
    };
  }
}
