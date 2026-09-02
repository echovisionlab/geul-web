import { EDITOR_TOOLBAR_SHORTCUTS, EditorToolbarShortcutText } from '@/features/editor/toolbars/EditorToolbarTooltip';
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
    <details className={classes.reference} data-testid="shader-available-inputs">
      <summary className={classes.summary}>
        <span>{labels.availableInputs}</span>
        <span className={classes.hint}>
          {labels.apiHint} · <EditorToolbarShortcutText shortcut={EDITOR_TOOLBAR_SHORTCUTS.suggestions} />
        </span>
      </summary>
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
    </details>
  );
}
