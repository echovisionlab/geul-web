'use client';

import { Select } from '@/components/core/Input';

export interface ArtistParentOption {
  id: string;
  name: string;
}

interface ArtistParentSelectProps {
  id: string;
  label: string;
  placeholder: string;
  options: ArtistParentOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ArtistParentSelect({ id, label, placeholder, options, value, onChange }: ArtistParentSelectProps) {
  return (
    <Select
      id={id}
      label={label}
      placeholder={placeholder}
      data={options.map((option) => ({ value: option.id, label: option.name }))}
      value={value}
      onChange={onChange}
      searchable
      clearable
    />
  );
}
