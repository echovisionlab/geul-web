import { Center, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { TextButton } from '@/components/core/TextButton';

type LoginStatusViewProps =
  | { kind: 'error'; message: string; retryHref: string; retryLabel: string }
  | { kind: 'newsletter-ready'; message: string; actionLabel: string; onAction: () => void }
  | { kind: 'newsletter-failed'; message: string; retryLabel: string; onRetry: () => void };

export function LoginStatusView(props: LoginStatusViewProps) {
  if (props.kind === 'error') {
    return (
      <Center p="md">
        <Stack align="center" gap="md">
          <Text c="red" size="lg" fw={500}>
            {props.message}
          </Text>
          <TextButton href={props.retryHref} size="sm" appearance="muted">
            {props.retryLabel}
          </TextButton>
        </Stack>
      </Center>
    );
  }

  if (props.kind === 'newsletter-ready') {
    return (
      <Center p="md">
        <Stack align="center" gap="md">
          <Text>{props.message}</Text>
          <Button onClick={props.onAction}>{props.actionLabel}</Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Center p="md">
      <Stack align="center" gap="md">
        <Text c="red" role="alert">
          {props.message}
        </Text>
        <Button onClick={props.onRetry}>{props.retryLabel}</Button>
      </Stack>
    </Center>
  );
}
