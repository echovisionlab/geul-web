'use client';

import { LayoutInset, LayoutStack, type LayoutStackProps, type Responsive, type Space } from '../Layout';
import { ControlContrastProvider } from '../control-context';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './ImageChrome.module.css';

/** Shared image-caption chrome. Image dimensions and authored media stay with the consumer. */
export interface ImageChromeProps extends PresentationProps {
  placement?: 'flow' | 'cover';
  shade?: 'none' | 'card' | 'header';
  inset?: Responsive<Space>;
  gap?: Responsive<Space>;
  justify?: LayoutStackProps['justify'];
}
export function ImageChrome({
  placement = 'flow',
  shade = 'none',
  inset = 'none',
  gap = 'md',
  justify = 'end',
  children,
  ...props
}: ImageChromeProps) {
  return (
    <div {...presentationAttributes(props)} className={classes.root} data-placement={placement} data-shade={shade}>
      <ControlContrastProvider contrast="inverse">
        <LayoutInset space={inset} fill={placement === 'cover' ? 'both' : undefined}>
          <LayoutStack gap={gap} fill={placement === 'cover' ? 'both' : undefined} justify={justify}>
            {children}
          </LayoutStack>
        </LayoutInset>
      </ControlContrastProvider>
    </div>
  );
}
