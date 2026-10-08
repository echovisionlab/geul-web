import type { ReactNode } from 'react';
import { Center, Container, Group, Stack, Text, Title } from '@mantine/core';
import { Button } from '../Button';

export interface ErrorPageViewProps {
  code?: string;
  title: string;
  description: ReactNode;
  homeLabel: string;
  homeHref?: string;
  retryLabel?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function ErrorPageView({
  code,
  title,
  description,
  homeLabel,
  homeHref = '/',
  retryLabel,
  onRetry,
  fullScreen = false,
}: ErrorPageViewProps) {
  return (
    <Center
      component="section"
      aria-label={title}
      mih={fullScreen ? '100svh' : '50vh'}
      py="xl"
      px="md"
      style={{ flex: 1 }}
    >
      <Container size="sm">
        <Stack align="center" gap="lg">
          {code ? (
            <Text aria-hidden="true" fz="6rem" fw={700} c="dimmed" lh={1}>
              {code}
            </Text>
          ) : null}
          <Title order={1} ta="center">
            {title}
          </Title>
          <Text c="dimmed" ta="center">
            {description}
          </Text>
          <Group justify="center" gap="sm">
            {onRetry && retryLabel ? <Button onClick={onRetry}>{retryLabel}</Button> : null}
            <Button emphasis="low" component="a" href={homeHref}>
              {homeLabel}
            </Button>
          </Group>
        </Stack>
      </Container>
    </Center>
  );
}
