import { z } from 'zod';

export const booleanString = z.enum(['true', 'false']);

export const listLayoutSchema = z.enum(['grid', 'list', 'cards', 'minimal', 'carousel']);

export const imageAspectRatioSchema = z.enum(['16:9', '4:3', '1:1', 'auto']);

export const sortOrderSchema = z.enum(['asc', 'desc']);

export function splitCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseIntegerProp(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseBooleanProp(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return fallback;
}

export function toAspectRatio(value: string | undefined, fallback: '16:9' | '4:3' | '1:1'): string {
  const resolved = value && value !== 'auto' ? value : fallback;
  return resolved.replace(':', ' / ');
}
