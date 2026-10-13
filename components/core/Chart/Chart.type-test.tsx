import { Chart, type ChartProps } from './Chart';
const props: ChartProps = {
  kind: 'line',
  data: [{ name: 'A', value: 1 }],
  label: 'Responses',
  labels: { category: 'Value', value: 'Count', percentage: '%' },
};
const valid = <Chart {...props} size="compact" />;
// @ts-expect-error Chart modes are finite.
const kind = <Chart {...props} kind="scatter" />;
// @ts-expect-error Axis ownership is private to Core.
const axis = <Chart {...props} xAxisProps={{ stroke: 'red' }} />;
// @ts-expect-error Consumer series palettes cannot bypass the shared semantic roles.
const color = <Chart {...props} color="blue" />;
// @ts-expect-error Physical heights are private, shared sizes are public.
const height = <Chart {...props} h={300} />;
const unsafe = { style: { background: 'red' } };
// @ts-expect-error Typed spread cannot inject independent presentation.
const spread = <Chart {...props} {...unsafe} />;
void [valid, kind, axis, color, height, spread];
