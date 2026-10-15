import type { ArgTypes, ArgTypesEnhancer, StrictArgTypes } from 'storybook/internal/types';
import componentRegistry from '../stories/design-system/components/component-docs.generated.json';

interface ApiProperty {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

/** Prefer the actual default or interactive example before a named state. */
export function representativeStory<T extends { id: string; name: string }>(stories: T[]) {
  return (
    stories.find((story) => story.id.endsWith('--default')) ??
    stories.find((story) => story.id.endsWith('--playground')) ??
    stories[0]
  );
}

export function literalOptions(type: string) {
  if (!/^'[^']+'(?:\s*\|\s*'[^']+')+$/.test(type)) {
    return undefined;
  }
  return [...type.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

/** Enrich only args already exposed by the actual story. Fixture args stay local. */
export function coreArgTypes(argTypes: StrictArgTypes, api: ApiProperty[]): StrictArgTypes;
export function coreArgTypes(argTypes: ArgTypes, api: ApiProperty[]): ArgTypes;
export function coreArgTypes(argTypes: ArgTypes, api: ApiProperty[]): ArgTypes {
  const properties = new Map(api.map((property) => [property.name, property]));
  return Object.fromEntries(
    Object.entries(argTypes).map(([name, current]) => {
      const property = properties.get(name);
      if (!property) {
        return [name, { ...current, name: current.name ?? name }];
      }
      if (property.type === 'never') {
        return [
          name,
          { ...current, name: current.name ?? name, control: false, table: { ...current.table, disable: true } },
        ];
      }
      const options = literalOptions(property.type);
      const configurable = current.control !== false && !current.options;
      return [
        name,
        {
          ...current,
          name: current.name ?? name,
          ...(configurable && options ? { options, control: { type: 'select' } } : {}),
          ...(configurable && property.type === 'boolean' ? { control: { type: 'boolean' } } : {}),
          description: current.description ?? property.description,
          table: {
            ...current.table,
            type: { summary: property.type },
            ...(property.defaultValue !== undefined ? { defaultValue: { summary: property.defaultValue } } : {}),
          },
        },
      ];
    }),
  );
}

export const enhanceCoreArgTypes: ArgTypesEnhancer = (context) => {
  const component = componentRegistry.components.find((entry) => entry.title === context.title);
  if (!component) {
    return context.argTypes;
  }
  // Storybook appends its inference passes during normalization. Seed only
  // existing story args so their source metadata survives that later inference.
  const exposed = Object.fromEntries(Object.keys(context.initialArgs).map((name) => [name, { name }]));
  return coreArgTypes({ ...exposed, ...context.argTypes }, component.api);
};

// Group with the inference pass; source controls remain explicit user metadata.
Object.assign(enhanceCoreArgTypes, { secondPass: true });
