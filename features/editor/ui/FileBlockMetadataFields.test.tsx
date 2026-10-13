import { DesignSystemTestProvider as DesignSystemProvider } from '@/test/TestProviders';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';
import { FileBlockMetadataFields } from './FileBlockMetadataFields';

const labels = {
  name: 'Name',
  alt: 'Image description',
  caption: 'Caption',
  captionPlaceholder: 'Add a caption...',
};

function render(overrides: Partial<React.ComponentProps<typeof FileBlockMetadataFields>> = {}) {
  return renderToStaticMarkup(
    <DesignSystemProvider forceColorScheme="light">
      <FileBlockMetadataFields
        labels={labels}
        mimeType="image/png"
        name="Map"
        alt="A map"
        caption="Field map"
        allowNameEdit
        allowLocalizedEdit
        onNameChange={vi.fn()}
        onAltChange={vi.fn()}
        onCaptionChange={vi.fn()}
        {...overrides}
      />
    </DesignSystemProvider>,
  );
}

describe('FileBlockMetadataFields', () => {
  it('shows the neutral name plus localized image alt and caption fields', () => {
    const html = render();
    expect(html).toContain('value="Map"');
    expect(html).toContain('value="A map"');
    expect(html).toContain('Field map');
  });

  it('keeps alt image-only and hides neutral name without neutral authority', () => {
    const html = render({ mimeType: 'audio/wav', allowNameEdit: false });
    expect(html).not.toContain('value="Map"');
    expect(html).not.toContain('value="A map"');
    expect(html).toContain('Field map');
  });
});
