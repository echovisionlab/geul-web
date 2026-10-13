'use client';

import { createContext, type ForwardedRef } from 'react';

/** The trigger ref belongs to the action, independently of a Tooltip popup ref. */
export const OverlayTargetRefContext = createContext<ForwardedRef<HTMLElement> | undefined>(undefined);

/** A Tooltip used as a functional trigger forwards that trigger's press ownership. */
export const OverlayTargetPressContext = createContext(false);
