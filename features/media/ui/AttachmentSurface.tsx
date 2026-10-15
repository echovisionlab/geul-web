'use client';

import type { ReactNode } from 'react';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SectionCard } from '@/components/core/Section';
import { Text } from '@/components/core/Typography';
import { MediaBlockMetaText } from './MediaBlockShell';
import './AttachmentSurface.css';

interface AttachmentSurfaceProps {
  title: ReactNode;
  meta: string;
  metaEnd?: ReactNode;
  action?: ReactNode;
  belowHeader?: ReactNode;
}

export function AttachmentSurface({ title, meta, metaEnd, action, belowHeader }: AttachmentSurfaceProps) {
  return (
    <div className="attachment-block__surface">
      <SectionCard padding="sm" border="all" appearance="surface">
        <LayoutStack gap="xs">
          <LayoutStack gap="xxs">
            <LayoutInline align="center" justify="between" gap="sm" wrap="nowrap">
              <Text size="sm" weight="strong" truncate flexible>
                {title}
              </Text>
              {action ? (
                <LayoutInline gap="none" shrink={false}>
                  {action}
                </LayoutInline>
              ) : null}
            </LayoutInline>
            <LayoutInline align="baseline" justify="between" gap="sm" wrap="nowrap">
              <LayoutStack gap="none" flexible>
                <MediaBlockMetaText className="attachment-meta">{meta}</MediaBlockMetaText>
              </LayoutStack>
              {metaEnd !== undefined ? (
                <LayoutInline gap="none" shrink={false}>
                  {metaEnd}
                </LayoutInline>
              ) : null}
            </LayoutInline>
          </LayoutStack>
          {belowHeader}
        </LayoutStack>
      </SectionCard>
    </div>
  );
}
