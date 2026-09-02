'use client';

import { Group, Text } from '@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconRestore,
  IconVolume,
} from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { Tooltip } from '@/components/core/Tooltip';
import classes from './ExecutableRuntimeControls.module.css';

export function ExecutableBlockTitle({
  title,
  fallback,
  editable,
  onChange,
}: {
  title: string;
  fallback: string;
  editable: boolean;
  onChange?: (title: string) => void;
}) {
  const rowStyle: CSSProperties = {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    flex: '1 1 12rem',
    minWidth: 0,
    height: 20,
    margin: 0,
    padding: 0,
    color: 'var(--mantine-color-text)',
    background: 'transparent',
    lineHeight: 1.4,
  };

  if (editable) {
    return (
      <div data-executable-title="" style={rowStyle}>
        <TextInput
          animate={false}
          classNames={{ root: classes.titleRoot, wrapper: classes.titleWrapper, input: classes.titleInput }}
          data-core-executable-title-input=""
          value={title.trim() ? title : fallback}
          aria-label={fallback}
          onFocus={(event) => {
            if (!title.trim()) {
              event.currentTarget.select();
            }
          }}
          onChange={(event) => onChange?.(event.currentTarget.value)}
        />
      </div>
    );
  }

  return (
    <Text component="figcaption" data-executable-title="" style={rowStyle} fw={600} size="sm" truncate>
      {title.trim() || fallback}
    </Text>
  );
}

export interface ExecutableRuntimeControlLabels {
  run: string;
  stop: string;
  restart: string;
  resetOriginal: string;
}

export function ExecutableRuntimeStatus({
  status,
  running,
  stopped,
}: {
  status: 'starting' | 'running' | 'stopped' | 'error';
  running: string;
  stopped: string;
}) {
  return (
    <span
      data-executable-runtime-status=""
      aria-live="polite"
      style={{
        position: 'absolute',
        zIndex: 1,
        insetBlockStart: 6,
        insetInlineStart: 8,
        margin: 0,
        padding: '2px 5px',
        color: 'var(--mantine-color-dimmed)',
        background: 'color-mix(in srgb, var(--mantine-color-body) 85%, transparent)',
        fontSize: 'var(--mantine-font-size-xs)',
        fontWeight: 400,
        lineHeight: 1.55,
      }}
    >
      {status === 'running' || status === 'starting' ? running : status === 'stopped' ? stopped : ''}
    </span>
  );
}

export function ExecutableIconControl({
  label,
  onClick,
  children,
  tone = 'neutral',
  pressed,
  className,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: 'accent' | 'neutral';
  pressed?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip label={label} withArrow>
      <IconButton
        label={label}
        title={label}
        size="sm"
        tone={tone}
        emphasis="low"
        aria-pressed={pressed}
        className={className}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
}

export function ExecutableRuntimeControls({
  className,
  labels,
  running,
  onRun,
  onStop,
  onRestart,
  onResetOriginal,
  resetDisabled,
  sourceControl,
  copyControl,
  applyControl,
  type,
  audioControl,
  capabilityControl,
}: {
  className?: string;
  labels: ExecutableRuntimeControlLabels;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  onRestart: () => void;
  onResetOriginal?: () => void;
  resetDisabled?: boolean;
  sourceControl?: { label: string; expanded: boolean; onClick: () => void };
  copyControl?: { label: string; onClick: () => void };
  applyControl?: { label: string; disabled?: boolean; onClick: () => void };
  type: 'p5Sketch' | 'threeScene' | 'shader';
  audioControl?: { label: string; onClick: () => void; pressed?: boolean };
  capabilityControl?: ReactNode;
}) {
  return (
    <Group className={className} justify="space-between" gap="xs" wrap="nowrap" data-runtime-controls={type}>
      <Group gap={2} wrap="nowrap">
        {running ? (
          <ExecutableIconControl label={labels.stop} onClick={onStop}>
            <IconPlayerStop size={16} aria-hidden />
          </ExecutableIconControl>
        ) : (
          <ExecutableIconControl label={labels.run} tone="accent" onClick={onRun}>
            <IconPlayerPlay size={16} aria-hidden />
          </ExecutableIconControl>
        )}
        <ExecutableIconControl label={labels.restart} tone="accent" onClick={onRestart}>
          <IconRefresh size={16} aria-hidden />
        </ExecutableIconControl>
        {capabilityControl}
        {sourceControl ? (
          <ExecutableIconControl
            label={sourceControl.label}
            pressed={sourceControl.expanded}
            tone={sourceControl.expanded ? 'accent' : 'neutral'}
            onClick={sourceControl.onClick}
          >
            {sourceControl.expanded ? (
              <IconChevronUp size={16} aria-hidden />
            ) : (
              <IconChevronDown size={16} aria-hidden />
            )}
          </ExecutableIconControl>
        ) : null}
        {onResetOriginal ? (
          <ExecutableIconControl label={labels.resetOriginal} disabled={resetDisabled} onClick={onResetOriginal}>
            <IconRestore size={16} aria-hidden />
          </ExecutableIconControl>
        ) : null}
        {audioControl ? (
          <ExecutableIconControl
            label={audioControl.label}
            tone={audioControl.pressed ? 'accent' : 'neutral'}
            pressed={audioControl.pressed}
            onClick={audioControl.onClick}
          >
            <IconVolume size={16} aria-hidden />
          </ExecutableIconControl>
        ) : null}
      </Group>
      {copyControl || applyControl ? (
        <Group gap={2} wrap="nowrap">
          {copyControl ? (
            <ExecutableIconControl label={copyControl.label} onClick={copyControl.onClick}>
              <IconCopy size={16} aria-hidden />
            </ExecutableIconControl>
          ) : null}
          {applyControl ? (
            <ExecutableIconControl
              label={applyControl.label}
              tone="accent"
              disabled={applyControl.disabled}
              onClick={applyControl.onClick}
            >
              <IconCheck size={16} aria-hidden />
            </ExecutableIconControl>
          ) : null}
        </Group>
      ) : null}
    </Group>
  );
}
