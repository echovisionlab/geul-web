// Server-compatible public shell layout (no client directive, no hooks). Static structure, labels,
// menus and footer copy render on the server; interactive parts are the client islands from
// `ShellIslands`, which read open state, user, theme and route from the shell state context.

import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/core/ApplicationFrame';
import {
  LayoutGrid,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutVisibility,
} from '@/components/core/Layout';
import { Separator } from '@/components/core/Display';
import { Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import {
  ShellAccountDesktop,
  ShellAccountMobile,
  ShellChangelogLink,
  ShellCookieSettingsButton,
  ShellDesktopNavigation,
  ShellFrame,
  ShellHomeLink,
  ShellLink,
  ShellNavigationToggle,
  ShellSearchAction,
  ShellThemeToggle,
} from './ShellIslands';
import type { ShellLayoutProps, ShellStaticLabels, ShellViewNavigationItem, ShellViewSlots } from './shell-types';
import viewClasses from './ShellView.module.css';

function linkTarget(item: ShellViewNavigationItem) {
  return item.openInNewTab ? '_blank' : undefined;
}

function linkRel(item: ShellViewNavigationItem) {
  return item.openInNewTab ? 'noopener noreferrer' : undefined;
}

function Footer({
  items,
  footer,
  labels,
  slots,
}: {
  items: ShellViewNavigationItem[];
  footer: ShellLayoutProps['footer'];
  labels: ShellStaticLabels;
  slots: ShellViewSlots;
}) {
  const footerLinks = items.map((item) => (
    <ShellLink
      key={item.id}
      href={item.href}
      appearance="muted"
      size="xs"
      controlSize="xs"
      target={linkTarget(item)}
      rel={linkRel(item)}
    >
      {item.label}
    </ShellLink>
  ));

  const footerActions = (languageControl: ReactNode) => (
    <>
      {languageControl}
      <ShellLink href="/login?intent=newsletter" appearance="muted" size="xs" controlSize="xs">
        {labels.newsletter}
      </ShellLink>
      <ShellCookieSettingsButton label={labels.cookieSettings} />
      <ShellChangelogLink label={labels.changelog} />
      <DsLayoutInset block="xxs">
        <DsText as="span" size="xs" tone="secondary">
          {footer.version}
        </DsText>
      </DsLayoutInset>
    </>
  );

  return (
    <>
      <LayoutVisibility visibleFrom="sm">
        <LayoutGrid columns={{ base: 1, sm: 3 }} gap="xl">
          <DsLayoutStack as="section" aria-labelledby="footer-brand-desktop">
            <VisuallyHidden as="h2" id="footer-brand-desktop">
              {labels.footerSiteInfo}
            </VisuallyHidden>
            <DsText size="xs" tone="secondary">
              {footer.siteTitle}
            </DsText>
            {footer.description ? (
              <DsText size="xs" tone="secondary">
                {footer.description}
              </DsText>
            ) : null}
          </DsLayoutStack>

          <DsLayoutStack as="nav" aria-labelledby="footer-links-desktop" gap="xs">
            <VisuallyHidden as="h2" id="footer-links-desktop">
              {labels.footerLinks}
            </VisuallyHidden>
            {footerLinks}
          </DsLayoutStack>

          <DsLayoutStack as="section" aria-labelledby="footer-social-desktop" gap="xs">
            <VisuallyHidden as="h2" id="footer-social-desktop">
              {labels.footerSocialMedia}
            </VisuallyHidden>
            {slots.socialLinks}
          </DsLayoutStack>
        </LayoutGrid>

        <DsLayoutInset blockStart="md">
          <Separator />
          <DsLayoutInset blockStart="md">
            <DsLayoutInline justify="between" align="center" gap="md" wrap="wrap">
              <DsLayoutInline gap="md" wrap="wrap">
                {footer.copyright ? (
                  <DsText size="xs" tone="secondary" suppressHydrationWarning>
                    {footer.copyright}
                  </DsText>
                ) : null}
                {footer.taxId ? (
                  <DsText size="xs" tone="secondary">
                    {footer.taxId}
                  </DsText>
                ) : null}
                {footer.companyAddress ? (
                  <DsText size="xs" tone="secondary">
                    {footer.companyAddress}
                  </DsText>
                ) : null}
              </DsLayoutInline>
              <DsLayoutInline gap="xs" wrap="wrap">
                {footerActions(slots.languageFooterDesktop)}
              </DsLayoutInline>
            </DsLayoutInline>
          </DsLayoutInset>
        </DsLayoutInset>
      </LayoutVisibility>

      <LayoutVisibility hiddenFrom="sm">
        <DsLayoutStack align="center" gap="xs">
          <DsLayoutInline justify="center" gap="sm" wrap="wrap">
            {footerLinks}
          </DsLayoutInline>
          {footer.copyright || footer.taxId ? (
            <DsText size="xs" tone="secondary" suppressHydrationWarning>
              {[footer.copyright, footer.taxId].filter(Boolean).join(' · ')}
            </DsText>
          ) : null}
          <DsLayoutInline justify="center" gap="xs" wrap="wrap">
            {footerActions(slots.languageFooterMobile)}
          </DsLayoutInline>
        </DsLayoutStack>
      </LayoutVisibility>
    </>
  );
}

/** The public site shell. Wrap in `ShellRuntime` (application) or render through `ShellView`. */
export function ShellLayout({
  children,
  headerItems,
  secondaryItems,
  footerItems,
  accountItems,
  footer,
  labels,
  slots,
}: ShellLayoutProps) {
  const accountLabels = { account: labels.account, logOut: labels.logOut, signIn: labels.signIn };
  return (
    <ShellFrame
      header={
        <SiteHeader
          navigationToggle={<ShellNavigationToggle label={labels.toggleNavigation} />}
          mobileLeadingActions={<ShellThemeToggle label={labels.toggleColorScheme} variant="mobile" />}
          logo={<ShellHomeLink label={footer.siteTitle}>{slots.logo}</ShellHomeLink>}
          desktopActions={
            <DsLayoutStack gap="none" fill="block" justify="between">
              <DsLayoutInline justify="end" gap="xs" wrap="nowrap">
                {secondaryItems.map((item) => (
                  <ShellLink
                    key={item.id}
                    href={item.href}
                    density="chrome"
                    size="xs"
                    nowrap
                    target={linkTarget(item)}
                    rel={linkRel(item)}
                  >
                    {item.label}
                  </ShellLink>
                ))}
                <ShellSearchAction label={labels.search} variant="desktop" />
                {slots.languageDesktop}
                <ShellThemeToggle label={labels.toggleColorScheme} variant="desktop" />
                <ShellAccountDesktop items={accountItems} labels={accountLabels} />
              </DsLayoutInline>
              <DsLayoutInline gap="none" justify="start">
                <ShellDesktopNavigation items={headerItems} label={labels.navigation} />
              </DsLayoutInline>
            </DsLayoutStack>
          }
          mobileActions={
            <>
              <ShellSearchAction label={labels.search} variant="mobile" />
              <ShellAccountMobile labels={accountLabels} />
            </>
          }
        />
      }
      navigationFooter={slots.languageNavigation}
      headerItems={headerItems}
      secondaryItems={secondaryItems}
      footer={<Footer items={footerItems} footer={footer} labels={labels} slots={slots} />}
      accountItems={accountItems}
      labels={{ navigation: labels.navigation, close: labels.close, account: labels.account, logOut: labels.logOut }}
    >
      <div className={viewClasses.printOnly}>{slots.printHeader}</div>

      <div className={`${viewClasses.printOnly} print-watermark`}>{slots.printWatermark}</div>

      {children}
    </ShellFrame>
  );
}
