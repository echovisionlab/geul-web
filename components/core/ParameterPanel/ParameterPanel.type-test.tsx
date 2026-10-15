import { ParameterPanel, type ParameterSchema } from './ParameterPanel';
<ParameterPanel title="Settings" model={{ zoom: { kind: 'number', value: 12 } }} placement="map-corner" />;
// @ts-expect-error styling belongs to Core
<ParameterPanel title="Settings" model={{}} style={{ color: 'red' }} />;
// @ts-expect-error unregistered parameter kind
const invalid: ParameterSchema = { zoom: { kind: 'slider', value: 12 } };
// @ts-expect-error field styling bypass is closed
const bypass: ParameterSchema = { zoom: { kind: 'number', value: 12, className: 'x' } };
void invalid;
void bypass;
