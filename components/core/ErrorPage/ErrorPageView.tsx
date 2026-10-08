import type { ReactNode } from 'react';
import { Center, Container, Group, Stack, Text, Title } from '@mantine/core';
import { Button } from '../Button';

export type ErrorPageAction = { label: string } & (
  { href: string; onClick?: never } | { onClick: () => void; href?: never }
);

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
    <Center
      component="section"
      aria-label={title}
      data-error-page
      mih={fullScreen ? '100svh' : '50vh'}
      py="xl"
      px="md"
      style={{ flex: 1 }}
    >
      <Container size="sm">
        <Stack align="center" gap="lg">
          {codeVisual ??
            (code ? (
              <Text aria-hidden="true" fz="6rem" fw={700} ta="center" c="dimmed">
                {code}
              </Text>
            ) : null)}
          <Title order={1} ta="center">
            {title}
          </Title>
          {description ? (
            <Text c="dimmed" ta="center" size="sm">
              {description}
            </Text>
          ) : null}
          <Group justify="center" gap="sm">
            {actions.map((action, index) =>
              action.href !== undefined ? (
                <Button key={index} emphasis="low" component="a" href={action.href}>
                  {action.label}
                </Button>
              ) : (
                <Button key={index} emphasis="low" onClick={action.onClick}>
                  {action.label}
                </Button>
              ),
            )}
          </Group>
        </Stack>
      </Container>
    </Center>
  );
}
