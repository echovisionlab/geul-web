import {
  LayoutContainer as DsLayoutContainer,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { Button } from '@/components/core/Button';
import { TextButton } from '@/components/core/TextButton';

type LoginStatusViewProps =
  | { kind: 'error'; message: string; retryHref: string; retryLabel: string }
  | { kind: 'newsletter-ready'; message: string; actionLabel: string; onAction: () => void }
  | { kind: 'newsletter-failed'; message: string; retryLabel: string; onRetry: () => void };

export function LoginStatusView(props: LoginStatusViewProps) {
  if (props.kind === 'error') {
    return (
      <DsLayoutInset space="md">
        <DsLayoutContainer size="form" inset="none">
          <DsLayoutStack align="center" gap="md">
            <DsText tone="danger" size="lg" weight="medium" align="center" role="alert">
              {props.message}
            </DsText>
            <TextButton href={props.retryHref} size="sm" appearance="muted">
              {props.retryLabel}
            </TextButton>
          </DsLayoutStack>
        </DsLayoutContainer>
      </DsLayoutInset>
    );
  }

  if (props.kind === 'newsletter-ready') {
    return (
      <DsLayoutInset space="md">
        <DsLayoutContainer size="form" inset="none">
          <DsLayoutStack align="center" gap="md">
            <DsText size="sm" align="center">
              {props.message}
            </DsText>
            <Button emphasis="strong" onClick={props.onAction}>
              {props.actionLabel}
            </Button>
          </DsLayoutStack>
        </DsLayoutContainer>
      </DsLayoutInset>
    );
  }

  return (
    <DsLayoutInset space="md">
      <DsLayoutContainer size="form" inset="none">
        <DsLayoutStack align="center" gap="md">
          <DsText tone="danger" align="center" role="alert">
            {props.message}
          </DsText>
          <Button onClick={props.onRetry}>{props.retryLabel}</Button>
        </DsLayoutStack>
      </DsLayoutContainer>
    </DsLayoutInset>
  );
}
