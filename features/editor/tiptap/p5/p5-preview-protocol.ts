import type { P5Capability } from './p5-capabilities';
import type { P5SketchError } from './p5-source';

/** Messages accepted from the preview iframe. */
export type P5RuntimeMessage =
  | { channel: string; type: 'runner-ready' | 'ready' | 'heartbeat' | 'stopped' }
  | { channel: string; type: 'permission-pending' | 'permission-granted'; capabilities: P5Capability[] }
  | { channel: string; type: 'error'; error: P5SketchError };

/** Messages accepted from the disposable source-preflight worker. */
export type P5PreflightMessage = { type: 'initialized' | 'ready' } | { type: 'error'; error: P5SketchError };
