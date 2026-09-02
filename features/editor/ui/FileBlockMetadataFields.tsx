'use client';

import { Textarea, TextInput } from '@/components/core/Input';
import classes from './FileBlockMetadataFields.module.css';

export interface FileBlockMetadataFieldLabels {
  name: string;
  alt: string;
  caption: string;
  captionPlaceholder: string;
}

export interface FileBlockMetadataFieldsProps {
  labels: FileBlockMetadataFieldLabels;
  mimeType: string;
  name: string;
  alt: string;
  caption: string;
  allowNameEdit: boolean;
  allowLocalizedEdit: boolean;
  onNameChange: (value: string) => void;
  onAltChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
}

/** Pure File Block field surface. The controller owns locale and neutral-field authority. */
export function FileBlockMetadataFields({
  labels,
  mimeType,
  name,
  alt,
  caption,
  allowNameEdit,
  allowLocalizedEdit,
  onNameChange,
  onAltChange,
  onCaptionChange,
}: FileBlockMetadataFieldsProps) {
  if (!allowNameEdit && !allowLocalizedEdit) {
    return null;
  }

  return (
    <div className={classes.fields} data-file-block-metadata-fields="">
      {allowNameEdit ? (
        <TextInput label={labels.name} value={name} onChange={(event) => onNameChange(event.currentTarget.value)} />
      ) : null}
      {allowLocalizedEdit && mimeType.startsWith('image/') ? (
        <TextInput label={labels.alt} value={alt} onChange={(event) => onAltChange(event.currentTarget.value)} />
      ) : null}
      {allowLocalizedEdit ? (
        <Textarea
          label={labels.caption}
          placeholder={labels.captionPlaceholder}
          value={caption}
          autosize
          minRows={1}
          maxRows={4}
          onChange={(event) => onCaptionChange(event.currentTarget.value)}
        />
      ) : null}
    </div>
  );
}
