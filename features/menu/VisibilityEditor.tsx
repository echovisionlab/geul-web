'use client';

import { Group, Stack, Text } from '@mantine/core';
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
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        Visibility
      </Text>

      <Radio.Group
        value={value.mode}
        onChange={(mode) =>
          onChange({
            mode: mode as VisibilityMode,
            roles: mode === 'roles' ? value.roles || ['admin'] : undefined,
          })
        }
      >
        <Stack gap="xs">
          {MODE_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              disabled={disabled}
            />
          ))}
        </Stack>
      </Radio.Group>

      {value.mode === 'roles' && (
        <Checkbox.Group
          value={value.roles || []}
          onChange={(roles) => onChange({ ...value, roles: roles as VisibilityRole[] })}
        >
          <Group gap="md" mt="xs">
            {ROLES.map((role) => (
              <Checkbox key={role.value} value={role.value} label={role.label} disabled={disabled} />
            ))}
          </Group>
        </Checkbox.Group>
      )}
    </Stack>
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
