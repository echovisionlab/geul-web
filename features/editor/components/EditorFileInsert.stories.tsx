import type { Meta, StoryObj } from '@storybook/nextjs';
import { EditorRuntimePreview } from '@/stories/shared/EditorRuntimePreview';
const meta = {
  title: 'Feature/Editor/File Insertion',
  component: EditorRuntimePreview,
  parameters: { canvasInset: 'none', layout: 'fullscreen' },
} satisfies Meta<typeof EditorRuntimePreview>;
export default meta;
export const LocalFiles: StoryObj<typeof meta> = { args: { initialScenario: 'file' } };
