import type { EditorHeaderProps } from './EditorHeaderView';

const back: EditorHeaderProps['onBack'] = async () => {};
const durableBack: EditorHeaderProps['onBack'] = async () => true;
// @ts-expect-error Back must be a command callback.
const invalidBack: EditorHeaderProps['onBack'] = Promise.resolve();

void [back, durableBack, invalidBack];
