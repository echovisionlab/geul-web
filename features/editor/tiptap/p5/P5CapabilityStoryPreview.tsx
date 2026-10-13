'use client';

import { SectionCard as EditorDsSectionCard } from '@/components/core/Section';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { Alert } from '@/components/core/Alert';
import { StatusBadge } from '@/components/core/Badge';
import classes from './P5CapabilityStoryPreview.module.css';

export type P5StoryCapability = 'microphone' | 'camera';

export function P5MouseInteractionStoryGuide({ source }: { source: string }) {
  return (
    <div className={classes.root} data-testid="mouse-interaction-guide">
      <EditorDsSectionCard padding="md" withBorder>
        <DsLayoutStack gap="sm">
          <DsLayoutInline justify="between" align="start" wrap="wrap">
            <div>
              <DsText weight="strong">마우스 입력 직접 검수</DsText>
              <DsText size="sm" tone="secondary">
                캔버스 안에서 포인터를 움직인 뒤 클릭하세요.
              </DsText>
            </div>
            <StatusBadge tone="accent">수동 관찰</StatusBadge>
          </DsLayoutInline>

          <Alert tone="accent" title="관찰할 값">
            원이 포인터 위치를 따라가고, 캔버스 아래의 ‘클릭 N회’가 클릭할 때마다 1씩 증가합니다.
          </Alert>

          <div>
            <DsLayoutInset blockEnd="xxs">
              <DsText as="div" size="sm" weight="strong">
                실행 중인 예제 소스
              </DsText>
            </DsLayoutInset>
            <pre className={classes.source} aria-label="마우스 p5.js 예제 소스">
              <code>{source}</code>
            </pre>
          </div>

          <DsText size="xs" tone="secondary">
            자동 play는 opaque iframe의 실행 상태와 소스만 확인합니다. 격리 경계를 우회해 포인터 값이나 캔버스 픽셀을
            성공한 것처럼 판정하지 않으며, 위 변화는 이 Story에서 직접 확인합니다.
          </DsText>
        </DsLayoutStack>
      </EditorDsSectionCard>
    </div>
  );
}
