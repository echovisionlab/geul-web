'use client';
import { SupportingText, Text } from '../Typography';
import type { ClosedVisualProps } from '../visual-contract';
import type { CSSProperties, ReactNode } from 'react';
import { LayoutInline, LayoutStack } from '../Layout';
import { Spinner } from '../Display';
import { Progress } from '../Progress';

import { Button as AriaButton } from 'react-aria-components';
import classes from './UploadPlaceholder.module.css';
import uploadClasses from './ImageUpload.module.css';
export interface UploadPlaceholderProps extends ClosedVisualProps {
  icon: ReactNode;
  iconSize?: 'sm' | 'md' | 'lg';
  title?: string;
  description?: string;
  loading?: boolean;
  progress?: number;
  statusMessage?: string;
  width?: CSSProperties['width'];
  maxWidth?: CSSProperties['maxWidth'];
  height?: CSSProperties['height'];
  minHeight?: CSSProperties['minHeight'];
  aspectRatio?: CSSProperties['aspectRatio'];
  shape?: 'square' | 'circle';
  interactive?: boolean;
  dropActive?: boolean;
  compact?: boolean;
  showCompactText?: boolean;
  /**
   * Makes an interactive placeholder one native Core button (Enter/Space/pointer).
   * Its visible title and description form the accessible name unless `aria-label` is supplied.
   */
  onPress?: () => void;
  'aria-label'?: string;
}
export function UploadPlaceholder({
  icon,
  iconSize = 'md',
  title,
  description,
  loading = false,
  progress,
  statusMessage,
  width,
  maxWidth,
  height,
  minHeight,
  aspectRatio,
  shape = 'square',
  interactive = false,
  dropActive = false,
  compact = false,
  showCompactText = false,
  onPress,
  'aria-label': ariaLabel,
}: UploadPlaceholderProps) {
  const percent = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : null;
  const surface = (
    <div
      className={classes.surface}
      data-compact={compact || undefined}
      data-shape={shape}
      data-interactive={interactive || undefined}
      data-drop-active={dropActive || undefined}
      data-loading={loading || undefined}
      style={{ width, maxWidth, height, minHeight, aspectRatio }}
    >
      {loading ? (
        <LayoutStack gap={compact ? 'xxs' : 'xs'} align="center">
          <Spinner size={compact ? 'xs' : 'sm'} />
          {(!compact || showCompactText) && (title || statusMessage) ? (
            <div className={classes.text}>
              <LayoutInline gap="xxs" justify="center" wrap="nowrap">
                <SupportingText>{statusMessage ?? title}</SupportingText>
                {percent !== null ? <SupportingText tone="muted">{percent}%</SupportingText> : null}
              </LayoutInline>
              {percent !== null ? <Progress value={percent} size="sm" aria-label={(statusMessage ?? title)!} /> : null}
            </div>
          ) : null}
        </LayoutStack>
      ) : (
        <>
          <div className={classes.icon} data-size={iconSize} aria-hidden>
            {icon}
          </div>
          {(!compact || showCompactText) && (title || description) ? (
            <div className={classes.text}>
              {title ? (
                <Text size="sm" weight="medium" align="center">
                  {title}
                </Text>
              ) : null}
              {description ? (
                <SupportingText tone="muted" align="center">
                  {description}
                </SupportingText>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
  if (!onPress || !interactive || loading) {
    return surface;
  }
  return (
    <AriaButton className={uploadClasses.trigger} aria-label={ariaLabel} onPress={onPress}>
      {surface}
    </AriaButton>
  );
}
