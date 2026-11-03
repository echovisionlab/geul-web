'use client';
import { useId, useRef, useState } from 'react';
import {
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { Button } from '@/components/core/Button';

export interface McpConsentPageViewProps {
  clientName: string;
  delegationName: string;
  offlineAccess: boolean;
  description: string;
  offlineDescription: string;
  revokeDescription: string;
  cancelLabel: string;
  connectLabel: string;
  approveAction: () => void | Promise<void>;
  rejectAction: () => void | Promise<void>;
}
export function McpConsentPageView({
  clientName,
  delegationName,
  offlineAccess,
  description,
  offlineDescription,
  revokeDescription,
  cancelLabel,
  connectLabel,
  approveAction,
  rejectAction,
}: McpConsentPageViewProps) {
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const submitting = useRef(false);
  const submit = async (decision: 'approve' | 'reject') => {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setPending(decision);
    try {
      await (decision === 'approve' ? approveAction() : rejectAction());
    } finally {
      submitting.current = false;
      setPending(null);
    }
  };
  const clientId = useId();
  const delegationId = useId();
  const permissionsId = useId();
  return (
    <DsLayoutInset block="xl">
      <DsLayoutContainer size="form">
        <DsLayoutStack gap="lg">
          <DsLayoutStack gap="xs">
            <DsHeading level={1}>Remote MCP</DsHeading>
            <DsText id={clientId} weight="strong" wrap="anywhere">
              {clientName}
            </DsText>
            <DsText id={delegationId} size="sm" tone="secondary" wrap="anywhere">
              {delegationName}
            </DsText>
          </DsLayoutStack>
          <DsLayoutStack
            id={permissionsId}
            gap="xs"
            role="group"
            aria-labelledby={clientId}
            aria-describedby={delegationId}
          >
            <DsText size="sm" tone="secondary">
              {description}
            </DsText>
            {offlineAccess && (
              <DsText size="sm" tone="secondary">
                {offlineDescription}
              </DsText>
            )}
            <DsText size="sm" tone="secondary">
              {revokeDescription}
            </DsText>
          </DsLayoutStack>
          <DsLayoutInline justify="end" gap="xs" align="center" wrap="wrap">
            <form
              action={() => submit('reject')}
              onSubmit={(event) => {
                if (submitting.current) {
                  event.preventDefault();
                } else {
                  setPending('reject');
                }
              }}
              aria-busy={pending === 'reject'}
            >
              <Button
                type="submit"
                tone="neutral"
                emphasis="low"
                loading={pending === 'reject'}
                disabled={pending !== null}
                labelWrap="wrap"
                aria-describedby={`${clientId} ${delegationId} ${permissionsId}`}
              >
                {cancelLabel}
              </Button>
            </form>
            <form
              action={() => submit('approve')}
              onSubmit={(event) => {
                if (submitting.current) {
                  event.preventDefault();
                } else {
                  setPending('approve');
                }
              }}
              aria-busy={pending === 'approve'}
            >
              <Button
                type="submit"
                tone="neutral"
                emphasis="medium"
                loading={pending === 'approve'}
                disabled={pending !== null}
                labelWrap="wrap"
                aria-describedby={`${clientId} ${delegationId} ${permissionsId}`}
              >
                {connectLabel}
              </Button>
            </form>
          </DsLayoutInline>
        </DsLayoutStack>
      </DsLayoutContainer>
    </DsLayoutInset>
  );
}
