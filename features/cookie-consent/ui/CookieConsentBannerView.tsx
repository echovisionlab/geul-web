'use client';

import { useId } from 'react';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutContainer,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { SectionCard } from '@/components/core/Section';
import { NavigationLink as Anchor } from '@/components/core/Navigation';
import { TextButton } from '@/components/core/TextButton';

export interface CookieConsentLearnMoreSegment {
  text: string;
  href?: '/privacy' | '/terms';
}

export interface CookieConsentBannerViewModel {
  isOpen: boolean;
  requiresRenewal: boolean;
  labels: {
    renewalNotice: string;
    intro: string;
    rejectNonEssential: string;
    analytics: string;
    acceptAll: string;
  };
  learnMore: CookieConsentLearnMoreSegment[];
}

interface CookieConsentBannerViewProps {
  model: CookieConsentBannerViewModel;
  onRejectNonEssential: () => void;
  onAcceptAll: () => void;
}

export function CookieConsentBannerView({ model, onRejectNonEssential, onAcceptAll }: CookieConsentBannerViewProps) {
  const noticeId = useId();
  if (!model.isOpen) {
    return null;
  }

  return (
    <aside
      aria-labelledby={noticeId}
      className="print-hide"
      style={{
        position: 'fixed',
        left: 'var(--geul-spacing-md)',
        right: 'var(--geul-spacing-md)',
        bottom: 'calc(var(--geul-spacing-md) + env(safe-area-inset-bottom, 0px))',
        margin: '0 auto',
        zIndex: 'var(--geul-layer-banner)',
      }}
    >
      <LayoutContainer size="compact" inset="none">
        <SectionCard padding="sm" withBorder>
          <DsLayoutStack gap="xs">
            {model.requiresRenewal ? (
              <DsText id={noticeId} size="xs" weight="medium" data-testid="cookie-consent-renewal-notice">
                {model.labels.renewalNotice}
              </DsText>
            ) : (
              <DsText id={noticeId} size="xs">
                {model.labels.intro}
              </DsText>
            )}

            {model.requiresRenewal && <DsText size="xs">{model.labels.intro}</DsText>}

            <DsText size="xs" tone="secondary">
              {model.labels.analytics}
            </DsText>
            <DsLayoutInline gap="action-group" justify="between">
              <DsText size="xs" tone="secondary">
                {model.learnMore.map((segment, index) =>
                  segment.href ? (
                    <Anchor key={`${segment.href}-${index}`} href={segment.href} size="xs">
                      {segment.text}
                    </Anchor>
                  ) : (
                    <span key={`text-${index}`}>{segment.text}</span>
                  ),
                )}
              </DsText>

              <DsLayoutInline gap="action-group" wrap="nowrap">
                <TextButton
                  id="cookie-consent-reject-non-essential"
                  size="xs"
                  controlSize="xs"
                  density="chrome"
                  weight="medium"
                  aria-describedby={noticeId}
                  onClick={onRejectNonEssential}
                >
                  {model.labels.rejectNonEssential}
                </TextButton>
                <TextButton
                  size="xs"
                  controlSize="xs"
                  density="chrome"
                  weight="medium"
                  aria-describedby={noticeId}
                  data-testid="cookie-consent-accept-all"
                  onClick={onAcceptAll}
                >
                  {model.labels.acceptAll}
                </TextButton>
              </DsLayoutInline>
            </DsLayoutInline>
          </DsLayoutStack>
        </SectionCard>
      </LayoutContainer>
    </aside>
  );
}
