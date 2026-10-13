// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { loadClientMessagesForLocale } from '@/lib/i18n/client-message-loaders';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n/locale';
import meta, { LabelledRecovery } from '../../components/core/Input/PinInput.stories';

let cleanup = () => {};
afterEach(() => {
  cleanup();
  cleanup = () => {};
});

describe('PIN recovery Storybook locale fixture', () => {
  it('keeps English defaults and relocalizes names, descriptions and errors without losing the entered code', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    cleanup = () => {
      act(() => root.unmount());
      host.remove();
    };
    const renderStory = LabelledRecovery.render!;
    const args = { ...meta.args, ...LabelledRecovery.args };

    async function render(locale: SupportedLocale) {
      const messages = await loadClientMessagesForLocale(locale);
      act(() =>
        root.render(
          <NextIntlClientProvider locale={locale} messages={messages}>
            {renderStory(args, {} as Parameters<typeof renderStory>[1])}
          </NextIntlClientProvider>,
        ),
      );
      return messages;
    }
    const en = await render('en');
    expect(host.querySelector('label')).toHaveTextContent('Verification code');
    expect(host.querySelector('[role="group"][data-geul-pin-length]')).toHaveAccessibleName('Verification code');
    expect(host.querySelector('input')).toHaveAccessibleDescription(
      `${en.auth.verification.sentEmail.description} ${en.auth.common.codeTiming.expired}`,
    );
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '123456' } });
    act(() => host.querySelector('input')!.dispatchEvent(paste));

    for (const locale of ['ko', 'ja', 'ar', 'en'] as const) {
      const messages = await render(locale);
      const label = messages.auth.verification.sentEmail.codeLabel;
      const description = `${messages.auth.verification.sentEmail.description} ${messages.auth.common.codeTiming.expired}`;
      expect(host.querySelector('label')).toHaveTextContent(label);
      expect(host.querySelector('[role="group"][data-geul-pin-length]')).toHaveAccessibleName(label);
      const inputs = [...host.querySelectorAll('input')];
      expect(inputs.map((input) => input.value).join('')).toBe('123456');
      for (const [index, input] of inputs.entries()) {
        expect(input).toHaveAccessibleName(`${label} ${index + 1}`);
        expect(input).toHaveAccessibleDescription(description);
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-required', 'true');
      }
    }
  });

  it('uses production recovery vocabulary available for every toolbar locale', async () => {
    const { createStorybookText, localizeFixtureArgs } = await import('@/.storybook/fixture-i18n');
    for (const locale of SUPPORTED_LOCALES) {
      const messages = await loadClientMessagesForLocale(locale);
      const text = createStorybookText(locale, messages);
      const args = localizeFixtureArgs(LabelledRecovery.args!, text);
      expect(args.label).toBe(messages.auth.verification.sentEmail.codeLabel);
      expect(args.description).toBe(messages.auth.verification.sentEmail.description);
      expect(args.error).toBe(messages.auth.common.codeTiming.expired);
    }
  });
});
