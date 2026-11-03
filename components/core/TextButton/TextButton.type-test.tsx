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
    <TextButton display="block" controlSize="xs">
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

  // @ts-expect-error text action styles belong to Core
  const styled: TextButtonProps = { children: 'Open', style: { color: 'red' } };
  // @ts-expect-error arbitrary link renderers are not public Core transport
  const renderer: TextButtonProps = { children: 'About', href: '/about', linkComponent: 'a' };
  // @ts-expect-error control geometry is finite
  const geometry: TextButtonProps = { children: 'Open', controlSize: '44px' };

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
      {styled}
      {renderer}
      {geometry}
    </>
  );
}

const menuIndicator = (
  <TextButton indicator="menu" aria-expanded={false}>
    Options
  </TextButton>
);
const disclosureIndicator = (
  <TextButton indicator="disclosure" aria-expanded>
    Details
  </TextButton>
);
const indicatorLink = (
  // @ts-expect-error opening affordances belong to actions, not navigation links
  <TextButton href="/about" indicator="menu">
    About
  </TextButton>
);
// @ts-expect-error indicator variants are finite
const inventedIndicator = <TextButton indicator="triangle">Options</TextButton>;
void [menuIndicator, disclosureIndicator, indicatorLink, inventedIndicator];

<TextButton justify="end">Sort</TextButton>;
// @ts-expect-error Alignment remains a closed Core role.
<TextButton justify="stretch">Sort</TextButton>;

// @ts-expect-error Router options require an href, including typed prop objects.
const actionNavigation: TextButtonProps = { children: 'Open', prefetch: false };
// @ts-expect-error Form association belongs to the action branch.
const formLink: TextButtonProps = { children: 'About', href: '/about', form: 'editor' };
void [actionNavigation, formLink];

<TextButton loading loadingLabel="Saving preferences">
  Save preferences
</TextButton>;
// @ts-expect-error TextButton pending is a command state, not an unavailable navigation link.
<TextButton href="/settings" loading>
  Settings
</TextButton>;
// @ts-expect-error Loading copy belongs to the command branch.
const pendingLink: TextButtonProps = { children: 'Settings', href: '/settings', loadingLabel: 'Opening' };
const pendingVisualOverride = { loading: true, style: { color: 'red' } };
// @ts-expect-error Pending does not open a styling escape through typed spreads.
<TextButton {...pendingVisualOverride}>Save</TextButton>;
void pendingLink;
