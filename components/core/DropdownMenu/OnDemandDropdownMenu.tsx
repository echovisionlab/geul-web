'use client';

import { createContext, forwardRef, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useMenuTrigger, type AriaMenuOptions } from 'react-aria/useMenu';
import { PressResponder } from 'react-aria/private/interactions/PressResponder';
import { useMenuTriggerState, type RootMenuTriggerState } from 'react-stately/useMenuTriggerState';
import { onDemandModule, useOnDemandModule } from '../on-demand-module';
import { OverlayHintContext } from '../overlay-hint-context';
import overlayClasses from '../Overlay.module.css';
import {
  DROPDOWN_MENU_LABEL,
  DropdownMenuTarget,
  MenuPresentation,
  useDropdownMenuRoot,
  type DropdownMenuProps,
} from './dropdown-menu-root';
import type {
  DropdownMenuDividerProps,
  DropdownMenuDropdownProps,
  DropdownMenuItemProps,
  DropdownMenuLabelProps,
  DropdownMenuSectionProps,
  DropdownMenuSubDropdownProps,
  DropdownMenuSubProps,
  DropdownMenuSubTargetProps,
} from './DropdownMenu';

const surface = onDemandModule(() => import('./DropdownMenu'));

/** Starts loading the menu surface (React Aria Menu, Popover, collections). */
export const preloadDropdownMenu = surface.preload;

interface TriggerValue {
  state: RootMenuTriggerState;
  menuProps: AriaMenuOptions<unknown>;
  triggerRef: RefObject<HTMLElement | null>;
}
const TriggerContext = createContext<TriggerValue | null>(null);

/**
 * While an open request waits for the surface, the menu is not there to handle dismissal. Escape
 * on the trigger, focus moving elsewhere or a press outside the trigger cancel the request, so the
 * menu does not open (and take focus) when the surface arrives after the user moved on.
 */
function useCancelPendingOpen(pending: boolean, close: () => void, triggerRef: RefObject<HTMLElement | null>) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!pending || !trigger) {
      return;
    }
    const doc = trigger.ownerDocument;
    const within = (target: EventTarget | null) => target instanceof Node && trigger.contains(target);
    const cancel = () => {
      if (!surface.peek()) {
        closeRef.current();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Consumed like the open menu would, so an enclosing dialog stays open.
        event.stopPropagation();
        cancel();
      }
    };
    const onOutside = (event: Event) => {
      if (!within(event.target)) {
        cancel();
      }
    };
    let blurCheck: ReturnType<typeof setTimeout> | undefined;
    const onFocusOut = (event: FocusEvent) => {
      // Focus moved to the document body (no `focusin` follows); switching windows keeps it here.
      if (event.relatedTarget === null) {
        blurCheck = setTimeout(() => {
          if (doc.hasFocus() && !within(doc.activeElement)) {
            cancel();
          }
        });
      }
    };
    trigger.addEventListener('keydown', onKeyDown);
    trigger.addEventListener('focusout', onFocusOut);
    doc.addEventListener('focusin', onOutside, true);
    doc.addEventListener('pointerdown', onOutside, true);
    return () => {
      clearTimeout(blurCheck);
      trigger.removeEventListener('keydown', onKeyDown);
      trigger.removeEventListener('focusout', onFocusOut);
      doc.removeEventListener('focusin', onOutside, true);
      doc.removeEventListener('pointerdown', onOutside, true);
    };
  }, [pending, triggerRef]);
}

/**
 * Same trigger contract as React Aria `MenuTrigger` (press, keyboard and long-press opening,
 * `aria-haspopup`/`aria-expanded`/`aria-controls`, focus strategy), built from the hooks so the
 * trigger renders without the Menu/Popover modules. Those load with the surface.
 */
