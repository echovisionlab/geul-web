import { createRef } from 'react';
import { TextButton, type TextButtonProps } from './TextButton';

/** Compile-only fixtures. `pnpm typecheck` verifies the accepted and rejected branches. */
export function TextButtonTypeContract() {
  const buttonRef = createRef<HTMLButtonElement>();
  const linkRef = createRef<HTMLAnchorElement>();
  const button = (
    <TextButton ref={buttonRef} onClick={() => undefined} disabled type="button">
      Cookie settings
    </TextButton>
  );
  const injectedTrigger = <TextButton ref={buttonRef}>Language</TextButton>;
  const compactBlockAction = (
    <TextButton display="block" controlSize="xs" style={{ '--text-button-line-height': 1.2 }}>
      Download file
    </TextButton>
  );
  const link = (
    <TextButton ref={linkRef} href="/about" target="_blank" rel="noopener" download="about.txt">
      About
    </TextButton>
  );

  // @ts-expect-error href and onClick are mutually exclusive
  const linkWithOnClick: TextButtonProps = { children: 'About', href: '/about', onClick: () => undefined };
  const linkWithOnNavigate: TextButtonProps = { children: 'About', href: '/about', onNavigate: () => undefined };
  // @ts-expect-error links cannot be disabled; unavailable navigation should not be rendered as a link
  const disabledLink: TextButtonProps = { children: 'About', href: '/about', disabled: true };
  // @ts-expect-error type belongs to the native button branch
  const typedLink: TextButtonProps = { children: 'About', href: '/about', type: 'button' };
  const linkWithButtonRef = (
    // @ts-expect-error link actions require an anchor ref
    <TextButton ref={buttonRef} href="/about">
      About
    </TextButton>
  );
  // @ts-expect-error native button actions require a button ref
  const buttonWithLinkRef = <TextButton ref={linkRef}>Cookie settings</TextButton>;

  return (
    <>
      {button}
      {injectedTrigger}
      {compactBlockAction}
      {link}
      {linkWithOnClick}
      {linkWithOnNavigate}
      {disabledLink}
      {typedLink}
      {linkWithButtonRef}
      {buttonWithLinkRef}
    </>
  );
}
