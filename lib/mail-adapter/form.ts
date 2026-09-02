export type MailAdapterFormType = 'logging' | 'ses' | 'smtp';

export interface MailAdapterFormValues {
  name: string;
  type: MailAdapterFormType;
  isActive: boolean;
  priority: number;
  sesRegion: string;
  sesAccessKeyId: string;
  sesSecretAccessKey: string;
  sesFromEmail: string;
  sesFromName: string;
  smtpHost: string;
  smtpPort: number | string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpFromName: string;
}

interface NormalizedMailAdapterFormValues extends Omit<MailAdapterFormValues, 'smtpPort'> {
  smtpPort: number;
}

function trim(value: string): string {
  return value.trim();
}

function normalizePort(value: number | string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMailAdapterFormValues(values: MailAdapterFormValues): NormalizedMailAdapterFormValues {
  return {
    ...values,
    name: trim(values.name),
    sesRegion: trim(values.sesRegion),
    sesAccessKeyId: trim(values.sesAccessKeyId),
    sesSecretAccessKey: trim(values.sesSecretAccessKey),
    sesFromEmail: trim(values.sesFromEmail),
    sesFromName: trim(values.sesFromName),
    smtpHost: trim(values.smtpHost),
    smtpPort: normalizePort(values.smtpPort),
    smtpUser: trim(values.smtpUser),
    smtpPassword: trim(values.smtpPassword),
    smtpFromEmail: trim(values.smtpFromEmail),
    smtpFromName: trim(values.smtpFromName),
  };
}

export function buildMailAdapterConfigPayload(values: MailAdapterFormValues) {
  const normalized = normalizeMailAdapterFormValues(values);

  return {
    sesConfig:
      normalized.type === 'ses'
        ? {
            region: normalized.sesRegion,
            accessKeyId: normalized.sesAccessKeyId,
            secretAccessKey: normalized.sesSecretAccessKey,
            fromEmail: normalized.sesFromEmail,
            fromName: normalized.sesFromName || undefined,
          }
        : undefined,
    smtpConfig:
      normalized.type === 'smtp'
        ? {
            host: normalized.smtpHost,
            port: normalized.smtpPort,
            secure: normalized.smtpSecure,
            user: normalized.smtpUser,
            password: normalized.smtpPassword,
            fromEmail: normalized.smtpFromEmail,
            fromName: normalized.smtpFromName || undefined,
          }
        : undefined,
  };
}

export function getMailAdapterConfigFingerprint(values: MailAdapterFormValues): string {
  const payload = buildMailAdapterConfigPayload(values);
  return JSON.stringify({
    type: values.type,
    sesConfig: payload.sesConfig ?? null,
    smtpConfig: payload.smtpConfig ?? null,
  });
}
