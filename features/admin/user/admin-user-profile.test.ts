import { describe, expect, it } from 'vitest';
import {
  buildAdminUserProfileChanges,
  shouldAdoptServerProfile,
  type AdminUserProfileSnapshot,
} from './admin-user-profile';

const baseline: AdminUserProfileSnapshot = {
  nickname: 'Member',
  bio: 'Bio',
  role: 'user',
  tagIds: ['tag-1', 'tag-2'],
  website: 'https://member.example',
  socialLinks: { github: 'member' },
};
const unchangedValues = { nickname: 'Member', bio: 'Bio', role: 'user', tagIds: ['tag-1', 'tag-2'] };

function dirty(...paths: string[]) {
  return (path: string) => paths.includes(path);
}

describe('buildAdminUserProfileChanges', () => {
  it('sends only the edited bio', () => {
    expect(
      buildAdminUserProfileChanges({
        id: 'member-1',
        values: { ...unchangedValues, bio: 'Temporary bio' },
        isDirty: dirty('bio'),
        baseline,
        website: baseline.website,
        socialLinks: { github: 'member' },
      }),
    ).toEqual({ id: 'member-1', bio: 'Temporary bio' });
  });

  it('issues no update when nothing changed', () => {
    expect(
      buildAdminUserProfileChanges({
        id: 'member-1',
        values: unchangedValues,
        isDirty: dirty(),
        baseline,
        website: baseline.website,
        socialLinks: { github: 'member' },
      }),
    ).toBeNull();
  });

  it('omits tags that were touched but select the same set as the baseline', () => {
    expect(
      buildAdminUserProfileChanges({
        id: 'member-1',
        values: { ...unchangedValues, tagIds: ['tag-2', 'tag-1'] },
        isDirty: dirty('tagIds'),
        baseline,
        website: baseline.website,
        socialLinks: { github: 'member' },
      }),
    ).toBeNull();
  });

  it('sends a cleared bio and website as null', () => {
    expect(
      buildAdminUserProfileChanges({
        id: 'member-1',
        values: { ...unchangedValues, bio: '' },
        isDirty: dirty('bio'),
        baseline,
        website: '',
        socialLinks: { github: 'member' },
      }),
    ).toEqual({ id: 'member-1', bio: null, website: null });
  });

  it('sends changed social links even though they are outside the form', () => {
    expect(
      buildAdminUserProfileChanges({
        id: 'member-1',
        values: unchangedValues,
        isDirty: dirty(),
        baseline,
        website: baseline.website,
        socialLinks: { github: 'member', mastodon: '@member@example.social' },
      }),
    ).toEqual({ id: 'member-1', socialLinks: { github: 'member', mastodon: '@member@example.social' } });
  });
});

describe('shouldAdoptServerProfile', () => {
  const user = { id: 'member-1', nickname: 'Changed elsewhere' };
  const clean = {
    user,
    isSaving: false,
    savedSnapshot: null,
    baseline,
    isFormDirty: false,
    website: baseline.website,
    socialLinks: { github: 'member' },
  };

  it('adopts a changed server profile when nothing is being edited', () => {
    expect(shouldAdoptServerProfile(clean)).toBe(true);
  });

  it('adopts the first loaded profile before a baseline exists', () => {
    expect(shouldAdoptServerProfile({ ...clean, baseline: null })).toBe(true);
  });

  it('preserves a dirty form draft when refreshed data arrives', () => {
    expect(shouldAdoptServerProfile({ ...clean, isFormDirty: true })).toBe(false);
  });

  it('preserves edited website and social links when refreshed data arrives', () => {
    expect(shouldAdoptServerProfile({ ...clean, website: 'https://draft.example' })).toBe(false);
    expect(shouldAdoptServerProfile({ ...clean, socialLinks: {} })).toBe(false);
  });

  it('does not reset the form while a save is pending', () => {
    expect(shouldAdoptServerProfile({ ...clean, isSaving: true })).toBe(false);
  });

  it('keeps the submitted baseline while the pre-save snapshot is still the query result', () => {
    expect(shouldAdoptServerProfile({ ...clean, savedSnapshot: user })).toBe(false);
    expect(shouldAdoptServerProfile({ ...clean, savedSnapshot: { ...user } })).toBe(true);
  });
});
