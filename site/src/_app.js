import { ScopeProvider } from '@compositor/x0/components.js'
import createScope from '@rebass/markdown'
import RebassMDX from '@rebass/mdx'
import sortBy from 'lodash.sortby'
import React from 'react'
import { Link } from 'react-router-dom'
// eslint-disable-next-line import/no-namespace
import * as Rebass from 'rebass'

import Layout from './_layout.js'
import { LiveEditor } from './_ui.js'

const scope = {
  ...createScope(),
  ...Rebass,
  code: LiveEditor,
  pre: ({ children }) => children,
  // eslint-disable-next-line id-length
  a: ({ children, href }) => {
    // handle external links
    if (!href.startsWith('/')) {
      return (
        <Rebass.Link color="#02807d" href={href}>
          {children}
        </Rebass.Link>
      )
    }
    return (
      <Link style={{ color: '#02807d', textDecoration: 'none' }} to={href}>
        {children}
      </Link>
    )
  },
}

const navOrder = [
  'index',
  'getting-started',
  'commands',
  'addons',
  'api',
  'build',
  'completion',
  'deploy',
  'dev',
  'env',
  'functions',
  'init',
  'integration',
  'link',
  'lm',
  'login',
  'logout',
  'open',
  'serve',
  'sites',
  'status',
  'switch',
  'unlink',
  'watch',
  'netlify-dev',
  'functions-dev',
  'vscode',
]

const pageNames = {
  index: 'CLI Reference',
  'getting-started': 'Getting Started',
  addons: 'addons (deprecated)',
  'netlify-dev': 'Netlify Dev',
  'functions-dev': 'Functions Development',
  vscode: 'Run and debug with VSCode',
  lm: 'lm (deprecated)',
}

const sortRoutes = (routes) =>
  [
    ...sortBy([...routes], ({ name }) => {
      const index = navOrder.indexOf(name)
      return index < 0 ? Number.POSITIVE_INFINITY : index
    }),
  ].map((route) => {
    if (!pageNames[route.name]) {
      return route
    }
    return {
      ...route,
      name: pageNames[route.name],
      props: {
        hidePagination: true,
      },
    }
  })

export default class App extends React.Component {
  static defaultProps = {
    title: 'Netlify CLI',
  }

  render() {
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
