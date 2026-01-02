export const capitalize = function (t: string): string {
  return t.replace(/(^\w|\s\w)/g, (string) => string.toUpperCase())
}
