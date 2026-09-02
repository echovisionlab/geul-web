/**
 * Field Type Registry Core
 * Contains only the registry class and instance - no field imports
 */

import type { FieldType, FieldTypeDefinition } from '@/lib/types/form/model';

class FieldTypeRegistry {
  private definitions = new Map<FieldType, FieldTypeDefinition>();

  register(definition: FieldTypeDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  get(type: FieldType): FieldTypeDefinition | undefined {
    return this.definitions.get(type);
  }

  getAll(): FieldTypeDefinition[] {
    return [...this.definitions.values()];
  }

  getValidators(type: FieldType): string[] {
    return this.definitions.get(type)?.validators ?? [];
  }

  has(type: FieldType): boolean {
    return this.definitions.has(type);
  }
}

export const fieldTypeRegistry = new FieldTypeRegistry();
