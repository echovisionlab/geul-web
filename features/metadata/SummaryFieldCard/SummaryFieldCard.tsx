'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import {
  AIEditorTurnTerminalStatus,
  type AIEditorDocumentToolApprovalRequired,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { IconCircleCheck, IconLoader2, IconSparkles } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import type * as Y from 'yjs';
import { Box, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Textarea } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { StatusBadge, type StatusBadgeTone } from '@/components/core/Badge';
import { Tooltip } from '@/components/core/Tooltip';
import type { MetadataEntityType } from '@/features/metadata/metadata-ai-debug';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import {
  createBrowserAIEditorAssistantClient,
  type AIEditorAssistantClient,
  type AIEditorTurn,
} from '@/lib/ai/editor-orchestration';
import { extractExactSummaryProposal } from '@/lib/ai/summary-proposal';
import { useCollaborativeMetadataAiState } from '@/lib/hooks/useCollaborativeMetadataAiState';

interface SummaryFieldCardProps {
  entityType: MetadataEntityType;
  entityId: string;
  title: string;
  summary: string;
  summaryReadOnly?: boolean;
  hideAiActions?: boolean;
  aiPromptAdditions?: string[];
  aiTarget?: AIDocumentTarget;
  aiClient?: AIEditorAssistantClient;
  provider?: HocuspocusProvider | null;
  doc?: Y.Doc | null;
  currentMemberId?: string;
  currentMemberDisplayName?: string;
  onSummaryChange?: (summary: string) => void;
}

type SummaryAIStatus = 'idle' | 'generating' | 'ready' | 'applying' | 'applied';
type SummaryTranslate = ReturnType<typeof useTranslations<'summaryField'>>;

function buildStatusLabel(t: SummaryTranslate, status: SummaryAIStatus) {
  return t(`status.${status}`);
}

function badgeColorForStatus(status: SummaryAIStatus): StatusBadgeTone {
  switch (status) {
    case 'generating':
    case 'applying':
      return 'accent';
    case 'ready':
    case 'applied':
      return 'positive';
    case 'idle':
    default:
      return 'neutral';
  }
}

function summaryPrompt(additions: readonly string[]): string | undefined {
  const prompt = additions
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');
  return prompt || undefined;
}

