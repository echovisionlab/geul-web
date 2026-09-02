import type { Meta, StoryObj } from '@storybook/nextjs';
import { ResizeHandle } from './ResizeHandle';

const mediaKinds = ['이미지', '오디오', '비디오', '일반 파일'] as const;

function KoreanDarkResizeHandles() {
  const width = 64;

  return (
    <div style={{ background: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-1)', padding: 24 }}>
      {mediaKinds.map((kind) => (
        <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8, width: `${width}%`, marginBottom: 20 }}>
          <ResizeHandle direction="left" value={width} min={10} max={100} ariaLabel={`${kind} 미리보기 너비 줄이기`} />
          <div style={{ minHeight: 56, padding: 16, background: 'var(--mantine-color-dark-5)' }}>
            {kind} · {width}%
          </div>
          <ResizeHandle direction="right" value={width} min={10} max={100} ariaLabel={`${kind} 미리보기 너비 늘리기`} />
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Core/ResizeHandle',
  component: ResizeHandle,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ResizeHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KoreanDarkMediaMatrix: Story = {
  render: () => <KoreanDarkResizeHandles />,
  globals: { locale: 'ko', theme: 'dark' },
};
