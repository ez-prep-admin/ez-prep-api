/** Higher numbers appear first. Missing values sort as 0, then by name. */
export function compareByDashboardPriority(
  a: { priority?: number | null; name: string },
  b: { priority?: number | null; name: string },
): number {
  const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
  if (byPriority !== 0) return byPriority;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}
