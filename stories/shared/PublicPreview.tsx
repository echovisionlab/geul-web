import { localizeFixtureTree, useStorybookText } from '../../.storybook/fixture-i18n';
import { useState } from 'react';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { ContentModal } from '@/components/core/Modal/ContentModal';
import { SeriesPublicPostsView, SeriesPublicView } from '@/features/series/SeriesPublicView';
import { SharePasswordView } from '@/features/share/SharePasswordView';
import { PreviewFrame, type PreviewState } from './PreviewFrame';

const posts = [
  {
    id: 'night',
    title: 'Listening to the city after midnight',
    slug: 'night-walks',
    publishedAt: '2026-10-09T00:00:00Z',
    authors: [{ id: 'june', name: 'June Han' }],
  },
  {
    id: 'harbor',
    title: 'Field notes from the harbor',
    slug: 'harbor-notes',
    publishedAt: '2026-10-10T00:00:00Z',
    authors: [{ id: 'mina', name: 'Mina Park' }],
  },
];

export function PublicSeriesPreview({ empty = false }: { empty?: boolean }) {
  const fixtureText = useStorybookText();
  const [dialog, setDialog] = useState(false);
  return localizeFixtureTree(
    <PreviewFrame
      wide
      title="Pages · public series"
      description="The production /series/[idOrSlug] view with sample posts. Share opens a local link dialog; post links open their mapped Storybook previews."
    >
      <SeriesPublicView
        title="Night walks"
        postsLabel="Posts"
        controls={
          <Button size="xs" tone="neutral" emphasis="medium" onClick={() => setDialog(true)}>
            Share
          </Button>
        }
      >
        <SeriesPublicPostsView
          tableLabel="Posts"
          posts={empty ? [] : posts}
          labels={{
            title: 'Title',
            authors: 'Authors',
            published: 'Published',
            empty: 'No posts found.',
            untitled: 'Untitled',
            unknown: 'Unknown author',
          }}
        />
      </SeriesPublicView>
      <ContentModal
        opened={dialog}
        onClose={() => setDialog(false)}
        title="Share series"
        closeLabel="Close series dialog"
      >
        <TextInput label="Preview link" value="https://example.com/series/night-walks" readOnly />
      </ContentModal>
    </PreviewFrame>,
    fixtureText,
  );
}

export function ShareAccessPreview({ state = 'ready' }: { state?: PreviewState }) {
  const fixtureText = useStorybookText();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [unlocked, setUnlocked] = useState(false);
  return localizeFixtureTree(
    <PreviewFrame
      title="Pages · password protected share"
      description="The /s/[token] password gate view. Use preview to unlock a fixture; another value exposes the error. No access grant is issued."
    >
      {unlocked ? (
        <Alert tone="positive" role="status">
          Preview access granted.
        </Alert>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (state !== 'ready') {
              return;
            }
            if (password === 'preview') {
              setUnlocked(true);
            } else {
              setError('Incorrect password. Try preview.');
            }
          }}
        >
          <fieldset disabled={state === 'disabled'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <SharePasswordView
              password={password}
              onPasswordChange={(value) => {
                setPassword(value);
                setError(undefined);
              }}
              pending={state === 'pending'}
              error={state === 'error' ? 'Access could not be checked. Try again.' : error}
              labels={{
                title: 'Protected page',
                description: 'Enter a password to view this shared page.',
                password: 'Password',
                submit: 'Unlock page',
              }}
            />
          </fieldset>
        </form>
      )}
    </PreviewFrame>,
    fixtureText,
  );
}
