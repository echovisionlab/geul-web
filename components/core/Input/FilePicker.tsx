'use client';
import { useRef, useImperativeHandle, type Ref, type ReactNode } from 'react';
export interface FilePickerProps {
  /** Stable identifier of the native file input, for automation and DOM references. */
  id?: string;
  accept?: string;
  resetRef?: Ref<() => void>;
  multiple?: boolean;
  disabled?: boolean;
  onChange: (files: File[]) => void;
  children: (onBrowse: () => void) => ReactNode;
}
/** Native file-dialog bridge. The visible action remains a caller-composed Core accessible button. */
export function FilePicker({ id, resetRef, accept, multiple, disabled, onChange, children }: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(
    resetRef,
    () => () => {
      if (input.current) {
        input.current.value = '';
      }
    },
    [],
  );
  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          const selected = multiple ? files : files.slice(0, 1);
          event.currentTarget.value = '';
          if (!disabled && files.length) {
            onChange(selected);
          }
        }}
      />
      {children(() => {
        if (!disabled) {
          input.current?.click();
        }
      })}
    </>
  );
}
