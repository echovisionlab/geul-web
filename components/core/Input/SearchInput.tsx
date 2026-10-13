'use client';

import { IconSearch } from '@tabler/icons-react';
import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from './TextInput';
import classes from './SearchInput.module.css';

/** Core-owned leading search glyph, sized by the surrounding input size. */
export function SearchGlyph() {
  return (
    <span className={classes.glyph} data-search-glyph="">
      <IconSearch size="1em" aria-hidden focusable={false} />
    </span>
  );
}

export interface SearchInputProps extends Omit<TextInputProps, 'type' | 'leftSection' | 'inputMode'> {
  /** Search semantics and the leading glyph are owned by SearchInput. */
  type?: never;
  leftSection?: never;
  inputMode?: never;
}

/** A free-text query field: native search semantics with Core's leading search glyph. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>((props, ref) => (
  <TextInput {...props} ref={ref} type="search" inputMode="search" leftSection={<SearchGlyph />} />
));
SearchInput.displayName = 'SearchInput';
