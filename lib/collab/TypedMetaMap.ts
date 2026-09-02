import type * as Y from 'yjs';
import { z } from 'zod';
import { createClientLogger } from '@/lib/utils/client-logger';

const logger = createClientLogger('TypedMetaMap');

type ZodObjectSchema = z.ZodObject<z.ZodRawShape>;
type InferSchema<TSchema extends ZodObjectSchema> = z.infer<TSchema>;
type SchemaKey<TSchema extends ZodObjectSchema> = keyof InferSchema<TSchema> & string;

/**
 * Type-safe wrapper for Y.Map with Zod schema validation.
 *
 * - All values are validated at runtime using Zod
 * - JSON fields are automatically serialized/deserialized
 * - Uses map.doc for transactions (no external doc parameter needed)
 */
export class TypedMetaMap<TSchema extends ZodObjectSchema> {
  constructor(
    private readonly map: Y.Map<unknown>,
    private readonly schema: TSchema,
    private readonly jsonKeys: ReadonlySet<SchemaKey<TSchema>>,
  ) {}

  /**
   * Get a value from the map with Zod validation.
   * Returns undefined if the value doesn't exist or fails validation.
   */
  get<K extends SchemaKey<TSchema>>(key: K): InferSchema<TSchema>[K] | undefined {
    const raw = this.map.get(key);
    if (raw === undefined) {
      return undefined;
    }

    // Parse JSON fields
    let value: unknown = raw;
    if (this.jsonKeys.has(key) && typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        logger.warn(`Failed to parse JSON for key "${key}"`);
        return undefined;
      }
    }

    // Validate with Zod
    const fieldSchema = this.schema.shape[key] as z.ZodTypeAny;
    const result = fieldSchema.safeParse(value);

    if (!result.success) {
      logger.warn(`Validation failed for key "${key}"`, {
        errors: z.flattenError(result.error),
      });
      return undefined;
    }

    return result.data as InferSchema<TSchema>[K];
  }

  /**
   * Set a value in the map with Zod validation.
   * Returns false if validation fails.
   */
  set<K extends SchemaKey<TSchema>>(key: K, value: InferSchema<TSchema>[K]): boolean {
    const fieldSchema = this.schema.shape[key] as z.ZodTypeAny;
    const result = fieldSchema.safeParse(value);

    if (!result.success) {
      logger.error(`Invalid value for key "${key}"`, {
        errors: z.flattenError(result.error),
      });
      return false;
    }

    const stored = this.jsonKeys.has(key) ? JSON.stringify(value) : value;
    this.map.doc?.transact(() => this.map.set(key, stored));
    return true;
  }

  /**
   * Set multiple values in a single transaction with Zod validation.
   * Returns false if any value fails validation.
   */
  setMany(values: Partial<InferSchema<TSchema>>): boolean {
    const entries = Object.entries(values) as Array<[SchemaKey<TSchema>, InferSchema<TSchema>[SchemaKey<TSchema>]]>;
    for (const [key, value] of entries) {
      const fieldSchema = this.schema.shape[key] as z.ZodTypeAny;
      const result = fieldSchema.safeParse(value);
      if (!result.success) {
        logger.error(`Invalid value for key "${key}"`, {
          errors: z.flattenError(result.error),
        });
        return false;
      }
    }

    this.map.doc?.transact(() => {
      for (const [key, value] of entries) {
        const stored = this.jsonKeys.has(key) ? JSON.stringify(value) : value;
        this.map.set(key, stored);
      }
    });

    return true;
  }

  /**
   * Initialize a value if it doesn't exist.
   */
  init<K extends SchemaKey<TSchema>>(key: K, defaultValue: InferSchema<TSchema>[K]): void {
    if (defaultValue !== undefined && this.map.get(key) === undefined) {
      const stored = this.jsonKeys.has(key) ? JSON.stringify(defaultValue) : defaultValue;
      this.map.set(key, stored);
    }
  }

  /**
   * Initialize all fields with default values.
   */
  initAll(defaults: InferSchema<TSchema>): void {
    const keys = Object.keys(this.schema.shape) as SchemaKey<TSchema>[];
    for (const key of keys) {
      this.init(key, defaults[key]);
    }
  }

  /**
   * Get all values from the map.
   */
  getAll(): Partial<InferSchema<TSchema>> {
    const result: Partial<InferSchema<TSchema>> = {};
    const keys = Object.keys(this.schema.shape) as SchemaKey<TSchema>[];
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Get all values, falling back to defaults for missing values.
   */
  getAllWithDefaults(defaults: InferSchema<TSchema>): InferSchema<TSchema> {
    const result = { ...defaults };
    const keys = Object.keys(this.schema.shape) as SchemaKey<TSchema>[];
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Register an observer for map changes.
   * Returns an unsubscribe function.
   */
  observe(callback: (changedKeys: SchemaKey<TSchema>[]) => void): () => void {
    const observer = (event: Y.YMapEvent<unknown>) => {
      const changedKeys = Array.from(event.keysChanged).filter((key): key is SchemaKey<TSchema> =>
        Object.hasOwn(this.schema.shape, key),
      );

      if (changedKeys.length > 0) {
        callback(changedKeys);
      }
    };
    this.map.observe(observer);
    return () => this.map.unobserve(observer);
  }
}
