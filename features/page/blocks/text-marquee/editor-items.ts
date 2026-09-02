export interface TextMarqueeEditorItem {
  text: string;
  href: string;
}

function normalizeEditorItem(item: unknown): TextMarqueeEditorItem {
  if (!item || typeof item !== 'object') {
    return { text: '', href: '' };
  }

  const record = item as { text?: unknown; href?: unknown };
  return {
    text: typeof record.text === 'string' ? record.text : '',
    href: typeof record.href === 'string' ? record.href : '',
  };
}

export function parseTextMarqueeEditorItems(itemsJson: string | undefined): TextMarqueeEditorItem[] {
  if (!itemsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeEditorItem);
  } catch {
    return [];
  }
}

export function serializeTextMarqueeEditorItems(items: TextMarqueeEditorItem[]): string {
  return JSON.stringify(
    items.map((item) => ({
      text: item.text,
      href: item.href.trim() ? item.href : undefined,
    })),
  );
}

export function moveTextMarqueeEditorItem(
  items: TextMarqueeEditorItem[],
  fromIndex: number,
  toIndex: number,
): TextMarqueeEditorItem[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
