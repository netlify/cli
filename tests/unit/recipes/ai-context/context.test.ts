import { describe, test, expect } from 'vitest'
import { applyOverrides, parseContextFile } from '../../../../src/recipes/ai-context/context.js'

describe('applyOverrides', () => {
  test('applies overrides to a context file', () => {
    const file = `<ProviderContextOverrides>sdf</ProviderContextOverrides>
<ProviderContext version="1.0" provider="Netlify">This is the contents
  Something here
  Something there
</ProviderContext>`
    const expected = `<ProviderContextOverrides>Here come the overrides</ProviderContextOverrides>
<ProviderContext version="1.0" provider="Netlify">This is the contents
  Something here
  Something there
</ProviderContext>`

    expect(applyOverrides(file, 'Here come the overrides')).toBe(expected)
  })

  test('supports a multiline overrides slot', () => {
    const file = `<ProviderContextOverrides>
  This is where overrides go
</ProviderContextOverrides>
<ProviderContext version="1.0" provider="Netlify">This is the contents
  Something here
  Something there
</ProviderContext>`
    const expected = `<ProviderContextOverrides>Here come the overrides</ProviderContextOverrides>
<ProviderContext version="1.0" provider="Netlify">This is the contents
  Something here
  Something there
</ProviderContext>`

    expect(applyOverrides(file, 'Here come the overrides')).toBe(expected)
  })
})

describe('parseContextFile', () => {
  test('extracts the provider, version and contents', () => {
    const file = `<ProviderContext provider="Netlify" version="1.0">This is the contents</ProviderContext>`

    expect(parseContextFile(file)).toStrictEqual({
      provider: 'Netlify',
      version: '1.0',
      contents: file,
      innerContents: 'This is the contents',
    })
  })

  test('ignores unknown attributes', () => {
    const file = `<ProviderContext foo="bar" provider="Netlify" version="1.0">This is the contents</ProviderContext>`

    expect(parseContextFile(file)).toStrictEqual({
      provider: 'Netlify',
      version: '1.0',
      contents: file,
      innerContents: 'This is the contents',
    })
  })

  test('ignores the order of attributes', () => {
    const file = `<ProviderContext version="1.0" provider="Netlify">This is the contents</ProviderContext>`

    expect(parseContextFile(file)).toStrictEqual({
      provider: 'Netlify',
      version: '1.0',
      contents: file,
      innerContents: 'This is the contents',
    })
  })

  test('extracts overrides', () => {
    const overrides = `<ProviderContextOverrides>This will be kept</ProviderContextOverrides>`
    const file = `
${overrides}
<ProviderContext version="1.0" provider="Netlify">This is the contents
  Something here
  Something there
</ProviderContext>`

    expect(parseContextFile(file)).toStrictEqual({
      provider: 'Netlify',
      version: '1.0',
      contents: file,
      innerContents: `This is the contents
Something here
Something there
      `,
      overrides: {
        contents: overrides,
        innerContents: 'This will be kept',
      },
    })
  })
})