export function SummaryFieldCard({
  entityType,
  entityId,
  summary,
  summaryReadOnly = false,
  hideAiActions = false,
  aiPromptAdditions = [],
  aiTarget,
  aiClient,
  provider = null,
  doc = null,
  currentMemberId,
  currentMemberDisplayName,
  onSummaryChange,
}: SummaryFieldCardProps) {
  const t = useTranslations('summaryField');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonActions = useTranslations('common.actions');
  const browserClient = useMemo(() => createBrowserAIEditorAssistantClient(), []);
  const client = aiClient ?? browserClient;
  const [approval, setApproval] = useState<AIEditorDocumentToolApprovalRequired | null>(null);
  const [proposedSummary, setProposedSummary] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ color: 'red' | 'teal'; message: string } | null>(null);
  const [recentlyApplied, setRecentlyApplied] = useState(false);
  const turnRef = useRef<AIEditorTurn | null>(null);
  const generationRef = useRef<string | null>(null);
  const turnVersionRef = useRef(0);
  const dismissedRef = useRef(false);

  const collaborativeAi = useCollaborativeMetadataAiState(
    doc,
    provider,
    currentMemberId && currentMemberDisplayName
      ? {
          currentMemberId,
          currentMemberDisplayName,
        }
      : null,
  );

  const clearTurnState = useCallback(
    (generationId: string | null) => {
      if (generationId) {
        collaborativeAi.clearState(generationId);
      }
      generationRef.current = null;
      turnRef.current = null;
      setApproval(null);
      setProposedSummary(null);
    },
    [collaborativeAi],
  );

  useEffect(
    () => () => {
      turnVersionRef.current += 1;
      void turnRef.current?.cancel().catch(() => undefined);
      turnRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!recentlyApplied) {
      return;
    }
    const timeout = window.setTimeout(() => setRecentlyApplied(false), 2_000);
    return () => window.clearTimeout(timeout);
  }, [recentlyApplied]);

  const canGenerate =
    !summaryReadOnly &&
    Boolean(aiTarget && currentMemberId && currentMemberDisplayName && doc && provider) &&
    collaborativeAi.sharedState.status === 'idle';
  const visualStatus: SummaryAIStatus = recentlyApplied ? 'applied' : collaborativeAi.sharedState.status;
  const requesterNickname =
    collaborativeAi.sharedState.requesterNickname || collaborativeAi.sharedState.requesterMemberId;
  const generationTooltip =
    collaborativeAi.sharedState.status === 'idle'
      ? t('actions.generate')
      : requesterNickname
        ? t('tooltips.generatingNamed', { name: requesterNickname })
        : t('feedback.alreadyRunning');

  const startGeneration = useCallback(async () => {
    if (!canGenerate || !aiTarget) {
      return;
    }

    const generationId = collaborativeAi.startGeneration(['summary'], true);
    if (!generationId) {
      notifications.show({ message: generationTooltip, color: 'yellow' });
      return;
    }

    const turnVersion = ++turnVersionRef.current;
    generationRef.current = generationId;
    dismissedRef.current = false;
    setApproval(null);
    setProposedSummary(null);
    setFeedback(null);
    setRecentlyApplied(false);

    let accepted = false;
    let terminal = false;
    try {
      const turn = await client.start({
        target: aiTarget,
        selection: { mode: 'modify', blockHandles: [] },
        action: 'generate-summary',
        prompt: summaryPrompt(aiPromptAdditions),
      });
      if (turnVersion !== turnVersionRef.current) {
        await turn.cancel();
        return;
      }
      turnRef.current = turn;

      for await (const event of turn.events) {
        if (turnVersion !== turnVersionRef.current) {
          return;
        }
        switch (event.event.case) {
          case 'approvalRequired': {
            const mutation = event.event.value.mutation;
            const nextSummary = mutation ? extractExactSummaryProposal(aiTarget, mutation) : null;
            if (!nextSummary) {
              throw new Error('AI summary proposal is not an exact locale-owned summary mutation');
            }
            setApproval(event.event.value);
            setProposedSummary(nextSummary);
            collaborativeAi.markReady(generationId, ['summary'], true);
            setFeedback({ color: 'teal', message: t('feedback.readyToApply') });
            break;
          }
          case 'documentResult':
            setApproval(null);
            setProposedSummary(null);
            if (event.event.value.result.case !== 'accepted') {
              throw new Error(t('feedback.staleSuggestion'));
            }
            accepted = true;
            setFeedback({ color: 'teal', message: t('feedback.applied') });
            setRecentlyApplied(true);
            collaborativeAi.clearState(generationId);
            break;
          case 'terminal':
            terminal = true;
            turnRef.current = null;
            if (event.event.value.status === AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_CANCELLED) {
              clearTurnState(generationId);
              return;
            }
            if (event.event.value.status !== AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_COMPLETED) {
              throw new Error(t('feedback.failedDefault'));
            }
            if (!accepted) {
              throw new Error(t('feedback.missingSuggestionPayload'));
            }
            clearTurnState(generationId);
            return;
          default:
            break;
        }
      }
      if (!terminal) {
        throw new Error(t('feedback.failedDefault'));
      }
    } catch (value) {
      if (turnVersion !== turnVersionRef.current) {
        return;
      }
      clearTurnState(generationId);
      if (dismissedRef.current) {
        dismissedRef.current = false;
        setFeedback(null);
        return;
      }
      const message = value instanceof Error ? value.message : t('feedback.failedDefault');
      setFeedback({ color: 'red', message });
      notifications.show({ message, color: 'red' });
    }
  }, [aiPromptAdditions, aiTarget, canGenerate, clearTurnState, client, collaborativeAi, generationTooltip, t]);

  const handleApplySuggestion = useCallback(async () => {
    const turn = turnRef.current;
    const generationId = generationRef.current;
    if (!turn || !approval || !generationId || !collaborativeAi.isRequester) {
      return;
    }
    if (!collaborativeAi.markApplying(generationId)) {
      notifications.show({ message: t('feedback.unableToApplyNow'), color: 'red' });
      return;
    }
    try {
      await turn.resolve(approval.toolCallId, 'approve');
    } catch (value) {
      collaborativeAi.updateReadyFields(generationId, ['summary'], true);
      const message = value instanceof Error ? value.message : t('feedback.applyFailed');
      setFeedback({ color: 'red', message });
      notifications.show({ message, color: 'red' });
    }
  }, [approval, collaborativeAi, t]);

  const handleDismissSuggestion = useCallback(async () => {
    const turn = turnRef.current;
    const generationId = generationRef.current;
    if (!turn || !approval || !generationId || !collaborativeAi.isRequester) {
      return;
    }
    dismissedRef.current = true;
    try {
      await turn.resolve(approval.toolCallId, 'deny');
      await turn.cancel();
    } catch {
      // Local cleanup is authoritative for a dismissed transient Browser turn.
    } finally {
      clearTurnState(generationId);
      setFeedback(null);
    }
  }, [approval, clearTurnState, collaborativeAi.isRequester]);

  const generateIcon =
    collaborativeAi.sharedState.status === 'generating' || collaborativeAi.sharedState.status === 'applying' ? (
      <IconLoader2 size={16} className="animate-spin" />
    ) : (
      <IconSparkles size={16} />
    );

  return (
    <SectionCard>
      <Stack gap="md">
        <SectionHeader
          title={tCommonLabels('summary')}
          description={t('description')}
          actions={
            hideAiActions ? null : (
              <Group gap="xs" wrap="nowrap">
                <StatusBadge
                  id={`${entityType}-${entityId}-metadata-generation-status`}
                  data-metadata-ai-status={visualStatus}
                  tone={badgeColorForStatus(visualStatus)}
                >
                  {buildStatusLabel(t, visualStatus)}
                </StatusBadge>
                <Tooltip label={generationTooltip}>
                  <Box
                    component="span"
                    style={{ display: 'inline-flex' }}
                    data-testid={`${entityType}-${entityId}-generate-summary-trigger`}
                  >
                    <IconButton
                      id={`${entityType}-${entityId}-generate-all-metadata`}
                      aria-label={t('actions.generate')}
                      onClick={() => void startGeneration()}
                      disabled={!canGenerate}
                      size="lg"
                      tone="neutral"
                      emphasis="low"
                    >
                      {generateIcon}
                    </IconButton>
                  </Box>
                </Tooltip>
              </Group>
            )
          }
        />

        <Textarea
          id={`${entityType}-${entityId}-summary`}
          value={summary}
          onChange={(event) => onSummaryChange?.(event.currentTarget.value)}
          rows={3}
          readOnly={summaryReadOnly}
          placeholder={t('placeholders.summary')}
        />

        {!hideAiActions &&
        !collaborativeAi.isRequester &&
        (collaborativeAi.sharedState.status === 'ready' || collaborativeAi.sharedState.status === 'applying') ? (
          <Text size="xs" c="dimmed">
            {t('ready.anotherCollaboratorNamed', {
              name: requesterNickname || t('ready.anotherCollaborator'),
            })}
          </Text>
        ) : null}

        {!hideAiActions && approval && proposedSummary && collaborativeAi.isRequester ? (
          <SectionCard p="sm">
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                {t('ready.title')}
              </Text>
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  {t('ready.suggestedSummary')}
                </Text>
                <Text size="sm">{proposedSummary}</Text>
              </Stack>
              <Group>
                <Button
                  id={`${entityType}-${entityId}-apply-ai-metadata`}
                  leftSection={<IconCircleCheck size={16} />}
                  disabled={collaborativeAi.sharedState.status === 'applying'}
                  onClick={() => void handleApplySuggestion()}
                >
                  {t('actions.apply')}
                </Button>
                <Button
                  id={`${entityType}-${entityId}-dismiss-ai-metadata`}
                  tone="neutral"
                  emphasis="medium"
                  disabled={collaborativeAi.sharedState.status === 'applying'}
                  onClick={() => void handleDismissSuggestion()}
                >
                  {tCommonActions('dismiss')}
                </Button>
              </Group>
            </Stack>
          </SectionCard>
        ) : null}

        {feedback ? (
          <Text size="xs" c={feedback.color === 'red' ? 'red' : 'teal'}>
            {feedback.message}
          </Text>
        ) : null}
      </Stack>
    </SectionCard>
  );
}
