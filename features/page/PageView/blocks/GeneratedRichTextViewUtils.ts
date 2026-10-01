import { mediaContainerStyleToReact, resolveMediaContainerStyle } from '@/lib/media/shared';

export function alignment(value: number | undefined): 'left' | 'center' | 'right' {
  return value === 2 ? 'center' : value === 3 ? 'right' : 'left';
}

export function containerStyle(
  previewWidth: number | undefined,
  textAlignment: number | undefined,
): React.CSSProperties {
  return (
    mediaContainerStyleToReact(resolveMediaContainerStyle(String(previewWidth ?? 100), alignment(textAlignment))) ?? {}
  );
}

export function requireHeadingLevel(value: number): 1 | 2 | 3 {
  if (value !== 1 && value !== 2 && value !== 3) {
    throw new Error(`Unsupported heading level: ${value}`);
  }
  return value;
}

export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}