function OnDemandMenuTrigger({
  isOpen,
  onOpenChange,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}) {
  const props = { isOpen, onOpenChange, children };
  const state = useMenuTriggerState(props);
  const triggerRef = useRef<HTMLElement>(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger({ ...props, type: 'menu' }, state, triggerRef);
  useCancelPendingOpen(state.isOpen && !surface.peek(), state.close, triggerRef);
  return (
    <TriggerContext.Provider value={{ state, menuProps, triggerRef }}>
      <PressResponder {...menuTriggerProps} ref={triggerRef} isPressed={state.isOpen}>
        {children}
      </PressResponder>
    </TriggerContext.Provider>
  );
}

function OnDemandDropdownMenuRoot(props: DropdownMenuProps) {
  const { open, change, enter, leave, hint, presentation, setContainer } = useDropdownMenuRoot(props);
  return (
    <OverlayHintContext.Provider value={hint}>
      <span
        ref={setContainer}
        className={overlayClasses.anchor}
        onMouseEnter={() => {
          surface.preload();
          enter();
        }}
        onMouseLeave={leave}
        onFocus={surface.preload}
        onPointerDown={surface.preload}
      >
        <MenuPresentation.Provider value={presentation}>
          <OnDemandMenuTrigger isOpen={open} onOpenChange={change}>
            {props.children}
          </OnDemandMenuTrigger>
        </MenuPresentation.Provider>
      </span>
    </OverlayHintContext.Provider>
  );
}
OnDemandDropdownMenuRoot.displayName = 'DropdownMenu';

/**
 * Renders once the surface has loaded; opening before that waits for it (focus strategy is kept)
 * unless the request was cancelled meanwhile (`useCancelPendingOpen`).
 */
const OnDemandDropdown = forwardRef<HTMLDivElement, DropdownMenuDropdownProps>((props, ref) => {
  const trigger = useContext(TriggerContext);
  if (!trigger) {
    throw new Error('OnDemandDropdownMenu.Dropdown requires OnDemandDropdownMenu');
  }
  const loaded = useOnDemandModule(surface, trigger.state.isOpen);
  if (!loaded) {
    return null;
  }
  return (
    <loaded.DropdownMenuTriggerScope
      state={trigger.state}
      menuProps={trigger.menuProps}
      triggerRef={trigger.triggerRef}
    >
      <loaded.DropdownMenu.Dropdown ref={ref} {...props} />
    </loaded.DropdownMenuTriggerScope>
  );
});
OnDemandDropdown.displayName = 'DropdownMenu.Dropdown';

// Members below render only inside a loaded Dropdown, so the surface module is available.
function loadedSurface() {
  const loaded = surface.peek();
  if (!loaded) {
    throw new Error('OnDemandDropdownMenu members must render inside OnDemandDropdownMenu.Dropdown');
  }
  return loaded.DropdownMenu;
}
const OnDemandItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>((props, ref) => {
  const { Item } = loadedSurface();
  return <Item ref={ref} {...props} />;
});
OnDemandItem.displayName = 'DropdownMenu.Item';
const OnDemandLabel = forwardRef<HTMLElement, DropdownMenuLabelProps>((props, ref) => {
  const { Label } = loadedSurface();
  return <Label ref={ref} {...props} />;
});
OnDemandLabel.displayName = 'DropdownMenu.Label';
Object.assign(OnDemandLabel, { [DROPDOWN_MENU_LABEL]: true });
const OnDemandDivider = forwardRef<HTMLElement, DropdownMenuDividerProps>((props, ref) => {
  const { Divider } = loadedSurface();
  return <Divider ref={ref} {...props} />;
});
OnDemandDivider.displayName = 'DropdownMenu.Divider';
function OnDemandSection(props: DropdownMenuSectionProps) {
  const { Section } = loadedSurface();
  return <Section {...props} />;
}
OnDemandSection.displayName = 'DropdownMenu.Section';
function OnDemandSubRoot(props: DropdownMenuSubProps) {
  const { Sub } = loadedSurface();
  return <Sub {...props} />;
}
OnDemandSubRoot.displayName = 'DropdownMenu.Sub';
const OnDemandSubTarget = forwardRef<HTMLDivElement, DropdownMenuSubTargetProps>((props, ref) => {
  const { Sub } = loadedSurface();
  return <Sub.Target ref={ref} {...props} />;
});
OnDemandSubTarget.displayName = 'DropdownMenu.Sub.Target';
const OnDemandSubDropdown = forwardRef<HTMLDivElement, DropdownMenuSubDropdownProps>((props, ref) => {
  const { Sub } = loadedSurface();
  return <Sub.Dropdown ref={ref} {...props} />;
});
OnDemandSubDropdown.displayName = 'DropdownMenu.Sub.Dropdown';

/**
 * `DropdownMenu` with the same props, members, markup and behaviour, for always-present chrome
 * (site header, language and account menus). The trigger renders and hydrates without React Aria
 * Menu/Popover code; the surface loads when the pointer enters, focus arrives or the trigger is
 * pressed, and is shown as soon as it is available. After the first load every instance opens
 * synchronously. Use `DropdownMenu` inside screens that already ship menu code.
 */
export const OnDemandDropdownMenu = Object.assign(OnDemandDropdownMenuRoot, {
  Target: DropdownMenuTarget,
  Dropdown: OnDemandDropdown,
  Item: OnDemandItem,
  Label: OnDemandLabel,
  Divider: OnDemandDivider,
  Section: OnDemandSection,
  Sub: Object.assign(OnDemandSubRoot, { Target: OnDemandSubTarget, Dropdown: OnDemandSubDropdown }),
});
