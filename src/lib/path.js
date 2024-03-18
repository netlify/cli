// @ts-expect-error TS(7006) FIXME: Parameter 'path' implicitly has an 'any' type.
export const normalizeBackslash = (path) => path.replace(/\\/g, '/');
