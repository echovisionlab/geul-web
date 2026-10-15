import { EDITOR_TOOLBAR_SHORTCUTS, EditorToolbarShortcutText } from '@/features/editor/toolbars/EditorToolbarTooltip';
import { Disclosure } from '@/components/core/Disclosure';
import { Text } from '@/components/core/Typography';
import type { ShaderChannel, ShaderStage } from './shader-program';
import {
  SHADER_AVAILABLE_INPUTS,
  shaderChannelApiItems,
  shaderStageEntryPoint,
  type ShaderApiLabels,
} from './shader-editor-api';
import classes from './ShaderApiReference.module.css';

export function ShaderAvailableInputs({
  stage,
  channels,
  labels,
}: {
  stage: ShaderStage;
  channels: readonly ShaderChannel[];
  labels: ShaderApiLabels;
}) {
  const entryPoint = shaderStageEntryPoint(stage);
  const inputs = [...SHADER_AVAILABLE_INPUTS, ...shaderChannelApiItems(channels)];
  return (
    <div data-testid="shader-available-inputs">
      <Disclosure
        density="compact"
        contentIndent="small"
        withDivider={false}
        label={
          <>
            <Text as="span" size="xs" weight="medium">
              {labels.availableInputs}
            </Text>
            <Text as="span" size="xs" tone="secondary" font="mono" truncate>
              {labels.apiHint} · <EditorToolbarShortcutText shortcut={EDITOR_TOOLBAR_SHORTCUTS.suggestions} />
            </Text>
          </>
        }
      >
        <div className={classes.body}>
          <code className={classes.entry}>{entryPoint ?? labels.sharedStage}</code>
          {inputs.map((input) => (
            <div key={input.name} className={classes.row}>
              <code className={classes.name}>{input.name}</code>
              <code className={classes.type}>{input.type}</code>
              <code className={classes.notation}>{input.notation}</code>
            </div>
          ))}
        </div>
      </Disclosure>
    </div>
  );
}
