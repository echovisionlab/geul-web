export const DEFAULT_SHADER_VERTEX_SOURCE = `void main() {
  vec2 position = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

export const DEFAULT_SHADER_FRAGMENT_SOURCE = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
  float pulse = 0.5 + 0.5 * sin(iTime);
  fragColor = vec4(0.15 + pulse * 0.25, 0.35 + uv.x * 0.2, 0.7 + uv.y * 0.15, 1.0);
}`;

export const SHADER_MAX_SOURCE_LENGTH = 100_000;

export type ShaderErrorKind = 'compile' | 'link' | 'runtime' | 'resource';

export interface ShaderError {
  kind: ShaderErrorKind;
  message: string;
  stage?: import('./shader-program').ShaderStage | 'link';
  line?: number;
  column?: number;
}

export interface ShaderCompileSourceMap {
  stage: import('./shader-program').ShaderStage;
  commonStartLine: number;
  commonLineCount: number;
  stageStartLine: number;
}

const LOCATION_PATTERNS = [
  /ERROR:\s*\d+:(\d+)(?::(\d+))?\s*:\s*([^\n]+)/iu,
  /\d+\((\d+)\)\s*:\s*(?:error\s*)?[^:]*:\s*([^\n]+)/iu,
] as const;

function cleanMessage(value: string): string {
  return value
    .replaceAll(/(?:https?|blob):\/\/\S+/gu, '[resource]')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, 500);
}

/** Normalizes implementation-specific WebGL shader logs into source markers. */
export function normalizeShaderError(input: unknown, kind: ShaderErrorKind, sourceLineOffset = 0): ShaderError {
  const raw = input instanceof Error ? input.message : typeof input === 'string' ? input : '';
  let line: number | undefined;
  let column: number | undefined;
  let detail = raw;

  const angle = LOCATION_PATTERNS[0].exec(raw);
  if (angle) {
    line = Number(angle[1]);
    column = angle[2] ? Number(angle[2]) : 1;
    detail = angle[3] ?? raw;
  } else {
    const mesa = LOCATION_PATTERNS[1].exec(raw);
    if (mesa) {
      line = Number(mesa[1]);
      column = 1;
      detail = mesa[2] ?? raw;
    }
  }

  const adjustedLine =
    Number.isInteger(line) && (line ?? 0) > sourceLineOffset ? (line as number) - sourceLineOffset : undefined;
  const message = cleanMessage(detail) || `Unknown shader ${kind} error`;

  return {
    kind,
    message,
    ...(adjustedLine ? { line: adjustedLine } : {}),
    ...(Number.isInteger(column) && (column ?? 0) > 0 ? { column } : {}),
  };
}

export function mapShaderCompileError(input: unknown, map: ShaderCompileSourceMap): ShaderError {
  const absolute = normalizeShaderError(input, 'compile');
  if (!absolute.line) {
    return { ...absolute, stage: map.stage };
  }
  const commonEnd = map.commonStartLine + map.commonLineCount - 1;
  if (map.commonLineCount > 0 && absolute.line >= map.commonStartLine && absolute.line <= commonEnd) {
    return { ...absolute, stage: 'common', line: absolute.line - map.commonStartLine + 1 };
  }
  if (absolute.line >= map.stageStartLine) {
    return { ...absolute, stage: map.stage, line: absolute.line - map.stageStartLine + 1 };
  }
  return { ...absolute, stage: map.stage, line: undefined, column: undefined };
}

export function validateShaderStageSource(source: string, stage: 'vertex' | 'fragment'): ShaderError | null {
  const errorStage = stage === 'fragment' ? 'image' : stage;
  if (source.length > SHADER_MAX_SOURCE_LENGTH) {
    return {
      kind: 'resource',
      stage: errorStage,
      message: `Shader source exceeds the ${SHADER_MAX_SOURCE_LENGTH.toLocaleString('en-US')} character limit.`,
    };
  }
  const hasEntryPoint =
    stage === 'vertex' ? /\bvoid\s+main\s*\(/u.test(source) : /\bvoid\s+(?:main|mainImage)\s*\(/u.test(source);
  if (!hasEntryPoint) {
    return {
      kind: 'compile',
      stage: errorStage,
      message:
        stage === 'vertex'
          ? 'Define void main() in the vertex stage.'
          : 'Define void main() or void mainImage(out vec4 fragColor, in vec2 fragCoord) in the fragment stage.',
      line: 1,
      column: 1,
    };
  }
  return null;
}

export function validateShaderProgramSources(
  sources: import('./shader-program').ShaderProgramDocument['sources'],
): ShaderError | null {
  const stages = Object.entries(sources) as [import('./shader-program').ShaderStage, string][];
  for (const [stage, source] of stages) {
    if (source.length > SHADER_MAX_SOURCE_LENGTH) {
      return {
        kind: 'resource',
        stage,
        message: `Shader source exceeds the ${SHADER_MAX_SOURCE_LENGTH.toLocaleString('en-US')} character limit.`,
      };
    }
    if (!source.trim() || stage === 'common') {
      continue;
    }
    const entryPoint =
      stage === 'vertex'
        ? /\bvoid\s+main\s*\(/u.test(source)
        : stage === 'cubemap'
          ? /\bvoid\s+(?:main|mainCubemap)\s*\(/u.test(source)
          : stage === 'sound'
            ? /\b(?:void\s+main\s*\(|vec2\s+mainSound\s*\()/u.test(source)
            : /\bvoid\s+(?:main|mainImage)\s*\(/u.test(source);
    if (!entryPoint) {
      return {
        kind: 'compile',
        stage,
        message:
          stage === 'vertex'
            ? 'Define void main() in vert.glsl.'
            : stage === 'cubemap'
              ? 'Define void main() or void mainCubemap(...) in cubemap.glsl.'
              : stage === 'sound'
                ? 'Define vec2 mainSound(int samp, float time) in sound.glsl.'
                : `Define void main() or void mainImage(...) in ${stage === 'image' ? 'frag.glsl' : `${stage}.glsl`}.`,
        line: 1,
        column: 1,
      };
    }
  }
  return null;
}

/** Backward-compatible fragment validation. */
export function validateShaderSource(source: string): ShaderError | null {
  return validateShaderStageSource(source, 'fragment');
}
