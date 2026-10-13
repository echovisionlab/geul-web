'use client';

import { useContext, useEffect } from 'react';
import { ComboBoxStateContext } from 'react-aria-components';

/** Synchronize the public open-state contract with React Aria's collection state. */
export function ComboboxOpenBridge({ opened }: { opened?: boolean }) {
  const state = useContext(ComboBoxStateContext);
  useEffect(() => {
    if (!state || opened === undefined || state.isOpen === opened) {
      return;
    }
    if (opened) {
      state.open(null, 'manual');
    } else {
      state.close();
    }
  }, [opened, state]);
  return null;
}
