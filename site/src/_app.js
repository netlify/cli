import { ScopeProvider } from '@compositor/x0/components.js'
import createScope from '@rebass/markdown'
import RebassMDX from '@rebass/mdx'
import sortBy from 'lodash.sortby'
import React from 'react'
import { Link } from 'react-router-dom'
import * as Rebass from 'rebass'

import Layout from './_layout.js'
import { LiveEditor } from './_ui.js'

const scope = {
  ...createScope(),
  ...Rebass,
  code: LiveEditor,
  pre: ({ children }) => children,
  // eslint-disable-next-line react/display-name, id-length
  a: ({ children, href }) => {
    // handle external links
    if (!href.match(/^\//)) {
      return (
        <Rebass.Link color="#00ad9f" href={href}>
          {children}
        </Rebass.Link>
      )
    }
    return (
      <Link style={{ color: '#00ad9f', textDecoration: 'none' }} to={href}>
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
  'deploy',
  'dev',
  'env',
  'functions',
  'init',
  'link',
  'login',
  'logout',
  'open',
  'sites',
  'status',
  'unlink',
  'netlify-dev',
  'contributing',
]

const pageNames = {
  index: 'Introduction',
  'getting-started': 'Getting Started',
  commands: 'CLI Commands',
  contributing: 'Contributing',
  'netlify-dev': 'Netlify Dev',
}

const sortRoutes = (routes) =>
  [
    ...sortBy([...routes], ({ name }) => {
      const index = navOrder.indexOf(name)
      return index < 0 ? Infinity : index
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
