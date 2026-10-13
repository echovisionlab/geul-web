'use client';
import { useId } from 'react';
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
            <form action={rejectAction}>
              <Button
                type="submit"
                tone="neutral"
                emphasis="low"
                labelWrap="wrap"
                aria-describedby={`${clientId} ${delegationId} ${permissionsId}`}
              >
                {cancelLabel}
              </Button>
            </form>
            <form action={approveAction}>
              <Button
                type="submit"
                tone="neutral"
                emphasis="medium"
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
