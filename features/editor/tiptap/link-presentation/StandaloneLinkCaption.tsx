'use client';

import { useEffect, useRef, useState } from 'react';
import { TextButton } from '@/components/core/TextButton';
import { TextInput } from '@/components/core/Input';
import { Text } from '@/components/core/Typography';

export interface StandaloneLinkCaptionLabels {
  addCaption: string;
  captionPlaceholder: string;
}

/**
 * The translatable caption under a link card or video, edited like the map
 * caption: a muted prompt or the caption itself, which opens a bare input.
 */
export function StandaloneLinkCaption({
  caption,
  labels,
  editable,
  showPrompt,
  onChange,
}: {
  caption: string;
  labels: StandaloneLinkCaptionLabels;
  /** Locale-owned text: translation editors may change it too. */
  editable: boolean;
  /** The empty prompt appears only while the block is selected. */
  showPrompt: boolean;
  onChange: (caption: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing && editable) {
      inputRef.current?.focus();
    } else if (editing) {
      setEditing(false);
    }
  }, [editable, editing]);

  if (editing && editable) {
    return (
      <TextInput
        ref={inputRef}
        appearance="bare"
        textRole="caption"
        size="xs"
        value={caption}
        placeholder={labels.captionPlaceholder}
        aria-label={labels.captionPlaceholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            setEditing(false);
          }
        }}
      />
    );
  }
  if (editable && (caption || showPrompt)) {
    return (
      <TextButton size="xs" tone="muted" display="flex" fullWidth onClick={() => setEditing(true)}>
        {caption || labels.addCaption}
      </TextButton>
    );
  }
  return caption ? (
    <Text size="xs" tone="muted">
      {caption}
    </Text>
  ) : null;
}
