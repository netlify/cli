import { relative, sep } from 'path'

// Returns a POSIX-normalized path from `from` to `to`. When `to` is inside
// `from`, the relative path is used (e.g. `netlify/database/migrations`).
// When `to` is outside `from`, the original `to` is returned, normalized to
// forward slashes. Returns `.` when the two match exactly.
export const relativeToProject = (from: string, to: string): string => {
  const rel = relative(from, to)
  if (rel === '') return '.'
  const isInside = !rel.startsWith('..')
  return (isInside ? rel : to).split(sep).join('/')
}
