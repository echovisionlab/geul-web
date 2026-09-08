import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box, Group, Stack } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { SegmentedControl } from '@/components/core/Input';
import { EditorAuthoringModeProvider } from '@/features/editor/EditorAuthoringMode';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { TiptapEditor } from './TiptapEditor';
import { createTiptapPlaygroundRoom } from './TiptapPlayground.story-fixtures';
import classes from './TiptapPlayground.module.css';

type PlaygroundRoom = ReturnType<typeof createTiptapPlaygroundRoom>;
const authoringMode = { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true };
const localUser = { name: 'Playground', color: '#228be6' };

function PublishedDocument({ room }: { room: PlaygroundRoom }) {
  const [blocks, setBlocks] = useState(() =>
    materializeLocalizedRichTextTree(room.controller.getLocalizedDocumentSnapshot()),
  );
  useEffect(
    () =>
      room.bridge.observe(() => {
        setBlocks(materializeLocalizedRichTextTree(room.controller.getLocalizedDocumentSnapshot()));
      }),
    [room],
  );
  return (
    <article className="document-content" data-playground-view="published">
      {blocks.map((block) => (
        <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale="ko" />
      ))}
    </article>
  );
}

function Playground({ initialView = 'edit' }: { initialView?: 'edit' | 'preview' }) {
  const [room, setRoom] = useState<PlaygroundRoom | null>(null);
  const [queryClient] = useState(() => new QueryClient());
  const [view, setView] = useState(initialView);
  const t = useTranslations('common');
  useEffect(() => {
    const current = createTiptapPlaygroundRoom();
    setRoom(current);
    return () => {
      current.awareness.destroy();
      current.document.destroy();
    };
  }, []);
  if (!room) {
    return null;
  }
  return (
    <LocaleProvider locale="ko">
      <QueryClientProvider client={queryClient}>
        <Stack className={classes.playground} p="xl" maw={960} mx="auto">
          <Group justify="flex-end">
            <SegmentedControl
              aria-label="Playground mode"
              value={view}
              onChange={(value) => setView(value === 'edit' ? 'edit' : 'preview')}
              data={[
                { value: 'edit', label: t('actions.edit') },
                { value: 'preview', label: t('labels.preview') },
              ]}
            />
          </Group>
          <Box mih={450}>
            {view === 'edit' ? (
              <EditorAuthoringModeProvider value={authoringMode}>
                <TiptapEditor
                  blockRoomController={room.controller}
                  awareness={room.awareness}
                  localUser={localUser}
                  ai={false}
                />
              </EditorAuthoringModeProvider>
            ) : (
              <PublishedDocument room={room} />
            )}
          </Box>
        </Stack>
      </QueryClientProvider>
    </LocaleProvider>
  );
}

const meta = {
  title: 'Feature/Editor/Tiptap Playground',
  component: Playground,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Playground>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editor: Story = {};
export const Published: Story = { args: { initialView: 'preview' } };
