import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { createTranslator, useLocale, useMessages, type AbstractIntlMessages } from 'next-intl';
import type { Args } from '@storybook/nextjs';
import enMessages from '../messages/en.json';
import koMessages from '../messages/ko.json';
import { kitFixtureMessages } from './kit-fixture-messages';
import { coreFixtureAliases } from './core-fixture-aliases';

/** Preview frames contain English instructions around localized production specimens. */
export const documentationFrame = Symbol('storybook-documentation-frame');

export type StorybookText = (text: string, values?: Record<string, string | number>) => string;
const messagePaths = new Map<string, string>();
function indexMessages(messages: Record<string, unknown>, prefix = '') {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' && !messagePaths.has(value)) {
      messagePaths.set(value, path);
    } else if (value && typeof value === 'object') {
      indexMessages(value as Record<string, unknown>, path);
    }
  }
}
indexMessages(enMessages);
indexMessages(koMessages);

/** Preview wording may reuse the closest production vocabulary; sample authored content is never translated. */
const aliases: Record<string, string> = {
  'Select {name}': 'fileManager.selectItem',
  'Choose an available visibility.': 'common.labels.required',
  Empty: 'common.states.empty',
  'Copy UID': 'common.actions.copy',
  'UID copied': 'common.actions.copied',
  'Profile saved': 'profile.notifications.updated',
  'Sort collections by name': 'common.labels.sortOrder',
  'Select all': 'fileManager.selectAll',
  'Protected page': 'pageShareAccess.title',
  'Enter a password to view this shared page.': 'pageShareAccess.description',
  'Unlock page': 'pageShareAccess.submit',
  'Incorrect password. Try preview.': 'pageShareAccess.errors.incorrect_password',
  'Access could not be checked. Try again.': 'common.errors.generic',
  'Preview access granted.': 'common.notifications.saveSuccess',
  'Close series dialog': 'common.actions.close',
  'Preview link': 'common.labels.url',
  'Share series': 'common.actions.share',
  Revoke: 'security.mcpIntegration.revoke',
  'Email preferences': 'settings.page.newsletterTitle',
  'Account settings': 'common.labels.account',
  'Profile, security, and email preferences': 'common.labels.account',
  'Primary email': 'security.email.canonical',
  'Change email': 'security.email.changeAction',
  'Used for account recovery and security notices.': 'security.email.description',
  'Email verification': 'auth.verification.chooseMethod.title',
  'Account email': 'security.email.title',
  'Review the devices signed in to your account.': 'security.sessions.description',
  'Log out other devices': 'security.sessions.logoutOthers',
  'Revoke session': 'security.sessions.revoke',
  'You are subscribed to the newsletter.': 'settings.newsletter.subscribedAlert',
  'You are not subscribed to the newsletter.': 'settings.newsletter.unsubscribedAlert',
  'Security and legal notices are always sent.': 'settings.newsletter.footer',
  'Could not save preference': 'settings.languagePreference.errorTitle',
  'Preferences could not be saved. Try again.': 'settings.languagePreference.errorMessage',
  'The profile could not be saved. Your edits are preserved.': 'common.notifications.saveFailed',
  'The security change could not be saved.': 'common.notifications.saveFailed',
  'UID selected for preview.': 'common.actions.copied',
  'Email preference saved.': 'common.notifications.saveSuccess',
  'Change account email': 'security.email.changeAction',
  'Close email dialog': 'common.actions.close',
  'Save email': 'common.actions.save',
  'Account email saved.': 'security.email.mainEmailUpdated',
  'New email': 'common.labels.email',
  'Revoke sessions': 'security.sessions.revoke',
  'The selected preview sessions will be removed from this list.': 'security.sessions.description',
  'Close session dialog': 'common.actions.close',
  'Sessions revoked.': 'security.notifications.sessionsRevoked',
  'Choose the email address to verify.': 'auth.verification.chooseMethod.description',
  'This session has expired.': 'auth.verification.errors.flowNotFound',
  'Verify code': 'auth.verification.sentEmail.submitting',
  'The preview email is verified.': 'auth.verification.passedChallenge.description',
  'The code was accepted. Check again to complete this local flow.': 'auth.verification.applying.description',
  'Applying verification': 'auth.verification.applying.title',
  'Enter the preview code 123456.': 'auth.verification.sentEmail.description',
  'Verifying code…': 'auth.verification.sentEmail.submitting',
  'The verification request could not be completed.': 'auth.verification.errors.submitRetry',
  'Verification completed.': 'auth.verification.passedChallenge.title',
  'A new preview code is ready: 123456.': 'auth.common.checkYourEmailTitle',
  'Enter a valid email.': 'auth.verification.errors.invalidEmail',
  'The verification code is invalid.': 'auth.verification.errors.submit',
  'The collection could not be saved. Your inputs are preserved.': 'common.notifications.saveFailed',
  'Collections could not be refreshed. The previous rows remain available.': 'common.notifications.saveFailed',
  'Close collection dialog': 'common.actions.close',
  'Add marker': 'common.actions.add',
  Activity: 'common.labels.event',
  'Collection sections': 'common.labels.menu',
  'Collection settings panel': 'common.labels.settings',
  'Close preview': 'common.actions.close',
  'Share preview': 'common.actions.share',
  'Close share dialog': 'common.actions.close',
  'Save name': 'common.actions.save',
  'Enter a name.': 'common.errors.nameRequired',
  'This name is already in use.': 'nicknameField.unavailable',
  'Rename collection': 'fileManager.actions.rename',
  'Close rename dialog': 'common.actions.close',
  'Collection name': 'common.labels.name',
  'Search collections': 'common.placeholders.searchByName',
  'Create collection': 'common.actions.create',
  'Reset table': 'editorCommon.media.videoPlayer.controls.reset',
};

