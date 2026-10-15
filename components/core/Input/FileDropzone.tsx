'use client';
import { useId, type ReactNode } from 'react';
import { Button, DropZone, FileTrigger, Text } from 'react-aria-components';
import classes from './Input.module.css';
import { fileSelectionReason } from '../file-selection';
export type FileDropzoneRejectionReason = 'too-large' | 'invalid-type' | 'too-many' | 'unknown';
export interface FileDropzoneRejection {
  file: File;
  reason: FileDropzoneRejectionReason;
}
export interface FileDropzoneProps {
  label: string;
  title?: string;
  description?: string;
  icon: ReactNode;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number;
  size?: 'compact' | 'standard' | 'large';
  disabled?: boolean;
  onFilesSelected: (files: readonly File[]) => void;
  onFilesRejected?: (rejections: readonly FileDropzoneRejection[]) => void;
}
export function FileDropzone(props: FileDropzoneProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = props.description ? `${id}-description` : undefined;
  const select = (files: File[]) => {
    if (props.disabled || !files.length) {
      return;
    }
    const limit = props.multiple ? props.maxFiles : 1;
    if (limit !== undefined && files.length > limit) {
      props.onFilesRejected?.(files.map((file) => ({ file, reason: 'too-many' })));
      return;
    }
    const accepted: File[] = [];
    const rejected: FileDropzoneRejection[] = [];
    for (const file of files) {
      const reason = fileSelectionReason(file, props.accept, props.maxSize);
      if (reason) {
        rejected.push({ file, reason });
      } else {
        accepted.push(file);
      }
    }
    if (rejected.length) {
      props.onFilesRejected?.(rejected);
    }
    if (accepted.length) {
      props.onFilesSelected(accepted);
    }
  };
  return (
    <DropZone
      className={classes.dropzone}
      data-file-dropzone
      data-geul-input-drop-size={props.size ?? 'standard'}
      isDisabled={props.disabled}
      aria-label={props.label}
      onDrop={async (event) => {
        const files = await Promise.all(
          event.items.filter((item) => item.kind === 'file').map((item) => item.getFile()),
        );
        select(files);
      }}
    >
      <FileTrigger
        acceptedFileTypes={props.accept?.split(',').map((value) => value.trim())}
        allowsMultiple={props.multiple}
        onSelect={(files) => select(Array.from(files ?? []))}
      >
        <Button
          className={classes.dropzoneButton}
          isDisabled={props.disabled}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          <span className={classes.dropIcon} aria-hidden>
            {props.icon}
          </span>
          <span id={titleId} className={classes.label}>
            {props.title ?? props.label}
          </span>
          {props.description ? (
            <Text id={descriptionId} className={classes.description}>
              {props.description}
            </Text>
          ) : null}
        </Button>
      </FileTrigger>
    </DropZone>
  );
}
