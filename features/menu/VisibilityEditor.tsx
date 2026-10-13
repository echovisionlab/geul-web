'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { Checkbox, Radio } from '@/components/core/Input';

// Local types for flexibility with action return types
type VisibilityMode = 'all' | 'authenticated' | 'guest' | 'roles';
type VisibilityRole = 'admin' | 'author' | 'user';

interface VisibilityValue {
  mode: string;
  roles?: string[];
}

interface VisibilityEditorProps {
  value: VisibilityValue;
  onChange: (visibility: VisibilityValue) => void;
  disabled?: boolean;
}

const ROLES: { value: VisibilityRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'author', label: 'Author' },
  { value: 'user', label: 'User' },
];

const MODE_OPTIONS: { value: VisibilityMode; label: string; description: string }[] = [
  { value: 'all', label: 'Everyone', description: 'Visible to all visitors' },
  {
    value: 'authenticated',
    label: 'Logged in only',
    description: 'Only visible to logged in users',
  },
  { value: 'guest', label: 'Guests only', description: 'Only visible to users not logged in' },
  { value: 'roles', label: 'Specific roles', description: 'Only visible to selected roles' },
];

export function VisibilityEditor({ value, onChange, disabled = false }: VisibilityEditorProps) {
  return (
    <DsLayoutStack gap="sm">
      <DsText size="sm" weight="medium">
        Visibility
      </DsText>

      <Radio.Group
        value={value.mode}
        onChange={(mode) =>
          onChange({
            mode: mode as VisibilityMode,
            roles: mode === 'roles' ? value.roles || ['admin'] : undefined,
          })
        }
      >
        <DsLayoutStack gap="xs">
          {MODE_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              disabled={disabled}
            />
          ))}
        </DsLayoutStack>
      </Radio.Group>

      {value.mode === 'roles' && (
        <Checkbox.Group
          value={value.roles || []}
          onChange={(roles) => onChange({ ...value, roles: roles as VisibilityRole[] })}
        >
          <DsLayoutInset blockStart="xs">
            <DsLayoutInline gap="md">
              {ROLES.map((role) => (
                <Checkbox key={role.value} value={role.value} label={role.label} disabled={disabled} />
              ))}
            </DsLayoutInline>
          </DsLayoutInset>
        </Checkbox.Group>
      )}
    </DsLayoutStack>
  );
}

export function getVisibilityLabel(visibility?: VisibilityValue): string {
  if (!visibility) {
    return 'Everyone';
  }

  switch (visibility.mode) {
    case 'all':
      return 'Everyone';
    case 'authenticated':
      return 'Logged in';
    case 'guest':
      return 'Guests';
    case 'roles':
      return visibility.roles?.join(', ') || 'None';
    default:
      return 'Everyone';
  }
}
