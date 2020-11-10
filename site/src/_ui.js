import { LiveEditor as Editor, LivePreview } from '@compositor/x0/components.js'
import React from 'react'
import { Pre } from 'rebass'

export const LiveEditor = (props) => {
  const lang = (props.className || '').replace(/^language-/, '')
  const type = lang.charAt(0)
  const code = React.Children.toArray(props.children).join('\n')

  switch (type) {
    case '.':
      return <Editor mdx={lang === '.mdx'} code={code} />
    case '!':
      return <LivePreview mdx={lang === '!mdx'} code={code} />
    default:
      return (
        <Pre p={3} mt={4} mb={4} bg="gray">
          {props.children}
        </Pre>
      )
  }
}
