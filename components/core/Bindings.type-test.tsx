import { fieldBindings, interactionBindings, componentBindings } from './bindings';
import { TextInput } from './Input';
import { IconButton } from './IconButton';
const formValue = fieldBindings({ value: 'Draft', onChange: () => {}, style: { color: 'red' }, size: 99 });
<TextInput {...formValue} label="Name" />;
const sensor = interactionBindings({ tabIndex: 0, 'aria-label': 'Move', onPointerDown: () => {}, className: 'escape' });
<IconButton {...sensor} interaction="drag-handle" />;
// @ts-expect-error Binding projection never grants a style setter.
formValue.style = { color: 'red' };
// @ts-expect-error Form adapters cannot define component size.
formValue.size = 99;
// @ts-expect-error Sensor adapters cannot define a consumer skin.
sensor.className = 'escape';
// @ts-expect-error Closed component forwarding does not accept a caller skin.
componentBindings({ style: { color: 'red' } });
