import React from 'react'
import RebassMDX from '@rebass/mdx'
import createScope from '@rebass/markdown'
import * as Rebass from 'rebass'
import sortBy from 'lodash.sortby'
import { ScopeProvider } from '@compositor/x0/components'
import { Link } from 'react-router-dom'
import Layout from './_layout'
import { LiveEditor } from './_ui'

const scope = {
  ...createScope(),
  ...Rebass,
  code: LiveEditor,
  pre: ({ children }) => children,
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
  'deploy',
  'dev',
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
  'index': 'Introduction',
  'getting-started': 'Getting Started',
  'commands': 'CLI Commands',
  'contributing': 'Contributing',
  'netlify-dev': 'Netlify Dev',
}

const sortRoutes = routes =>
  [
    ...sortBy([...routes], a => {
      const i = navOrder.indexOf(a.name)
      return i < 0 ? Infinity : i
    }),
  ].map(route => {
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
