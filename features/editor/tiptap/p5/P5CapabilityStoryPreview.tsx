'use client';

import { Group, Paper, Stack, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { StatusBadge } from '@/components/core/Badge';
import classes from './P5CapabilityStoryPreview.module.css';

export type P5StoryCapability = 'microphone' | 'camera';

export function P5MouseInteractionStoryGuide({ source }: { source: string }) {
  return (
    <Paper className={classes.root} p="md" radius={0} withBorder data-testid="mouse-interaction-guide">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Text fw={600}>마우스 입력 직접 검수</Text>
            <Text size="sm" c="dimmed">
              캔버스 안에서 포인터를 움직인 뒤 클릭하세요.
            </Text>
          </div>
          <StatusBadge tone="accent">수동 관찰</StatusBadge>
        </Group>

        <Alert tone="accent" title="관찰할 값">
          원이 포인터 위치를 따라가고, 캔버스 아래의 ‘클릭 N회’가 클릭할 때마다 1씩 증가합니다.
        </Alert>

        <div>
          <Text component="div" size="sm" fw={600} mb={4}>
            실행 중인 예제 소스
          </Text>
          <pre className={classes.source} aria-label="마우스 p5.js 예제 소스">
            <code>{source}</code>
          </pre>
        </div>

        <Text size="xs" c="dimmed">
          자동 play는 opaque iframe의 실행 상태와 소스만 확인합니다. 격리 경계를 우회해 포인터 값이나 캔버스 픽셀을
          성공한 것처럼 판정하지 않으며, 위 변화는 이 Story에서 직접 확인합니다.
        </Text>
      </Stack>
    </Paper>
  );
}
