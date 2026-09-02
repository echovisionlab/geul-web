/**
 * Extracts only the fields that have changed between initial and current values.
 * Uses deep comparison for objects via JSON.stringify.
 *
 * @param initial - The initial/original values
 * @param current - The current values to compare against initial
 * @returns An object containing only the fields that have changed
 */
export function extractChangedFields<T extends object>(initial: T, current: T): Partial<T> {
  const changedFields: Partial<T> = {};

  for (const key of Object.keys(current) as (keyof T)[]) {
    const currentValue = current[key];
    const initialValue = initial[key];

    // Deep comparison for objects
    if (typeof currentValue === 'object' && currentValue !== null) {
      if (JSON.stringify(currentValue) !== JSON.stringify(initialValue)) {
        changedFields[key] = currentValue;
      }
    } else if (currentValue !== initialValue) {
      changedFields[key] = currentValue;
    }
  }

  return changedFields;
}
