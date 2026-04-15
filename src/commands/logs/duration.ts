const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
}

const TOKEN_RE = /(\d+)(ms|s|m|h|d|w)/g

export const parseDuration = (input: string): number | null => {
  const normalized = input.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  let total = 0
  let consumed = 0
  for (const match of normalized.matchAll(TOKEN_RE)) {
    total += Number(match[1]) * UNIT_MS[match[2]]
    consumed += match[0].length
  }

  if (consumed !== normalized.length || total <= 0) {
    return null
  }

  return total
}
