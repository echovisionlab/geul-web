'use client';

import { createContext, useContext } from 'react';

// Sections also render independently in previews. The composed editor supplies its
// current neutral-field permission, including a live room downgrade.
const ReleaseEditorAccessContext = createContext(true);
export const ReleaseEditorAccessProvider = ReleaseEditorAccessContext.Provider;
export function useReleaseEditorCanEdit() {
  return useContext(ReleaseEditorAccessContext);
}
