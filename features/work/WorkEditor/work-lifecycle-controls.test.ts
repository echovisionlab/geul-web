import { describe, expect, it } from 'vitest';
import { resolveWorkLifecycleControls } from './work-lifecycle-controls';

const labels = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  publish: 'Publish',
  unpublish: 'Unpublish',
};

describe('resolveWorkLifecycleControls', () => {
  it('exposes only published recovery and no delete action for archived Work', () => {
    const controls = resolveWorkLifecycleControls('archived', true, labels);

    expect(controls.canDelete).toBe(false);
    expect(controls.statusOptions.map((option) => option.value)).toEqual(['archived', 'published']);
    expect(controls.statusOptions.find((option) => option.value === 'published')?.actionLabel).toBe('Publish');
  });

  it('retains delete and draft/published transitions for active admin Work', () => {
    expect(resolveWorkLifecycleControls('draft', true, labels).canDelete).toBe(true);
    expect(resolveWorkLifecycleControls('published', true, labels).statusOptions.map((option) => option.value)).toEqual(
      ['draft', 'published'],
    );
    expect(resolveWorkLifecycleControls('published', false, labels).canDelete).toBe(false);
  });
});
