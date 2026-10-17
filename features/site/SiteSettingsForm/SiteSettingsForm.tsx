'use client';

import { fieldBindings } from '@/components/core/bindings';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { useForm } from '@mantine/form';
import { useWindowEvent } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { ColorInput, Select, Switch, Textarea, TextInput } from '@/components/core/Input';
import { PageHeader } from '@/components/core/PageHeader';
import { SettingsGroup, SettingsSection } from '@/components/core/Section';
import { SocialLinksEditor } from '@/features/social-links/SocialLinksEditor';
import type { SiteSettingsFormValues, SiteSettingsPatch, SiteSettingsView } from '@/lib/types/site-setting/config';
import { resolveSiteSettingsFormRefresh, toSiteSettingsFormValues } from '@/lib/types/site-setting/form';
import { extractChangedFields } from '@/lib/utils/form-diff';

export interface SiteSettingsOption {
  label: string;
  value: string;
}

export interface SiteSettingsFormProps {
  branding: ReactNode;
  maintenance?: ReactNode;
  menus: SiteSettingsOption[];
  onSubmit: (patch: SiteSettingsPatch) => Promise<boolean>;
  pages: SiteSettingsOption[];
  saving: boolean;
  settings: SiteSettingsView;
}

export function SiteSettingsForm({
  branding,
  maintenance,
  menus,
  onSubmit,
  pages,
  saving,
  settings,
}: SiteSettingsFormProps) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminSettings.site');
  const initialValues = toSiteSettingsFormValues(settings);
  const form = useForm<SiteSettingsFormValues>({
    mode: 'controlled',
    initialValues,
    validate: {
      legal_email: (value) => {
        if (!value) {
          return null;
        }
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : tPage('validation.invalidEmail');
      },
      contact_email: (value) => {
        if (!value) {
          return null;
        }
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : tPage('validation.invalidEmail');
      },
      primary_color: (value) => (/^#[0-9A-Fa-f]{6}$/.test(value) ? null : tPage('validation.invalidHexColor')),
      google_analytics_id: (value) => {
        if (!value) {
          return null;
        }
        return /^(G|UA|GT)-[A-Z0-9]+$/.test(value) ? null : tPage('validation.invalidGoogleAnalyticsId');
      },
    },
  });
  const [baseline, setBaseline] = useState(initialValues);

  useEffect(() => {
    const refresh = resolveSiteSettingsFormRefresh(form.values, baseline, settings);
    if (refresh.shouldReplaceValues) {
      form.setValues(refresh.values);
      setBaseline(refresh.baseline);
    }
  }, [settings]);

  const hasUnsavedChanges = Object.keys(extractChangedFields(baseline, form.values)).length > 0;

  useWindowEvent('beforeunload', (event) => {
    if (hasUnsavedChanges) {
      event.preventDefault();
    }
  });

  const baseEmailInputProps = {
    type: 'text' as const,
    inputMode: 'email' as const,
    autoCapitalize: 'none' as const,
    autoCorrect: 'off',
    spellCheck: false,
    autoComplete: 'new-password',
    'data-1p-ignore': 'true',
    'data-lpignore': 'true',
  };

  const getEmailFieldProps = (field: 'legal_email' | 'contact_email') => ({
    value: form.values[field] ?? '',
    error: form.errors[field],
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      form.setFieldValue(field, event.currentTarget.value);
    },
    onBlur: () => {
      form.validateField(field);
    },
  });

  const getTextInputProps = (field: 'tax_id' | 'google_analytics_id') => {
    const props = form.getInputProps(field);
    return {
      ...props,
      value: props.value ?? '',
    };
  };

  const handleSubmit = async (values: SiteSettingsFormValues) => {
    const changedFields = extractChangedFields(baseline, values);
    if (Object.keys(changedFields).length === 0) {
      notifications.show({ message: tPage('notifications.noChanges'), tone: 'neutral' });
      return;
    }

    if (await onSubmit(changedFields)) {
      setBaseline(values);
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} autoComplete="off" aria-label={tPage('title')} aria-busy={saving}>
      <DsLayoutStack gap="xl">
        <PageHeader title={tPage('title')} description={tPage('description')} />

        <SettingsSection title={tPage('sections.general.title')}>
          <DsLayoutStack gap="md">
            <TextInput
              label={tPage('fields.siteTitle.label')}
              description={tPage('fields.siteTitle.description')}
              {...fieldBindings(form.getInputProps('site_title'))}
            />
            <TextInput
              label={tCommon('labels.companyName')}
              description={tPage('fields.companyName.description')}
              placeholder={tPage('fields.companyName.placeholder')}
              {...fieldBindings(form.getInputProps('company_name'))}
            />
            <TextInput
              label={tCommon('labels.address')}
              description={tPage('fields.companyAddress.description')}
              placeholder={tPage('fields.companyAddress.placeholder')}
              {...fieldBindings(form.getInputProps('company_address'))}
            />
            <TextInput
              label={tPage('fields.taxId.label')}
              description={tPage('fields.taxId.description')}
              placeholder={tPage('fields.taxId.placeholder')}
              {...fieldBindings(getTextInputProps('tax_id'))}
            />
          </DsLayoutStack>
          <SettingsGroup title={tPage('sections.general.contactEmails')}>
            <TextInput
              {...baseEmailInputProps}
              label={tPage('fields.legalEmail.label')}
              description={tPage('fields.legalEmail.description')}
              placeholder={tPage('fields.legalEmail.placeholder')}
              name="legal_contact_email"
              {...fieldBindings(getEmailFieldProps('legal_email'))}
            />
            <TextInput
              {...baseEmailInputProps}
              label={tPage('fields.contactEmail.label')}
              description={tPage('fields.contactEmail.description')}
              placeholder={tPage('fields.contactEmail.placeholder')}
              name="contact_email"
              {...fieldBindings(getEmailFieldProps('contact_email'))}
            />
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection title={tPage('sections.branding.title')}>
          <ColorInput
            label={tPage('fields.primaryColor.label')}
            description={tPage('fields.primaryColor.description')}
            format="hex"
            {...fieldBindings(form.getInputProps('primary_color'))}
          />
          {branding}
        </SettingsSection>

        <SettingsSection
          title={tPage('sections.general.socialLinks')}
          description={tPage('sections.general.socialLinksDescription')}
        >
          <SocialLinksEditor
            value={form.values.social_links || {}}
            onChange={(value) => form.setFieldValue('social_links', value)}
            label={tPage('sections.general.socialLinks')}
            labelHidden
          />
        </SettingsSection>

        <SettingsSection title={tPage('sections.contentDisplay.title')}>
          <DsLayoutStack gap="md">
            <Switch
              label={tPage('fields.defaultCommentsEnabled.label')}
              description={tPage('fields.defaultCommentsEnabled.description')}
              {...fieldBindings(form.getInputProps('default_comments_enabled', { type: 'checkbox' }))}
            />
            <Select
              label={tPage('fields.homepage.label')}
              description={tPage('fields.homepage.description')}
              placeholder={tPage('fields.homepage.placeholder')}
              clearable
              searchable
              data={pages}
              {...fieldBindings(form.getInputProps('homepage_page_id'))}
            />
          </DsLayoutStack>
          <SettingsGroup
            title={tPage('sections.contentDisplay.navigation')}
            description={tPage('sections.contentDisplay.navigationDescription')}
          >
            <Select
              label={tPage('fields.headerMenu.label')}
              description={tPage('fields.headerMenu.description')}
              placeholder={tPage('fields.menuPlaceholder')}
              clearable
              searchable
              data={menus}
              {...fieldBindings(form.getInputProps('menu_header_id'))}
            />
            <Select
              label={tPage('fields.secondaryLinks.label')}
              description={tPage('fields.secondaryLinks.description')}
              placeholder={tPage('fields.menuPlaceholder')}
              clearable
              searchable
              data={menus}
              {...fieldBindings(form.getInputProps('menu_secondary_id'))}
            />
            <Select
              label={tPage('fields.footerMenu.label')}
              description={tPage('fields.footerMenu.description')}
              placeholder={tPage('fields.menuPlaceholder')}
              clearable
              searchable
              data={menus}
              {...fieldBindings(form.getInputProps('menu_footer_id'))}
            />
            <Select
              label={tPage('fields.avatarDropdownMenu.label')}
              description={tPage('fields.avatarDropdownMenu.description')}
              placeholder={tPage('fields.menuPlaceholder')}
              clearable
              searchable
              data={menus}
              {...fieldBindings(form.getInputProps('menu_avatar_dropdown_id'))}
            />
          </SettingsGroup>
        </SettingsSection>

        <SettingsSection title={tPage('sections.seo.title')}>
          <DsLayoutStack gap="md">
            <Textarea
              label={tPage('fields.siteDescription.label')}
              description={tPage('fields.siteDescription.description')}
              rows={3}
              {...fieldBindings(form.getInputProps('meta_description'))}
            />
            <TextInput
              label={tPage('fields.googleAnalyticsId.label')}
              description={tPage('fields.googleAnalyticsId.description')}
              placeholder={tPage('fields.googleAnalyticsId.placeholder')}
              {...fieldBindings(getTextInputProps('google_analytics_id'))}
            />
          </DsLayoutStack>
        </SettingsSection>

        {maintenance}

        <DsLayoutInline justify="end">
          <Button type="submit" emphasis="medium" loading={saving} disabled={!hasUnsavedChanges}>
            {tCommon('actions.saveChanges')}
          </Button>
        </DsLayoutInline>
      </DsLayoutStack>
    </form>
  );
}
