'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MemberCriteriaRow } from './model';

interface MemberCriteriaModalContextValue {
  lifecycleCriteria: MemberCriteriaRow | null;
  lifecycleAction: 'archive' | 'restore' | null;
  openArchive: (criteria: MemberCriteriaRow) => void;
  openRestore: (criteria: MemberCriteriaRow) => void;
  closeLifecycle: () => void;
  isCreateOpen: boolean;
  openCreate: () => void;
  closeCreate: () => void;
  editingCriteriaId: string | null;
  openEdit: (id: string) => void;
  closeEdit: () => void;
}

const MemberCriteriaModalContext = createContext<MemberCriteriaModalContextValue | null>(null);

export function useCriteriaModal() {
  const context = useContext(MemberCriteriaModalContext);
  if (!context) {
    throw new Error('useCriteriaModal must be used within CriteriaModalProvider');
  }
  return context;
}

export function CriteriaModalProvider({ children }: { children: ReactNode }) {
  const [lifecycleCriteria, setLifecycleCriteria] = useState<MemberCriteriaRow | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<'archive' | 'restore' | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null);

  const value: MemberCriteriaModalContextValue = {
    lifecycleCriteria,
    lifecycleAction,
    openArchive: (criteria) => {
      setLifecycleCriteria(criteria);
      setLifecycleAction('archive');
    },
    openRestore: (criteria) => {
      setLifecycleCriteria(criteria);
      setLifecycleAction('restore');
    },
    closeLifecycle: () => {
      setLifecycleCriteria(null);
      setLifecycleAction(null);
    },
    isCreateOpen,
    openCreate: () => setIsCreateOpen(true),
    closeCreate: () => setIsCreateOpen(false),
    editingCriteriaId,
    openEdit: (id: string) => setEditingCriteriaId(id),
    closeEdit: () => setEditingCriteriaId(null),
  };

  return <MemberCriteriaModalContext.Provider value={value}>{children}</MemberCriteriaModalContext.Provider>;
}
