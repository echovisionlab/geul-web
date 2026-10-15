'use client';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
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
import type { ReactNode } from 'react';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { Tooltip } from '@/components/core/Tooltip';
import { LabelBadge } from '@/components/core/Badge';
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
  if (editable) {
    return (
      <DsLayoutInline flexible gap="none" data-executable-title="">
        <TextInput
          animate={false}
          data-executable-title-input=""
          value={title}
          placeholder={fallback}
          aria-label={fallback}
          onChange={(event) => onChange?.(event.currentTarget.value)}
        />
      </DsLayoutInline>
    );
  }
  return (
    <div className={classes.titleDisplay}>
      <Text as="figcaption" flexible data-executable-title="" size="sm" truncate>
        {title.trim() || fallback}
      </Text>
    </div>
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
    <LabelBadge placement="overlay-start" size="sm" data-executable-runtime-status="" aria-live="polite">
      {status === 'running' || status === 'starting' ? running : status === 'stopped' ? stopped : ''}
    </LabelBadge>
  );
}
export function ExecutableIconControl({
  label,
  onClick,
  children,
  tone = 'neutral',
  pressed,
  className: _className,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** Command tone; toggles (`pressed`) use the Core-owned selected appearance instead. */
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
        {...(pressed === undefined ? { tone, emphasis: 'low' as const } : { pressed })}
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
  sourceControl?: {
    label: string;
    expanded: boolean;
    onClick: () => void;
  };
  copyControl?: {
    label: string;
    onClick: () => void;
  };
  applyControl?: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
  };
  type: 'p5Sketch' | 'threeScene' | 'shader';
  audioControl?: {
    label: string;
    onClick: () => void;
    pressed?: boolean;
  };
  capabilityControl?: ReactNode;
}) {
  return (
    <div className={className}>
      <DsLayoutInline justify="between" gap="xs" wrap="nowrap" data-runtime-controls={type}>
        <DsLayoutInline gap="xxs" wrap="nowrap">
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
              pressed={audioControl.pressed}
              onClick={audioControl.onClick}
            >
              <IconVolume size={16} aria-hidden />
            </ExecutableIconControl>
          ) : null}
        </DsLayoutInline>
        {copyControl || applyControl ? (
          <DsLayoutInline gap="xxs" wrap="nowrap">
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
          </DsLayoutInline>
        ) : null}
      </DsLayoutInline>
    </div>
  );
}
