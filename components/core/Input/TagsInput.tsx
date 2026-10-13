'use client';

import { forwardRef, useState, useId } from 'react';
import { Button, Group, Input, Tag, TagGroup, TagList, TextField } from 'react-aria-components';
import { InputHelp, InputLabel, inputPresentation, inputState, useToolbarInputPresentation } from './InputParts';
import { inputAttributes, type InputBaseProps } from './input-contract';
import classes from './Input.module.css';
import { useCoreInputLabels } from './input-labels';
import { InputClearGlyph } from './InputGlyphs';
export interface TagsInputProps extends InputBaseProps {
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  data?: readonly string[];
  maxTags?: number;
  splitChars?: readonly string[];
  clearable?: boolean;
  acceptValueOnBlur?: boolean;
}
export const TagsInput = forwardRef<HTMLInputElement, TagsInputProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const suggestionsId = useId();
  const [draft, setDraft] = useState('');
  const [uncontrolled, setUncontrolled] = useState(props.defaultValue ?? []);
  const values = props.value ?? uncontrolled;
  const update = (next: string[]) => {
    if (props.disabled || props.readOnly) {
      return;
    }
    setUncontrolled(next);
    props.onChange?.(next);
  };
  const commit = () => {
    const next = draft.trim();
    if (next && !values.includes(next) && (!props.maxTags || values.length < props.maxTags)) {
      update([...values, next]);
    }
    setDraft('');
  };
  return (
    <TextField
      {...inputAttributes(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      value={draft}
      onChange={setDraft}
    >
      <InputLabel {...props} />
      <Group className={classes.wrapper}>
        <div className={classes.valueList}>
          <TagGroup
            className={classes.tags}
            aria-label={typeof props.label === 'string' ? props.label : (props['aria-label'] ?? labels.tags)}
            onRemove={(keys) => update(values.filter((value) => !keys.has(value)))}
          >
            <TagList items={values.map((value) => ({ id: value }))}>
              {(item) => (
                <Tag id={item.id} textValue={item.id} className={classes.tag}>
                  {item.id}
                  {!props.readOnly && !props.disabled ? (
                    <Button slot="remove" className={classes.tagRemove}>
                      <InputClearGlyph />
                    </Button>
                  ) : null}
                </Tag>
              )}
            </TagList>
          </TagGroup>
          <Input
            ref={ref}
            id={props.id}
            list={props.data ? suggestionsId : undefined}
            className={classes.input}
            placeholder={props.placeholder}
            onFocus={props.onFocus}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || (props.splitChars ?? [',']).includes(event.key)) {
                event.preventDefault();
                commit();
              }
              if (event.key === 'Backspace' && !draft) {
                update(values.slice(0, -1));
              }
              props.onKeyDown?.(event);
            }}
            onBlur={(event) => {
              if (props.acceptValueOnBlur) {
                commit();
              }
              props.onBlur?.(event);
            }}
          />
        </div>
        {props.clearable && values.length ? (
          <Button
            className={classes.accessory}
            aria-label={labels.clear}
            onPress={() => update([])}
            isDisabled={props.disabled || props.readOnly}
          >
            <InputClearGlyph />
          </Button>
        ) : null}
      </Group>
      {props.data ? (
        <datalist id={suggestionsId}>
          {props.data
            .filter((value) => !values.includes(value))
            .map((value) => (
              <option key={value} value={value} />
            ))}
        </datalist>
      ) : null}
      <InputHelp {...props} />
    </TextField>
  );
});
TagsInput.displayName = 'TagsInput';
