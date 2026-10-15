import type { JsonValue } from '@bufbuild/protobuf';
import * as Y from 'yjs';

/** Physical Y.Text runs expand into the canonical inline JSON shape, not raw toJSON(). */
export function projectRoomPayload(value: unknown): JsonValue {
  if (value instanceof Y.Text) {
    return value.toString();
  }
  if (value instanceof Y.Array) {
    return value.toArray().flatMap((item): JsonValue[] => {
      if (item instanceof Y.Map) {
        const styled = item.get('text');
        if (styled instanceof Y.Text) {
          return styledRuns(item);
        }
        if (styled instanceof Y.Map) {
          return styledRuns(styled).map((run) => ({ text: run }));
        }
      }
      return [projectRoomPayload(item)];
    });
  }
  if (value instanceof Y.Map) {
    return Object.fromEntries(
      [...value.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, projectRoomPayload(child)]),
    );
  }
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  throw new Error('Invalid Block-room payload value.');
}

function styledRuns(styled: Y.Map<unknown>): JsonValue[] {
  const text = styled.get('text');
  if (text instanceof Y.Map) {
    return styledRuns(text);
  }
  const legacy = styled.get('styles');
  const styles = legacy instanceof Y.Map ? legacy.toJSON() : (legacy ?? {});
  const delta = text instanceof Y.Text ? text.toDelta() : [{ insert: typeof text === 'string' ? text : '' }];
  if (delta.length === 0) {
    delta.push({ insert: '' });
  }
  const runs: { text: string; styles?: Record<string, JsonValue> }[] = [];
  for (const part of delta) {
    if (typeof part.insert !== 'string') {
      throw new Error('Invalid inline Y.Text embed.');
    }
    const combined = Object.fromEntries(
      Object.entries({ ...styles, ...part.attributes }).filter(
        ([, value]) => value !== false && value !== '' && value !== null,
      ),
    ) as Record<string, JsonValue>;
    const run = { text: part.insert, ...(Object.keys(combined).length ? { styles: combined } : {}) };
    const previous = runs.at(-1);
    if (previous && run.text && JSON.stringify(previous.styles) === JSON.stringify(run.styles)) {
      previous.text += run.text;
    } else {
      runs.push(run);
    }
  }
  return runs;
}
