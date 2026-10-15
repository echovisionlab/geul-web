'use client';

import type { OverlayPresentationProps } from '../overlay-contract';

import { forwardRef, useId, useLayoutEffect, useState, type ReactNode } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { IconX } from '@tabler/icons-react';
import { IconButton } from '../IconButton';
import classes from '../Overlay.module.css';
import { overlayLayers } from '../layer-contract';

export type OverlayDialogDensity = 'standard' | 'compact';

interface OverlayDialogSharedProps extends OverlayPresentationProps {
  id?: string;
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel?: string;
  children: ReactNode;
  size?: 'compact' | 'standard' | 'large' | 'wide' | 'workspace' | 'auto';
  density?: OverlayDialogDensity;
  bodyLayout?: 'scroll' | 'fit';
  centered?: boolean;
  dismissible?: boolean;
  /** An owned operation is pending; all dismiss paths stay locked until it settles. */
  busy?: boolean;
  placement?: 'left' | 'right' | 'bottom';
  mobileOnly?: boolean;
  level?: 'info' | 'warning' | 'danger';
  /** `obscure` hides the page behind the dialog completely: content the viewer may no longer see. */
  backdrop?: 'dim' | 'obscure';
}
export type OverlayDialogProps = OverlayDialogSharedProps &
  ({ role?: 'dialog'; descriptionId?: string } | { role: 'alertdialog'; descriptionId: string });

/** A body becomes a named keyboard scroll target only while its own viewport overflows. */
function DialogBody({ children, layout, titleId }: { children: ReactNode; layout: 'scroll' | 'fit'; titleId: string }) {
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [scrollable, setScrollable] = useState(false);
  useLayoutEffect(() => {
    if (!body || layout !== 'scroll') {
      setScrollable(false);
      return;
    }
    const measure = () => {
      const styles = body.ownerDocument.defaultView!.getComputedStyle(body);
      const vertical = ['auto', 'scroll'].includes(styles.overflowY || styles.overflow);
      const horizontal = ['auto', 'scroll'].includes(styles.overflowX || styles.overflow);
      setScrollable(
        (vertical && body.scrollHeight > body.clientHeight) || (horizontal && body.scrollWidth > body.clientWidth),
      );
    };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const observeContent = () => {
      resize?.disconnect();
      resize?.observe(body);
      for (const child of body.children) {
        resize?.observe(child);
      }
      measure();
    };
    const mutations = new MutationObserver(observeContent);
    mutations.observe(body, { childList: true, subtree: true, characterData: true });
    const view = body.ownerDocument.defaultView;
    view?.addEventListener('resize', measure);
    observeContent();
    return () => {
      resize?.disconnect();
      mutations.disconnect();
      view?.removeEventListener('resize', measure);
    };
  }, [body, layout]);
  return (
    <div
      ref={setBody}
      className={classes.body}
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? 'region' : undefined}
      aria-labelledby={scrollable ? titleId : undefined}
    >
      {children}
    </div>
  );
}

/** Shared modal behavior: React Aria owns portal, scroll lock, focus scope and restoration. */
export const OverlayDialog = forwardRef<HTMLDivElement, OverlayDialogProps>(
  (
    {
      id,
      opened,
      onClose,
      title,
      closeLabel,
      children,
      size = 'standard',
      density = 'compact',
      bodyLayout = 'scroll',
      centered = false,
      dismissible = true,
      busy = false,
      role = 'dialog',
      descriptionId,
      placement,
      mobileOnly = false,
      level,
      backdrop = 'dim',
    },
    ref,
  ) => {
    const titleId = useId();
    if (opened && (title == null || (typeof title === 'string' && !title.trim()))) {
      throw new TypeError('Core OverlayDialog requires a nonempty visible title');
    }
    if (opened && role === 'alertdialog' && (typeof descriptionId !== 'string' || !descriptionId.trim())) {
      throw new TypeError('Core alertdialog requires a nonempty descriptionId');
    }
    const canDismiss = dismissible && !busy;
    return (
      <ModalOverlay
        isOpen={opened}
        onOpenChange={(next) => {
          if (!next && canDismiss) {
            onClose();
          }
        }}
        isDismissable={canDismiss}
        isKeyboardDismissDisabled={!canDismiss}
        className={classes.backdrop}
        style={{ zIndex: overlayLayers.backdrop }}
        data-placement={placement}
        data-centered={centered || undefined}
        data-size={size}
        data-mobile-only={mobileOnly || undefined}
        data-backdrop={backdrop === 'obscure' ? 'obscure' : undefined}
      >
        <Modal
          ref={ref}
          style={{ zIndex: overlayLayers.modal }}
          className={classes.panel}
          data-placement={placement}
          data-size={size}
          data-density={density === 'standard' ? 'standard' : 'compact'}
          data-body-layout={bodyLayout === 'fit' ? 'fit' : 'scroll'}
          data-centered={centered || undefined}
          data-mobile-only={mobileOnly || undefined}
          data-close-policy={canDismiss ? 'dismissible' : 'non-dismissible'}
          data-loading={busy || undefined}
          data-level={level}
        >
          <Dialog
            render={(domProps) => (
              <section
                {...domProps}
                role={role}
                aria-modal="true"
                aria-busy={busy || undefined}
                data-size={size}
                data-centered={centered || undefined}
                data-close-policy={canDismiss ? 'dismissible' : 'non-dismissible'}
              />
            )}
            data-close-policy={canDismiss ? 'dismissible' : 'non-dismissible'}
            id={id}
            role={role}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={classes.dialog}
          >
            <div className={classes.header}>
              <Heading id={titleId} slot="title" className={classes.title}>
                {title}
              </Heading>
              {canDismiss && closeLabel ? (
                <IconButton label={closeLabel} size="xs" onClick={onClose}>
                  <IconX size="1em" aria-hidden />
                </IconButton>
              ) : null}
            </div>
            <DialogBody layout={bodyLayout === 'fit' ? 'fit' : 'scroll'} titleId={titleId}>
              {children}
            </DialogBody>
          </Dialog>
        </Modal>
      </ModalOverlay>
    );
  },
);
OverlayDialog.displayName = 'CoreOverlayDialog';
