import { Text as DsText } from '@/components/core/Typography';
import {
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
export interface PrintHeaderViewProps {
  logoSrc: string | null;
  logoAlt: string;
  companyName: string | null;
  taxId: string | null;
}
export function PrintHeaderView({ logoSrc, logoAlt, companyName, taxId }: PrintHeaderViewProps) {
  return (
    <div className="print-header">
      {/* The identity block keeps the inline end with or without a logo. */}
      <DsLayoutInline justify={logoSrc ? 'between' : 'end'} align="start" wrap="nowrap">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={logoAlt}
            style={{
              height: 24,
              width: 'auto',
              objectFit: 'contain',
              border: 0,
            }}
          />
        ) : null}

        {companyName || taxId ? (
          <DsLayoutStack gap="none" align="end">
            {companyName ? (
              <DsText size="sm" weight="strong">
                {companyName}
              </DsText>
            ) : null}
            {taxId ? (
              <DsLayoutInset blockStart="xxs">
                <DsText size="xs" tone="secondary">
                  {taxId}
                </DsText>
              </DsLayoutInset>
            ) : null}
          </DsLayoutStack>
        ) : null}
      </DsLayoutInline>
    </div>
  );
}
