'use client';

import { useEffect, useRef, useState } from 'react';

interface TaxonomyEditFields {
  name: string;
  description: string;
}

interface TaxonomyEditChanges {
  name?: string;
  description?: string | null;
}

/** Fields that differ from the loaded entity. A cleared description is sent as an explicit `null`. */
function taxonomyEditChanges(baseline: TaxonomyEditFields, draft: TaxonomyEditFields): TaxonomyEditChanges {
  const changes: TaxonomyEditChanges = {};
  if (draft.name !== baseline.name) {
    changes.name = draft.name;
  }
  if (draft.description !== baseline.description) {
    changes.description = draft.description || null;
  }
  return changes;
}

/**
 * Edit draft for a category, genre or style. Refreshed entity data replaces the draft only while the draft is
 * unchanged and no save is running, so a refresh never discards local edits.
 */
export function useTaxonomyEditDraft(
  entity: { id: string; name: string; description?: string | null } | null,
  saving: boolean,
) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const baselineRef = useRef<(TaxonomyEditFields & { id: string }) | null>(null);

  useEffect(() => {
    if (!entity) {
      baselineRef.current = null;
      return;
    }

    const nextBaseline = {
      id: entity.id,
      name: entity.name,
      description: entity.description || '',
    };
    const baseline = baselineRef.current;
    if (!baseline || baseline.id !== nextBaseline.id) {
      baselineRef.current = nextBaseline;
      setName(nextBaseline.name);
      setDescription(nextBaseline.description);
      return;
    }
    if (saving || name !== baseline.name || description !== baseline.description) {
      return;
    }

    baselineRef.current = nextBaseline;
    setName(nextBaseline.name);
    setDescription(nextBaseline.description);
  }, [entity, description, saving, name]);

  /** Changes against the loaded entity, or `null` while the draft does not belong to `entity`. */
  const changes = (): TaxonomyEditChanges | null => {
    const baseline = baselineRef.current;
    if (!entity || !baseline || baseline.id !== entity.id) {
      return null;
    }
    return taxonomyEditChanges(baseline, { name, description });
  };

  return { name, setName, description, setDescription, changes };
}
