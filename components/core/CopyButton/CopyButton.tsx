'use client';

import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from '../IconButton';
import type { IconButtonSize } from '../IconButton/IconButton';
import { Tooltip } from '../Tooltip';
import { VisuallyHidden } from '../Typography';
import type { ClosedVisualProps } from '../visual-contract';

/** Core owns how long the confirmed state remains visible. */
export const copyButtonConfirmationMs = 2000;

export interface CopyButtonProps extends ClosedVisualProps {
  /** Text written to the clipboard. A function reads the current value at press time. */
  value: string | (() => string);
  /** Stable accessible name and tooltip, for example "Copy URL". */
  label: string;
  /** Short confirmation shown in the tooltip and announced politely after a successful write. */
  copiedLabel: string;
  /** Called after the clipboard write succeeds. */
  onCopy?: (value: string) => void;
  /** Called when the clipboard is unavailable or rejects the write. The consumer owns recovery messaging. */
  onCopyError?: (error: unknown) => void;
  size?: IconButtonSize;
  disabled?: boolean;
  id?: string;
  'aria-describedby'?: string;
  [key: `data-${string}`]: string | number | boolean | undefined;
}

async function writeClipboard(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is unavailable');
  }
  await navigator.clipboard.writeText(text);
}

/** Icon command that copies text, confirms with a check glyph and announces the result. */
export function CopyButton({
  value,
  label,
  copiedLabel,
  onCopy,
  onCopyError,
  size,
  disabled = false,
  ...props
}: CopyButtonProps) {
  if (!label.trim() || !copiedLabel.trim()) {
    throw new TypeError('Core CopyButton requires nonempty label and copiedLabel');
  }
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);
  const copy = useCallback(async () => {
    const text = typeof value === 'function' ? value() : value;
    try {
      await writeClipboard(text);
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      if (timer.current) {
        clearTimeout(timer.current);
      }
      setCopied(false);
      onCopyError?.(error);
      return;
    }
    if (!mounted.current) {
      return;
    }
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), copyButtonConfirmationMs);
    onCopy?.(text);
  }, [onCopy, onCopyError, value]);
  const native = Object.fromEntries(
    Object.entries(props).filter(
      ([key]) =>
        key === 'id' || key === 'aria-describedby' || (key.startsWith('data-') && !/^data-(?:geul|core)-/.test(key)),
    ),
  );
  return (
    <>
      <Tooltip label={copied ? copiedLabel : label} disabled={disabled}>
        <IconButton
          {...native}
          label={label}
          size={size}
          tone={copied ? 'positive' : 'neutral'}
          emphasis="low"
          disabled={disabled}
          data-copied={copied || undefined}
          onClick={() => void copy()}
        >
          {copied ? <IconCheck size="1em" aria-hidden /> : <IconCopy size="1em" aria-hidden />}
        </IconButton>
      </Tooltip>
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {copied ? copiedLabel : ''}
      </VisuallyHidden>
    </>
  );
}
