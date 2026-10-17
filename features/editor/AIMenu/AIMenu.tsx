'use client';

import { SectionCard as EditorDsSectionCard } from '@/components/core/Section';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconAbc,
  IconArrowRight,
  IconBulb,
  IconCheck,
  IconFileText,
  IconGripVertical,
  IconLanguage,
  IconPencil,
  IconPlayerPlay,
  IconRefresh,
  IconSparkles,
  IconWand,
  IconX,
} from '@tabler/icons-react';
import {
  AIEditorTurnTerminalStatus,
  type AIEditorDocumentToolApprovalRequired,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { useTranslations } from 'next-intl';
import { FloatingPanel } from '@/components/core/FloatingPanel';
import { Spinner as Loader, ScrollArea } from '@/components/core/Display';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import {
  describeAIDocumentOperation,
  proposalOperations,
  type AIEditorAssistantClient,
  type AIEditorTurn,
} from '@/lib/ai/editor-orchestration';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import type { AIEditorContext } from '@/lib/editor/ai-support';
import styles from './AIMenu.module.css';

const AI_FLOATING_WINDOW_DRAG_HANDLE_CLASS = 'ai-assistant-floating-drag-handle';
const AI_FLOATING_WINDOW_EXCLUDE_SELECTOR =
  'button:not([data-ai-floating-drag-handle]),input,textarea,select,a,[contenteditable="true"]';

type AIMenuState = 'input' | 'streaming' | 'approval' | 'resolving' | 'completed' | 'error';

interface AIMenuItem {
  label: string;
  icon: React.ReactNode;
  action: string;
}

interface AIMenuProps {
  client: AIEditorAssistantClient;
  context: AIEditorContext;
  target: AIDocumentTarget;
  onClose: () => void;
  dragHandleClassName?: string;
  initialAction?: string;
}

function selectedHandles(context: AIEditorContext): readonly string[] {
  // Generation is anchored to the current stable Block handle. An empty list
  // means whole-document context in the RPC and would lose the editor cursor anchor.
  return context.selectedBlockIds.length > 0 ? context.selectedBlockIds : [context.currentBlockId];
}

export function AIMenu({ client, context, target, onClose, dragHandleClassName, initialAction }: AIMenuProps) {
  const t = useTranslations('aiAssistant');
  const tCommonActions = useTranslations('common.actions');
  const [menuState, setMenuState] = useState<AIMenuState>('input');
  const [customPrompt, setCustomPrompt] = useState('');
  const [currentAction, setCurrentAction] = useState<string | null>(initialAction || null);
  const [assistantText, setAssistantText] = useState('');
  const [approval, setApproval] = useState<AIEditorDocumentToolApprovalRequired | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const turnRef = useRef<AIEditorTurn | null>(null);
  const turnGenerationRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialActionHandledRef = useRef(false);

  const menuItems: AIMenuItem[] =
    context.mode === 'modify'
      ? [
          { label: t('quickActions.improve'), icon: <IconPencil size={14} />, action: 'improve-writing' },
          { label: t('quickActions.fixSpelling'), icon: <IconAbc size={14} />, action: 'fix-spelling' },
          { label: t('quickActions.simplify'), icon: <IconWand size={14} />, action: 'simplify' },
          { label: t('quickActions.summarize'), icon: <IconFileText size={14} />, action: 'summarize' },
          {
            label: t('quickActions.translateKorean'),
            icon: <IconLanguage size={14} />,
            action: 'translate-korean',
          },
          {
            label: t('quickActions.translateEnglish'),
            icon: <IconLanguage size={14} />,
            action: 'translate-english',
          },
        ]
      : [
          {
            label: t('quickActions.continueWriting'),
            icon: <IconPlayerPlay size={14} />,
            action: 'continue-writing',
          },
          { label: t('quickActions.brainstorm'), icon: <IconBulb size={14} />, action: 'brainstorm' },
        ];

  useEffect(() => {
    if (menuState === 'input') {
      inputRef.current?.focus();
    }
  }, [menuState]);

  useEffect(
    () => () => {
      turnGenerationRef.current += 1;
      void turnRef.current?.cancel().catch(() => undefined);
      turnRef.current = null;
    },
    [],
  );

  const startTurn = useCallback(
    async (action: string, prompt?: string) => {
      const generation = ++turnGenerationRef.current;
      setCurrentAction(action);
      setAssistantText('');
      setApproval(null);
      setError(null);
      setMenuState('streaming');
      try {
        const turn = await client.start({
          target,
          selection: { mode: context.mode, blockHandles: selectedHandles(context) },
          action,
          prompt,
        });
        turnRef.current = turn;
        let receivedTerminal = false;
        for await (const event of turn.events) {
          if (generation !== turnGenerationRef.current) {
            return;
          }
          switch (event.event.case) {
            case 'assistantText':
              {
                const delta = event.event.value.text;
                setAssistantText((current) => current + delta);
              }
              break;
            case 'approvalRequired':
              if (!event.event.value.mutation) {
                throw new Error('AI editor approval is missing its document mutation');
              }
              setApproval(event.event.value);
              setMenuState('approval');
              break;
            case 'documentResult':
              setApproval(null);
              if (event.event.value.result.case === 'rejected') {
                throw new Error('The document changed before the AI mutation could be applied');
              }
              if (event.event.value.result.case !== 'accepted') {
                throw new Error('AI editor document result is missing its outcome');
              }
              setMenuState('streaming');
              break;
            case 'terminal':
              receivedTerminal = true;
              turnRef.current = null;
              setApproval(null);
              if (event.event.value.status === AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_COMPLETED) {
                setMenuState('completed');
              } else if (
                event.event.value.status === AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_CANCELLED
              ) {
                setMenuState('input');
              } else {
                throw new Error(t('errors.generic'));
              }
              break;
            default:
              break;
          }
        }
        if (!receivedTerminal && generation === turnGenerationRef.current) {
          throw new Error('AI editor stream ended without a terminal outcome');
        }
      } catch (value) {
        if (generation !== turnGenerationRef.current) {
          return;
        }
        const nextError = value instanceof Error ? value : new Error(String(value));
        turnRef.current = null;
        setError(nextError);
        setMenuState('error');
      }
    },
    [client, context, t, target],
  );

  useEffect(() => {
    if (!initialAction || initialAction === 'custom' || initialActionHandledRef.current) {
      return;
    }
    initialActionHandledRef.current = true;
    void startTurn(initialAction);
  }, [initialAction, startTurn]);

  const handleCustomPrompt = useCallback(() => {
    if (customPrompt.trim()) {
      void startTurn('custom', customPrompt.trim());
    }
  }, [customPrompt, startTurn]);

  const handleApprove = useCallback(async () => {
    const turn = turnRef.current;
    if (!turn || !approval) {
      return;
    }
    setMenuState('resolving');
    try {
      await turn.resolve(approval.toolCallId, 'approve');
    } catch (value) {
      setError(value instanceof Error ? value : new Error(String(value)));
      setMenuState('error');
      notifications.show({
        title: t('notifications.applyFailedTitle'),
        message: t('notifications.applyFailedMessage'),
        tone: 'danger',
      });
    }
  }, [approval, t]);

  const handleDeny = useCallback(async () => {
    const turn = turnRef.current;
    if (!turn || !approval) {
      return;
    }
    setMenuState('resolving');
    try {
      await turn.resolve(approval.toolCallId, 'deny');
      setApproval(null);
      setMenuState('streaming');
    } catch (value) {
      setError(value instanceof Error ? value : new Error(String(value)));
      setMenuState('error');
    }
  }, [approval]);

  const handleRetry = useCallback(async () => {
    if (!currentAction) {
      return;
    }
    turnGenerationRef.current += 1;
    try {
      await turnRef.current?.cancel();
    } catch (value) {
      setError(value instanceof Error ? value : new Error(String(value)));
      setMenuState('error');
      return;
    } finally {
      turnRef.current = null;
    }
    await startTurn(currentAction, currentAction === 'custom' ? customPrompt.trim() : undefined);
  }, [currentAction, customPrompt, startTurn]);

  const handleStop = useCallback(async () => {
    turnGenerationRef.current += 1;
    try {
      await turnRef.current?.cancel();
    } catch {
      // The stream is aborted by the client even when the cancellation RPC fails.
    } finally {
      turnRef.current = null;
      setApproval(null);
      setAssistantText('');
      setMenuState('input');
    }
  }, []);

  const placeholder = context.mode === 'modify' ? t('placeholders.modify') : t('placeholders.generate');
  const showInput = menuState === 'input' || menuState === 'streaming';

  return (
    <div style={{ width: 360, maxWidth: '100%' }}>
      <DsLayoutInset space="xs">
        <DsLayoutStack gap="xs">
          <div style={{ cursor: dragHandleClassName ? 'grab' : 'default' }}>
            <div className={dragHandleClassName}>
              <DsLayoutInline gap="xs" justify="between">
                <DsLayoutInline gap="xxs">
                  {dragHandleClassName && (
                    <IconButton
                      emphasis="low"
                      interaction="drag-handle"
                      draggable={false}
                      data-ai-floating-drag-handle
                      aria-label={tCommonActions('move')}
                      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
                    >
                      <IconGripVertical aria-hidden />
                    </IconButton>
                  )}
                  <IconSparkles size={16} color="var(--geul-action-primary)" />
                  <DsText size="sm" weight="medium">
                    {t('title')}
                  </DsText>
                  <DsText size="xs" tone="secondary">
                    ({context.mode === 'modify' ? t('modes.modify') : t('modes.generate')})
                  </DsText>
                </DsLayoutInline>
                <IconButton size="compact" emphasis="low" aria-label={t('actions.close')} onClick={onClose}>
                  <IconX size={14} />
                </IconButton>
              </DsLayoutInline>
            </div>
          </div>

          {showInput ? (
            <>
              <TextInput
                ref={inputRef}
                aria-label={placeholder}
                placeholder={placeholder}
                value={customPrompt}
                onChange={(event) => setCustomPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleCustomPrompt();
                  }
                }}
                size="sm"
                disabled={menuState === 'streaming'}
                rightSection={
                  menuState === 'streaming' ? (
                    <Loader size="xs" />
                  ) : (
                    <IconButton
                      size="compact"
                      emphasis="low"
                      aria-label={t('actions.submitPrompt')}
                      onClick={handleCustomPrompt}
                      disabled={!customPrompt.trim()}
                    >
                      <IconArrowRight size={14} />
                    </IconButton>
                  )
                }
              />
              {menuState === 'input' ? (
                <>
                  <DsText size="xs" weight="medium" tone="secondary">
                    {t('quickActions.title')}
                  </DsText>
                  <DsLayoutInline gap="xxs" wrap="wrap">
                    {menuItems.map((item) => (
                      <Button
                        key={item.action}
                        size="xs"
                        emphasis="medium"
                        leftSection={item.icon}
                        onClick={() => void startTurn(item.action)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </DsLayoutInline>
                </>
              ) : null}
              {assistantText ? (
                <DsText size="sm" aria-live="polite">
                  {assistantText}
                </DsText>
              ) : null}
              {menuState === 'streaming' ? (
                <Button
                  size="xs"
                  tone="danger"
                  emphasis="medium"
                  onClick={() => void handleStop()}
                  leftSection={<IconX size={14} />}
                  fullWidth
                >
                  {t('actions.stop')}
                </Button>
              ) : null}
            </>
          ) : null}

          {(menuState === 'approval' || menuState === 'resolving') && approval?.mutation ? (
            <>
              <EditorDsSectionCard padding="xs" withBorder>
                <DsLayoutInset blockEnd="xxs">
                  <DsText size="xs" tone="positive" weight="medium">
                    {t('sections.result')}
                  </DsText>
                </DsLayoutInset>
                {assistantText ? <DsText size="sm">{assistantText}</DsText> : null}
                {approval.summary ? (
                  <DsLayoutInset blockEnd="xs">
                    <DsText size="sm">{approval.summary}</DsText>
                  </DsLayoutInset>
                ) : null}
                <ScrollArea.Autosize size="compact">
                  <DsLayoutStack gap="xxs">
                    {proposalOperations(approval.mutation).map((operation, index) => (
                      <div key={index} className={styles.previewContent}>
                        <DsText size="sm">{describeAIDocumentOperation(operation)}</DsText>
                      </div>
                    ))}
                  </DsLayoutStack>
                </ScrollArea.Autosize>
              </EditorDsSectionCard>
              <DsLayoutInline gap="xs" grow>
                <Button
                  size="sm"
                  tone="neutral"
                  emphasis="medium"
                  onClick={() => void handleDeny()}
                  leftSection={<IconX size={14} />}
                  disabled={menuState === 'resolving'}
                >
                  {t('actions.reject')}
                </Button>
                <Button
                  size="sm"
                  tone="positive"
                  emphasis="medium"
                  onClick={() => void handleApprove()}
                  leftSection={menuState === 'resolving' ? <Loader size="xs" /> : <IconCheck size={14} />}
                  disabled={menuState === 'resolving'}
                >
                  {context.mode === 'modify' ? t('actions.accept') : t('actions.insert')}
                </Button>
              </DsLayoutInline>
            </>
          ) : null}

          {menuState === 'completed' ? (
            <>
              {assistantText ? (
                <EditorDsSectionCard padding="xs" withBorder>
                  <DsText size="sm">{assistantText}</DsText>
                </EditorDsSectionCard>
              ) : null}
              <Button size="sm" emphasis="medium" onClick={onClose}>
                {tCommonActions('close')}
              </Button>
            </>
          ) : null}

          {menuState === 'error' ? (
            <>
              <EditorDsSectionCard padding="xs" withBorder>
                <DsLayoutInset blockEnd="xxs">
                  <DsText size="xs" tone="danger" weight="medium">
                    {t('sections.result')}
                  </DsText>
                </DsLayoutInset>
                <DsText size="sm">{error?.message || t('errors.generic')}</DsText>
              </EditorDsSectionCard>
              <DsLayoutInline gap="xs">
                <Button size="xs" emphasis="medium" onClick={onClose}>
                  {tCommonActions('close')}
                </Button>
                <Button
                  size="xs"
                  emphasis="medium"
                  onClick={() => void handleRetry()}
                  leftSection={<IconRefresh size={14} />}
                >
                  {t('actions.retry')}
                </Button>
              </DsLayoutInline>
            </>
          ) : null}
        </DsLayoutStack>
      </DsLayoutInset>
    </div>
  );
}

interface AIAssistantProps {
  client: AIEditorAssistantClient;
  initialContext: AIEditorContext;
  initialAction?: string;
  position: { top: number; left: number };
  onClose: () => void;
  target: AIDocumentTarget;
}

export function AIAssistant({ client, initialContext, initialAction, position, onClose, target }: AIAssistantProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('aiAssistant');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <FloatingPanel
      label={t('title')}
      ref={menuRef}
      initialPosition={position}
      dragHandleSelector={`.${AI_FLOATING_WINDOW_DRAG_HANDLE_CLASS}`}
      excludeDragHandleSelector={AI_FLOATING_WINDOW_EXCLUDE_SELECTOR}
      constrainToViewport
    >
      <AIMenu
        client={client}
        context={initialContext}
        target={target}
        onClose={onClose}
        dragHandleClassName={AI_FLOATING_WINDOW_DRAG_HANDLE_CLASS}
        initialAction={initialAction}
      />
    </FloatingPanel>
  );
}
