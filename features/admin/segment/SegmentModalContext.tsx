'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AudienceSegmentRow } from './model';

interface SegmentModalContextValue {
  lifecycleSegment: AudienceSegmentRow | null;
  lifecycleAction: 'archive' | 'restore' | null;
  openArchive: (segment: AudienceSegmentRow) => void;
  openRestore: (segment: AudienceSegmentRow) => void;
  closeLifecycle: () => void;
  isCreateOpen: boolean;
  openCreate: () => void;
  closeCreate: () => void;
  editingSegmentId: string | null;
  openEdit: (id: string) => void;
  closeEdit: () => void;
}

const SegmentModalContext = createContext<SegmentModalContextValue | null>(null);

export function useSegmentModal() {
  const context = useContext(SegmentModalContext);
  if (!context) {
    throw new Error('useSegmentModal must be used within SegmentModalProvider');
  }
  return context;
}

export function SegmentModalProvider({ children }: { children: ReactNode }) {
  const [lifecycleSegment, setLifecycleSegment] = useState<AudienceSegmentRow | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<'archive' | 'restore' | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  const value: SegmentModalContextValue = {
    lifecycleSegment,
    lifecycleAction,
    openArchive: (segment) => {
      setLifecycleSegment(segment);
      setLifecycleAction('archive');
    },
    openRestore: (segment) => {
      setLifecycleSegment(segment);
      setLifecycleAction('restore');
    },
    closeLifecycle: () => {
      setLifecycleSegment(null);
      setLifecycleAction(null);
    },
    isCreateOpen,
    openCreate: () => setIsCreateOpen(true),
    closeCreate: () => setIsCreateOpen(false),
    editingSegmentId,
    openEdit: (id: string) => setEditingSegmentId(id),
    closeEdit: () => setEditingSegmentId(null),
  };

  return <SegmentModalContext.Provider value={value}>{children}</SegmentModalContext.Provider>;
}
