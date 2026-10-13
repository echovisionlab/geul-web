'use client';

import { useEffect, useRef, useState } from 'react';
import { LayoutInline as DsLayoutInline, LayoutStack } from '@/components/core/Layout';
import { IconLink, IconTrash } from '@tabler/icons-react';

import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput } from '@/components/core/Input';
import { SocialIcon, type SocialPlatform } from '@/components/core/Social';
import { Popover } from '@/components/core/Popover';
import classes from './SocialLinkInputView.module.css';

export interface SocialPlatformOption {
  value: SocialPlatform;
  label: string;
}

export interface SocialLinkInputViewLabels {
  platformPlaceholder: string;
  valuePlaceholder: string;
  remove: string;
}

export interface SocialLinkInputViewProps {
  platform: string;
  value: string;
  platformOptions: SocialPlatformOption[];
  selectedPlatform: SocialPlatform | null;
  selectedValuePlaceholder: string | null;
  labels: SocialLinkInputViewLabels;
  platformId?: string;
  valueId?: string;
  removeButtonId?: string;
  onPlatformChange: (platform: string) => void;
  onValueChange: (value: string) => void;
  onValueBlur: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  disabled?: boolean;
  error?: string;
  platformWidth?: number;
}

export function SocialLinkInputView({
  platform,
  value,
  platformOptions,
  selectedPlatform,
  selectedValuePlaceholder,
  labels,
  platformId,
  valueId,
  removeButtonId,
  onPlatformChange,
  onValueChange,
  onValueBlur,
  onRemove,
  showRemove = true,
  disabled = false,
  error,
  platformWidth = 160,
}: SocialLinkInputViewProps) {
  const [pickerOpened, setPickerOpened] = useState(false);
  const compactPickerRef = useRef<HTMLDivElement>(null);
  const compactInputRef = useRef<HTMLInputElement>(null);
  const fullInputRef = useRef<HTMLInputElement>(null);
  const restoreWideFocus = useRef(false);
  const platformLabel = platformOptions.find((option) => option.value === platform)?.label;
  const platformName = platformLabel ? `${labels.platformPlaceholder}: ${platformLabel}` : labels.platformPlaceholder;
  const valueName = platformLabel ? `${platformLabel}: ${labels.valuePlaceholder}` : labels.valuePlaceholder;

  useEffect(() => {
    if (!pickerOpened && restoreWideFocus.current) {
      restoreWideFocus.current = false;
      const frame = requestAnimationFrame(() => fullInputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [pickerOpened]);
  useEffect(() => {
    if (disabled) {
      setPickerOpened(false);
    }
  }, [disabled]);
  useEffect(() => {
    if (!pickerOpened) {
      return;
    }
    compactInputRef.current?.focus();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (compactPickerRef.current && getComputedStyle(compactPickerRef.current).display === 'none') {
        restoreWideFocus.current = true;
        setPickerOpened(false);
      }
    });
    if (compactPickerRef.current?.parentElement?.parentElement) {
      observer.observe(compactPickerRef.current.parentElement.parentElement);
    }
    return () => observer.disconnect();
  }, [pickerOpened]);

  return (
    <div className={classes.container}>
      <DsLayoutInline gap="xxs" wrap="nowrap" flexible>
        <div className={classes.fullPicker} style={{ width: platformWidth }}>
          <Select
            ref={fullInputRef}
            size="xs"
            id={platformId}
            placeholder={labels.platformPlaceholder}
            aria-label={platformName}
            data={platformOptions}
            value={platform || null}
            onChange={(nextPlatform) => onPlatformChange(nextPlatform || '')}
            searchable
            disabled={disabled}
            leftSection={selectedPlatform ? <SocialIcon platform={selectedPlatform} size="md" /> : undefined}
          />
        </div>
        <div ref={compactPickerRef} className={classes.compactPicker}>
          <Popover size="compact" open={pickerOpened} onOpenChange={(open) => setPickerOpened(open && !disabled)}>
            <Popover.Target>
              <IconButton
                size="compact"
                id={platformId ? `${platformId}-picker` : undefined}
                aria-label={platformName}
                disabled={disabled}
              >
                {selectedPlatform ? <SocialIcon platform={selectedPlatform} size="md" /> : <IconLink aria-hidden />}
              </IconButton>
            </Popover.Target>
            <Popover.Dropdown padding="compact" aria-label={platformName}>
              <Select
                ref={compactInputRef}
                size="xs"
                density="compact"
                id={platformId ? `${platformId}-compact` : undefined}
                label={labels.platformPlaceholder}
                data={platformOptions}
                value={platform || null}
                onChange={(nextPlatform) => {
                  onPlatformChange(nextPlatform || '');
                  setPickerOpened(false);
                }}
                searchable
                disabled={disabled}
                leftSection={selectedPlatform ? <SocialIcon platform={selectedPlatform} size="md" /> : undefined}
              />
            </Popover.Dropdown>
          </Popover>
        </div>
        <LayoutStack gap="none" flexible fill="inline">
          <TextInput
            size="xs"
            id={valueId}
            placeholder={selectedValuePlaceholder ?? labels.valuePlaceholder}
            aria-label={valueName}
            value={value}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            onBlur={onValueBlur}
            disabled={disabled}
            error={error}
          />
        </LayoutStack>
        {showRemove && onRemove ? (
          <IconButton
            size="compact"
            id={removeButtonId}
            tone="danger"
            emphasis="low"
            aria-label={labels.remove}
            onClick={onRemove}
            disabled={disabled}
          >
            <IconTrash size={16} />
          </IconButton>
        ) : null}
      </DsLayoutInline>
    </div>
  );
}
