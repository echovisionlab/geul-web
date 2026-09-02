import { notFound } from 'next/navigation';

/**
 * 데이터가 없으면 404를 throw
 * @example
 * guardNotFound(data); // data가 없으면 notFound() 호출
 */
export function guardNotFound<T>(data: T | null | undefined): asserts data is T {
  if (!data) {
    notFound();
  }
}
