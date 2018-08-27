import React from 'react'
import RebassMDX from '@rebass/mdx'
import createScope from '@rebass/markdown'
import * as Rebass from 'rebass'
import sortBy from 'lodash.sortby'
import { ScopeProvider } from '@compositor/x0/components'
import Layout from './_layout'
import { LiveEditor } from './_ui'

const scope = {
  ...createScope(),
  ...Rebass,
  code: LiveEditor,
  pre: ({ children }) => children
}

const navOrder = [
  'index',
  'getting-started',
  'commands',
    'login',
    'logout',
    'init',
    'link',
    'unlink',
    'deploy',
    'sites',
    'open',
    'status',
  'contributing',
]

const pageNames = {
  index: 'Introduction',
  'getting-started': 'Getting Started',
}

const sortRoutes = routes => [
  ...sortBy([...routes], a => {
    const i = navOrder.indexOf(a.name)
    return i < 0 ? Infinity : i
  })
].map(route => {
  if (!pageNames[route.name]) {
    return route
  }
  return {
    ...route,
    name: pageNames[route.name],
    props: {
      hidePagination: true
    }
  }
})

export default class App extends React.Component {

  static defaultProps = {
    title: 'Netlify CLI'
  }

  render () {
    const { routes } = this.props

    const nav = sortRoutes(routes)
    // console.log('nav', nav)
    // console.log('scope', scope)
    // console.log('this.props', this.props)
    return (
      <RebassMDX>
        <ScopeProvider scope={scope}>
          <Layout {...this.props} routes={nav}>
            {this.props.children}
          </Layout>
        </ScopeProvider>
      </RebassMDX>
    )
  }
}