export function createStorybookText(locale: string, messages: AbstractIntlMessages): StorybookText {
  const translate = createTranslator({ locale, messages }) as unknown as {
    (key: string, values?: Record<string, string | number>): string;
    has: (key: string) => boolean;
  };
  return (text, values) => {
    const kitText = kitFixtureMessages[locale]?.[text];
    if (kitText) {
      return kitText.replace(/\{(\w+)\}/g, (match, key: string) => values?.[key]?.toString() ?? match);
    }
    if (locale === 'en' && !values) {
      return text;
    }
    const path = aliases[text] ?? coreFixtureAliases[text] ?? messagePaths.get(text);
    if (!path || !translate.has(path)) {
      return text;
    }
    // A fixture with an ICU template must supply its values instead of leaking placeholders.
    if (text.includes('{') && !values) {
      return text;
    }
    return translate(path, values);
  };
}

export function useStorybookText(): StorybookText {
  return createStorybookText(useLocale(), useMessages());
}

const visibleProps = new Set([
  'children',
  'label',
  'title',
  'description',
  'placeholder',
  'error',
  'aria-label',
  'ariaLabel',
  'submitLabel',
  'cancelLabel',
  'closeLabel',
  'emptyLabel',
  'searchLabel',
  'loadingLabel',
  'confirmLabel',
  'helperText',
  'tooltip',
  'caption',
  'content',
  'message',
  'emptyMessage',
  'loadingContent',
  'buttonLabel',
  'dateLabel',
  'timeLabel',
  'header',
  'emptyContent',
  'selectAllRowsLabel',
  'clearSelectionLabel',
  'addLabel',
  'removeLabel',
  'postsLabel',
  'selectLabel',
]);

function localizeLabels(value: unknown, text: StorybookText): unknown {
  if (typeof value === 'string') {
    return text(value);
  }
  if (typeof value === 'function') {
    return (...args: unknown[]) => localizeLabels(value(...args), text);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const localized = localizeLabels(item, text);
      return isValidElement(localized) ? cloneElement(localized, { key: localized.key ?? index }) : localized;
    });
  }
  if (isValidElement(value)) {
    return localizeFixtureTree(value, text);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeLabels(item, text)]));
  }
  return value;
}

/** Translate fixture UI props before React renders them, preserving control values, IDs, URLs and authored data. */
function projectFixtureProps(input: Record<string, unknown>, text: StorybookText): Record<string, unknown> {
  const result = { ...input };
  for (const [key, value] of Object.entries(input)) {
    if (key === 'labels' || visibleProps.has(key)) {
      result[key] = localizeLabels(value, text);
    } else if (key === 'data' && Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? { value: item, label: text(item) }
          : item && typeof item === 'object'
            ? projectFixtureProps(item, text)
            : item,
      );
    } else if (key === 'columns' && Array.isArray(value)) {
      result[key] = value.map((column: Record<string, unknown>) => {
        const localized = projectFixtureProps(column, text);
        if (typeof column.renderCell === 'function') {
          const render = column.renderCell;
          localized.renderCell = (...args: unknown[]) => {
            const cell = render(...args);
            // A raw cell string is authored row data; UI elements retain their localized labels.
            return typeof cell === 'string' ? cell : localizeFixtureTree(cell, text);
          };
        }
        return localized;
      });
    } else if (['sections', 'items', 'selection', 'rowAction', 'sort', 'action', 'actions'].includes(key)) {
      const projectItem = (item: unknown) =>
        isValidElement(item)
          ? localizeFixtureTree(item, text)
          : item && typeof item === 'object'
            ? projectFixtureProps(item as Record<string, unknown>, text)
            : item;
      result[key] = Array.isArray(value) ? value.map(projectItem) : projectItem(value);
    } else if (['getRowLabel', 'getAccessibleLabel', 'getRowActionLabel'].includes(key)) {
      result[key] = localizeLabels(value, text);
    }
  }
  return result;
}

export function localizeFixtureTree(node: ReactNode, text: StorybookText): ReactNode {
  if (typeof node === 'string') {
    return text(node);
  }
  if (Array.isArray(node)) {
    return Children.map(node, (item) => localizeFixtureTree(item, text));
  }
  if (!isValidElement(node)) {
    return node;
  }
  const element = node as ReactElement<Record<string, unknown>>;
  // Explicit English subtrees are documentation or authored sample content.
  if (element.props.lang === 'en') {
    return element;
  }
  const localized = projectFixtureProps(element.props, text);
  if (typeof element.type === 'function' && documentationFrame in element.type) {
    localized.title = element.props.title;
    localized.description = element.props.description;
  }
  return cloneElement(element, localized);
}

export function localizeFixtureArgs<T extends Args>(args: T, text: StorybookText): T {
  return projectFixtureProps(args, text) as T;
}

export function localizedRender<T extends Args, C>(render: (args: T, context: C) => ReactNode) {
  function FixtureRenderer({ args, context }: { args: T; context: C }) {
    return localizeFixtureTree(render(args, context), useStorybookText());
  }
  return (args: T, context: C) => <FixtureRenderer args={args} context={context} />;
}
