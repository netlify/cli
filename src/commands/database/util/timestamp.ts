// Returns the current time as a compact `YYYYMMDDHHMMSS` string in UTC. Used
// for migration prefixes so lexicographic ordering matches chronological
// ordering regardless of the developer's local timezone (otherwise two
// developers in different zones could produce prefixes that sort out of
// order from each other).
export const utcTimestampPrefix = (date: Date = new Date()): string =>
  date.toISOString().replace('T', '').replaceAll('-', '').replaceAll(':', '').slice(0, 14)
