'use client';

import {
  Children,
  cloneElement,
  Fragment,
  createContext,
  createElement,
  forwardRef,
  isValidElement,
  useContext,
  useRef,
  type AriaAttributes,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { IconCheck, IconChevronRight } from '@tabler/icons-react';
import {
  Header,
  Menu,
  MenuContext,
  MenuItem,
  MenuSection,
  MenuTrigger,
  OverlayArrow,
  OverlayTriggerStateContext,
  Popover,
  PopoverContext,
  Provider,
  RootMenuTriggerStateContext,
  Separator,
  SubmenuTrigger,
} from 'react-aria-components';
import type { AriaMenuOptions } from 'react-aria/useMenu';
import { useInteractOutside } from 'react-aria/useInteractOutside';
import type { RootMenuTriggerState } from 'react-stately/useMenuTriggerState';
import { overlayDataAttributes, type OverlayPresentationProps } from '../overlay-contract';
import { OverlayHintContext } from '../overlay-hint-context';
import { overlayLayers } from '../layer-contract';
import type { ControlTone } from '../control-style';
import overlayClasses from '../Overlay.module.css';
import classes from './DropdownMenu.module.css';
import { DocumentColorPreview, type DocumentColor } from '../DocumentColorPreview';
import { useNavigationClick } from '../Navigation/navigation-events';
import {
  DROPDOWN_MENU_LABEL,
  DropdownMenuAnchor,
  DropdownMenuTarget,
  isDropdownMenuLabelType,
  MenuPresentation,
  useDropdownMenuRoot,
  type DropdownMenuProps,
  type DropdownMenuSize,
  type DropdownMenuSubPlacement,
} from './dropdown-menu-root';
export type {
  DropdownMenuPlacement,
  DropdownMenuProps,
  DropdownMenuSize,
  DropdownMenuSubPlacement,
  DropdownMenuTrigger,
} from './dropdown-menu-root';

const dropdownClassName = `${overlayClasses.menuSurface} ${classes.dropdown}`;
export interface DropdownMenuItemProps extends OverlayPresentationProps {
  children?: ReactNode;
  icon?: ReactNode;
  /** A full content sample has its own width; it must not occupy the icon slot. */
  colorPreview?: { kind: 'text' | 'background'; color: DocumentColor };
  tone?: ControlTone;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  download?: boolean | string;
  id?: string;
  title?: string;
  'aria-label'?: string;
  'aria-current'?: AriaAttributes['aria-current'];
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}
export interface DropdownMenuDropdownProps extends OverlayPresentationProps {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}
export interface DropdownMenuLabelProps extends OverlayPresentationProps {
  children?: ReactNode;
}
export interface DropdownMenuDividerProps extends OverlayPresentationProps {}
export interface DropdownMenuSectionProps extends OverlayPresentationProps {
  label: string;
  children?: ReactNode;
}
export interface DropdownMenuSubProps extends OverlayPresentationProps {
  children?: ReactNode;
  size?: DropdownMenuSize;
  placement?: DropdownMenuSubPlacement;
}
export interface DropdownMenuSubTargetProps extends OverlayPresentationProps {
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}
export interface DropdownMenuSubDropdownProps extends OverlayPresentationProps {
  children?: ReactNode;
}
function DropdownMenuRoot(props: DropdownMenuProps) {
  const { open, change, enter, leave, hint, presentation, setContainer } = useDropdownMenuRoot(props);
  return (
    <OverlayHintContext.Provider value={hint}>
      <span ref={setContainer} className={overlayClasses.anchor} onMouseEnter={enter} onMouseLeave={leave}>
        <MenuPresentation.Provider value={presentation}>
          <MenuTrigger isOpen={open} onOpenChange={change}>
            {props.children}
          </MenuTrigger>
        </MenuPresentation.Provider>
      </span>
    </OverlayHintContext.Provider>
  );
}
DropdownMenuRoot.displayName = 'DropdownMenu';

/**
 * The React Aria contexts that `MenuTrigger` provides, for a trigger whose state lives in the light
 * `OnDemandDropdownMenu` root. Used only by the on-demand surface; equal to `MenuTrigger`'s values.
 */
export function DropdownMenuTriggerScope({
  state,
  menuProps,
  triggerRef,
  children,
}: {
  state: RootMenuTriggerState;
  menuProps: AriaMenuOptions<unknown>;
  triggerRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <Provider
      values={[
        [MenuContext, { ...menuProps, ref: scrollRef }],
        [OverlayTriggerStateContext, state],
        [RootMenuTriggerStateContext, state],
        [
          PopoverContext,
          {
            trigger: 'MenuTrigger',
            triggerRef,
            scrollRef,
            placement: 'bottom start',
            'aria-labelledby': menuProps['aria-labelledby'],
          },
        ],
      ]}
    >
      {children}
    </Provider>
  );
}
const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  (
    {
      children,
      icon,
      colorPreview,
      tone,
      selected = false,
      disabled,
      onClick,
      href,
      target,
      rel,
      download,
      id,
      title,
      'aria-label': ariaLabel,
      'aria-current': ariaCurrent,
      ...data
    },
    ref,
  ) => {
    const guardNavigation = useNavigationClick({ href: href ?? '', target, download });
    return (
      <MenuItem
        ref={ref}
        id={id}
        isDisabled={disabled}
        onAction={onClick}
        onClick={href ? guardNavigation : undefined}
        href={href}
        target={target}
        rel={rel}
        download={download}
        className={classes.item}
        aria-label={ariaLabel}
        aria-current={ariaCurrent ?? (selected ? 'true' : undefined)}
        textValue={typeof children === 'string' ? children : ariaLabel}
        data-core-selected={selected || undefined}
        data-tone={tone}
        render={(domProps) =>
          createElement(href ? 'a' : 'div', {
            ...domProps,
            title,
            'aria-current': ariaCurrent ?? (selected ? 'true' : undefined),
          })
        }
        {...overlayDataAttributes(data)}
      >
        {colorPreview ? (
          <span className={classes.itemPreview} aria-hidden>
            <DocumentColorPreview
              kind={colorPreview.kind}
              textColor={colorPreview.kind === 'text' ? colorPreview.color : undefined}
              backgroundColor={colorPreview.kind === 'background' ? colorPreview.color : undefined}
            />
          </span>
        ) : icon ? (
          <span className={classes.itemSection} data-position="left" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className={classes.itemLabel}>{children}</span>
        {selected ? (
          <span className={classes.itemSection} data-position="right" aria-hidden>
            <IconCheck size="1em" />
          </span>
        ) : null}
      </MenuItem>
    );
  },
);
DropdownMenuItem.displayName = 'DropdownMenu.Item';
const DropdownMenuLabel = forwardRef<HTMLElement, DropdownMenuLabelProps>(({ children }, ref) => (
  <Header ref={ref} className={classes.label}>
    {children}
  </Header>
));
DropdownMenuLabel.displayName = 'DropdownMenu.Label';
Object.assign(DropdownMenuLabel, { [DROPDOWN_MENU_LABEL]: true });
const DropdownMenuDivider = forwardRef<HTMLElement, DropdownMenuDividerProps>((_props, ref) => (
  <Separator ref={ref} className={classes.divider} />
));
DropdownMenuDivider.displayName = 'DropdownMenu.Divider';
function DropdownMenuSection({ label, children }: DropdownMenuSectionProps) {
  return (
    <MenuSection className={classes.section} aria-label={label}>
      <Header className={classes.label}>{label}</Header>
      {children}
    </MenuSection>
  );
}
DropdownMenuSection.displayName = 'DropdownMenu.Section';
function flatten(nodes: ReactNode, path = 'root'): ReactNode[] {
  return Children.toArray(nodes).flatMap((node, index) => {
    const key = `${path}/${isValidElement(node) ? (node.key ?? index) : index}`;
    if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
      return flatten(node.props.children, key);
    }
    return isValidElement(node) ? [cloneElement(node, { key })] : [node];
  });
}
function menuSections(nodes: ReactNode): ReactNode[] {
  const result: ReactNode[] = [];
  let label: ReactNode = null;
  let items: ReactNode[] = [];
  const flush = () => {
    if (label !== null) {
      result.push(
        <MenuSection key={`section-${result.length}`} className={classes.section}>
          {label}
          {items}
        </MenuSection>,
      );
    } else {
      result.push(...items);
    }
    items = [];
  };
  for (const node of flatten(nodes)) {
    if (isValidElement(node) && isDropdownMenuLabelType(node.type)) {
      flush();
      label = node;
    } else {
      items.push(node);
    }
  }
  flush();
  return result;
}
const DropdownMenuDropdown = forwardRef<HTMLDivElement, DropdownMenuDropdownProps>(
  ({ children, onClick, onMouseDown, ...props }, ref) => {
    const value = useContext(MenuPresentation);
    const triggerState = useContext(RootMenuTriggerStateContext);
    const popoverRef = useRef<HTMLElement>(null);
    // Non-modal popovers keep hover menus usable but do not dismiss themselves on outside
    // interaction, so close the menu when the pointer goes down outside both it and its trigger.
    useInteractOutside({
      ref: popoverRef,
      isDisabled: !triggerState?.isOpen,
      onInteractOutside: (event) => {
        const target = event.target instanceof Element ? event.target : null;
        // The trigger toggles the menu itself; submenus render in their own popovers.
        if (target && (value?.container?.contains(target) || target.closest('[role="menu"]'))) {
          return;
        }
        triggerState?.close();
      },
    });
    if (!value) {
      throw new Error('DropdownMenu.Dropdown requires DropdownMenu');
    }
    return (
      <Popover
        ref={popoverRef}
        isNonModal
        className={dropdownClassName}
        placement={value.placement.replace('-', ' ') as 'bottom start'}
        data-size={value.size}
        style={{ zIndex: overlayLayers.popup }}
        UNSTABLE_portalContainer={!value.portal ? (value.container ?? undefined) : undefined}
        onMouseEnter={value.enter}
        onMouseLeave={value.leave}
        data-menu-dropdown
        {...overlayDataAttributes(props)}
        onClick={onClick}
        onMouseDown={onMouseDown}
      >
        {value.arrow ? (
          <OverlayArrow className={classes.arrow}>
            <svg width="8" height="8" viewBox="0 0 8 8">
              <path d="M0 0L4 4L8 0" />
            </svg>
          </OverlayArrow>
        ) : null}
        <Menu
          ref={ref}
          id={value.id}
          className={classes.menu}
          shouldFocusWrap={value.loop}
          shouldCloseOnSelect={value.closeOnItemClick}
        >
          {menuSections(children)}
        </Menu>
      </Popover>
    );
  },
);
DropdownMenuDropdown.displayName = 'DropdownMenu.Dropdown';
const SubPresentation = createContext<{ size: DropdownMenuSize; placement: DropdownMenuSubPlacement }>({
  size: 'standard',
  placement: 'right-start',
});
function DropdownMenuSubRoot({ children, size = 'standard', placement = 'right-start' }: DropdownMenuSubProps) {
  return (
    <SubPresentation.Provider value={{ size, placement }}>
      <SubmenuTrigger>{Children.toArray(children) as ReactElement[]}</SubmenuTrigger>
    </SubPresentation.Provider>
  );
}
DropdownMenuSubRoot.displayName = 'DropdownMenu.Sub';
const DropdownMenuSubTarget = forwardRef<HTMLDivElement, DropdownMenuSubTargetProps>(
  ({ children, icon, disabled }, ref) => (
    <MenuItem
      ref={ref}
      isDisabled={disabled}
      className={classes.item}
      textValue={typeof children === 'string' ? children : undefined}
    >
      {icon ? (
        <span className={classes.itemSection} aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className={classes.itemLabel}>{children}</span>
      <IconChevronRight size="1em" aria-hidden />
    </MenuItem>
  ),
);
DropdownMenuSubTarget.displayName = 'DropdownMenu.Sub.Target';
const DropdownMenuSubDropdown = forwardRef<HTMLDivElement, DropdownMenuSubDropdownProps>(({ children }, ref) => {
  const value = useContext(SubPresentation);
  const parent = useContext(MenuPresentation);
  return (
    <Popover
      isNonModal
      className={dropdownClassName}
      placement={
        value.placement === 'right-start'
          ? 'right top'
          : value.placement === 'left-start'
            ? 'left top'
            : value.placement
      }
      data-size={value.size}
      style={{ zIndex: overlayLayers.popup }}
    >
      <Menu
        ref={ref}
        className={classes.menu}
        shouldFocusWrap={parent?.loop ?? true}
        shouldCloseOnSelect={parent?.closeOnItemClick ?? true}
      >
        {menuSections(children)}
      </Menu>
    </Popover>
  );
});
DropdownMenuSubDropdown.displayName = 'DropdownMenu.Sub.Dropdown';
const DropdownMenuSub = Object.assign(DropdownMenuSubRoot, {
  Target: DropdownMenuSubTarget,
  Dropdown: DropdownMenuSubDropdown,
});
function DropdownMenuPointAnchor({ x, y }: DropdownMenuAnchorProps) {
  return <DropdownMenuAnchor x={x} y={y} className={classes.anchor} />;
}
DropdownMenuPointAnchor.displayName = 'DropdownMenu.Anchor';
export interface DropdownMenuAnchorProps {
  /** Viewport coordinates, e.g. a contextmenu event's clientX/clientY. */
  x: number;
  y: number;
}
export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Target: DropdownMenuTarget,
  Anchor: DropdownMenuPointAnchor,
  Dropdown: DropdownMenuDropdown,
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Divider: DropdownMenuDivider,
  Section: DropdownMenuSection,
  Sub: DropdownMenuSub,
});
