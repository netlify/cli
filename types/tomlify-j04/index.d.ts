declare module 'tomlify-j0.4' {
  export interface Tomlify {
    toToml(
      input: unknown,
      options?: {
        space?: number | undefined
        replace?: ((key: string, value: unknown) => string | boolean) | undefined
      },
    ): string
  }

  const tomlify: Tomlify

  export default tomlify
}
