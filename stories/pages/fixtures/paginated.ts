/** Deterministic local preview transport. It never calls application services. */
export function pageRows<T>(
  rows: readonly T[],
  query: { search?: string; page?: number; pageSize?: number },
  label: (row: T) => string,
) {
  const matches = rows.filter((row) => !query.search || label(row).toLowerCase().includes(query.search.toLowerCase()));
  const page = query.page ?? 1,
    pageSize = query.pageSize ?? 20;
  return {
    data: matches.slice((page - 1) * pageSize, page * pageSize),
    total: matches.length,
    page,
    pageSize,
    totalPages: Math.ceil(matches.length / pageSize),
  };
}
