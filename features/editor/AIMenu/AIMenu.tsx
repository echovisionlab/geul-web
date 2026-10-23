'use client';

import { SectionCard as EditorDsSectionCard } from '@/components/core/Section';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
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
} from '@/lib/ai/editor-orchestration';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import type { AIEditorContext } from '@/lib/editor/ai-support';
import { createAIEditorTurnStore, type AIEditorTurnScope } from './ai-editor-turn-store';
import styles from './AIMenu.module.css';

const AI_FLOATING_WINDOW_DRAG_HANDLE_CLASS = 'ai-assistant-floating-drag-handle';
const AI_FLOATING_WINDOW_EXCLUDE_SELECTOR =
  'button:not([data-ai-floating-drag-handle]),input,textarea,select,a,[contenteditable="true"]';

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

interface AIEditorTurnBinding extends AIEditorTurnScope {
  initialAction?: string;
  onApproveFailed: () => void;
}

/** Runs one menu's turn store while mounted. */
function useAIEditorTurnStore({ client, target, context, initialAction, onApproveFailed }: AIEditorTurnBinding) {
  const scope = useRef<AIEditorTurnScope>({ client, target, context });
  scope.current = { client, target, context };
  const approveFailed = useRef(onApproveFailed);
  approveFailed.current = onApproveFailed;
  const [initial] = useState(initialAction);
  const [store] = useState(() =>
    createAIEditorTurnStore({
      scope: () => scope.current,
      initialAction: initial,
      onApproveFailed: () => approveFailed.current(),
    }),
  );
  useEffect(() => {
    // A remount, such as StrictMode's, starts the initial action again after dispose cancelled it.
    if (initial && initial !== 'custom') {
      void store.start(initial);
    }
    return () => store.dispose();
  }, [initial, store]);
  return { store, state: useStore(store.api) };
}

export function AIMenu({ client, context, target, onClose, dragHandleClassName, initialAction }: AIMenuProps) {
  const t = useTranslations('aiAssistant');
  const tCommonActions = useTranslations('common.actions');
  const [customPrompt, setCustomPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { store, state } = useAIEditorTurnStore({
    client,
    target,
    context,
    initialAction,
    onApproveFailed: () =>
      notifications.show({
        title: t('notifications.applyFailedTitle'),
        message: t('notifications.applyFailedMessage'),
        tone: 'danger',
      }),
  });
  const { phase, assistantText, approval } = state;

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
    if (phase === 'input') {
      inputRef.current?.focus();
    }
  }, [phase]);

  const submitCustomPrompt = () => {
    const prompt = customPrompt.trim();
    if (prompt) {
      void store.start('custom', prompt);
    }
  };

  const placeholder = context.mode === 'modify' ? t('placeholders.modify') : t('placeholders.generate');
  const showInput = phase === 'input' || phase === 'streaming';

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
                    submitCustomPrompt();
                  }
                }}
                size="sm"
                disabled={phase === 'streaming'}
                rightSection={
                  phase === 'streaming' ? (
                    <Loader size="xs" />
                  ) : (
                    <IconButton
                      size="compact"
                      emphasis="low"
                      aria-label={t('actions.submitPrompt')}
                      onClick={submitCustomPrompt}
                      disabled={!customPrompt.trim()}
                    >
                      <IconArrowRight size={14} />
                    </IconButton>
                  )
                }
              />
              {phase === 'input' ? (
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
                        onClick={() => void store.start(item.action)}
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
              {phase === 'streaming' ? (
                <Button
                  size="xs"
                  tone="danger"
                  emphasis="medium"
                  onClick={() => void store.stop()}
                  leftSection={<IconX size={14} />}
                  fullWidth
                >
                  {t('actions.stop')}
                </Button>
              ) : null}
            </>
          ) : null}

          {(phase === 'approval' || phase === 'resolving') && approval?.mutation ? (
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
                  onClick={() => void store.deny()}
                  leftSection={<IconX size={14} />}
                  disabled={phase === 'resolving'}
                >
                  {t('actions.reject')}
                </Button>
                <Button
                  size="sm"
                  tone="positive"
                  emphasis="medium"
                  onClick={() => void store.approve()}
                  leftSection={phase === 'resolving' ? <Loader size="xs" /> : <IconCheck size={14} />}
                  disabled={phase === 'resolving'}
                >
                  {context.mode === 'modify' ? t('actions.accept') : t('actions.insert')}
                </Button>
              </DsLayoutInline>
            </>
          ) : null}

          {phase === 'completed' ? (
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

          {phase === 'error' ? (
            <>
              <EditorDsSectionCard padding="xs" withBorder>
                <DsLayoutInset blockEnd="xxs">
                  <DsText size="xs" tone="danger" weight="medium">
                    {t('sections.result')}
                  </DsText>
                </DsLayoutInset>
                {/* Failure codes stay out of the menu: none of them helps the author, so every failure reads the same. */}
                <DsText size="sm">{t('errors.generic')}</DsText>
              </EditorDsSectionCard>
              <DsLayoutInline gap="xs">
                <Button size="xs" emphasis="medium" onClick={onClose}>
                  {tCommonActions('close')}
                </Button>
                <Button
                  size="xs"
                  emphasis="medium"
                  onClick={() => void store.retry(customPrompt)}
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
