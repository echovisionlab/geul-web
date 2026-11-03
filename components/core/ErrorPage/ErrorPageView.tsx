'use client';

import {
  LayoutContainer as DsLayoutContainer,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset,
} from '../Layout';
import { Heading as DsHeading, Text as DsText } from '../Typography';
import type { ReactNode } from 'react';

import { Button } from '../Button';
import { usePendingAction } from '../use-pending-action';

/** Retry commands return completion for the shared pending button; links retain navigation semantics. */
export type ErrorPageAction = { label: string } & (
  { href: string; onClick?: never } | { onClick: () => void | Promise<unknown>; href?: never }
);

function ErrorPageCommand({ action }: { action: Extract<ErrorPageAction, { onClick: unknown }> }) {
  const command = usePendingAction();
  return (
    <Button emphasis="low" onClick={() => command.run(action.onClick)} loading={command.pending}>
      {action.label}
    </Button>
  );
}

export interface ErrorPageViewProps {
  code?: string;
  codeVisual?: ReactNode;
  title: string;
  description?: string;
  actions: readonly ErrorPageAction[];
  fullScreen?: boolean;
}

export function ErrorPageView({
  code,
  codeVisual,
  title,
  description,
  actions,
  fullScreen = false,
}: ErrorPageViewProps) {
  return (
    <section aria-label={title} data-error-page style={{ minHeight: fullScreen ? '100svh' : '50vh' }}>
      <LayoutInset block="xl" inline="md">
        <DsLayoutStack align="center" justify="center" flexible>
          <DsLayoutContainer size="compact">
            <DsLayoutStack align="center" gap="lg">
              {codeVisual ??
                (code ? (
                  <DsText aria-hidden="true" size="display" weight="strong" align="center" tone="secondary">
                    {code}
                  </DsText>
                ) : null)}
              <DsHeading level={1} align="center">
                {title}
              </DsHeading>
              {description ? (
                <DsText tone="secondary" align="center" size="sm">
                  {description}
                </DsText>
              ) : null}
              <DsLayoutInline justify="center" gap="sm">
                {actions.map((action, index) =>
                  action.href !== undefined ? (
                    <Button key={index} emphasis="low" href={action.href}>
                      {action.label}
                    </Button>
                  ) : (
                    <ErrorPageCommand key={index} action={action} />
                  ),
                )}
              </DsLayoutInline>
            </DsLayoutStack>
          </DsLayoutContainer>
        </DsLayoutStack>
      </LayoutInset>
    </section>
  );
}
