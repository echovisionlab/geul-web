'use client';
import { SelectionStatus } from '@/components/core/SelectionSurface';
import { LayoutInset } from '@/components/core/Layout';
export interface FileBrowserStatusBarProps {
  status: string;
}
export function FileBrowserStatusBar({ status }: FileBrowserStatusBarProps) {
  return (
    <LayoutInset inline={{ base: 'sm', sm: 'md' }} block="none">
      <SelectionStatus divider="none" data-file-browser-status>
        {status}
      </SelectionStatus>
    </LayoutInset>
  );
}
