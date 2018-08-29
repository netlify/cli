import React from 'react'
import PropTypes from 'prop-types'
import {
  Link as RouterLink,
  NavLink as RouterNavLink
} from 'react-router-dom'
import { Helmet } from 'react-helmet'
import styled from 'styled-components'
import {
  Provider as RebassProvider,
  Flex,
  Box,
  Fixed,
  Container,
  Text,
  Close,
  Toolbar,
  Divider,
  Heading,
  NavLink,
  BlockLink,
  Button,
  ButtonTransparent,
} from 'rebass'
import { borderColor, themeGet } from 'styled-system'

const breakpoint = `@media screen and (min-width: 48em)`
const repoUrl = 'https://github.com/netlify/cli'

export const Root = styled(Flex)([], {
  minHeight: '100vh'
})

export const Sidebar = styled('div')([], {
  width: '256px',
  height: '100vh',
  flex: 'none',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  transition: 'transform .2s ease-out',
  backgroundColor: '#fff',
  borderRight: '1px solid',
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
}, props => ({
  transform: props.open ? 'translateX(0)' : 'translateX(-100%)',
  [breakpoint]: {
    transform: 'none'
  }
}), borderColor)
Sidebar.defaultProps = {
  borderColor: 'gray'
}

export const Overlay = styled('div')([], {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

export const MobileOnly = styled.div([], {
  [breakpoint]: {
    display: 'none'
  },
})

export const MenuIcon = ({ size = 24, ...props }) => {
  return (
    <svg
      {...props}
      viewBox='0 0 24 24'
      width={size}
      height={size}
      fill='currentcolor'
    >
      <path d='M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z' />
    </svg>
  )
}


const GithubIcon = () => {
  return (
    <svg aria-labelledby="simpleicons-github-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  )
}

export const Main = props =>
  <Box
    {...props}
    is='main'
    flex='1 1 auto'
    w={1}
    pl={[ null, null, 256 ]}
  />

export const MaxWidth = props =>
  <Container
    {...props}
    maxWidth={768}
    px={4}
    pt={4}
    pb={6}
  />

export const Content = styled(Box)([], {
  minHeight: 'calc(100vh - 208px)'
})

export const UL = styled('ul')([], {
  listStyle: 'none',
  margin: 0,
  paddingLeft: 0,
  paddingBottom: '48px',
})

export const LI = styled('li')([], {
})

const depthPad = ({ to = '' }) =>
  (1 + to.split('/')
    .filter(s => s.length)
    .slice(1).length) * 16

const Link = styled(props => (
  <NavLink
    {...props}
    is={RouterNavLink}
    w={1}
    pl={(depthPad(props) - 4) + 'px'}
  />
))([], props => ({
  borderLeft: '4px solid',
  borderColor: 'transparent',
  '&.active, &:focus': {
    color: themeGet('colors.blue', '#07c')(props),
    outline: 'none',
  },
  '&:focus': {
    borderColor: 'inherit',
  }
}))

Link.defaultProps = {
  to: ''
}

const unhyphenate = str => str.replace(/(\w)(-)(\w)/g, '$1 $3')
const upperFirst = str => str.charAt(0).toUpperCase() + str.slice(1)
const format = (str, data) => {
  if (data && data.path && data.path.match((/commands/)) && str !== 'commands') {
    return <span>{str}</span>
  }
  return upperFirst(unhyphenate(str))
}

const NavBar = ({
  title,
  logo,
  focus,
  update,
}) =>
  <Toolbar
    color='inherit'
    bg='transparent'>
    {logo}
    <Heading
      px={2}
      fontSize={1}
    >
      {title}
    </Heading>
    <Box mx='auto' />
  </Toolbar>


  const EditLink = styled.div`
    a {
      display: flex;
      align-items: center;
    }
    svg {
      width: 18px;
      height: 18px;
      margin-left: 5px;
      margin-bottom: 1px;
      fill: #686868;
    }
    position: absolute;
    right: 25px;
    top: 25px;
    @media (max-width: 768px) {
      right: 25px;
      top: 70px;
    }
  `;

export const Nav = ({
  routes = [],
  ...props
}) =>
  <React.Fragment>
    <NavBar {...props} />
    <Divider my={0} />
    <div style={{display: 'none'}}>
      {/* TODO implement algolia search */}
      <input placeholder="Search"></input>
    </div>
    <UL>
      {routes.map(route => {
        // Hide items from nav if frontMatter hidden: true
        if (route.module && route.module.frontMatter && route.module.frontMatter.hidden) {
          return null
        }
        return (<LI key={route.key}>
            {/^https?:\/\//.test(route.path) ? (
              <NavLink pl={3} href={route.path}>
                {route.name}
              </NavLink>
            ) : (
              <Link to={route.path} exact>
                {format(route.name, route)}
              </Link>
            )}
          </LI>
        )}
      )}
    </UL>
  </React.Fragment>

export const Pagination = ({ previous, next }) =>
  <Flex py={4} flexWrap='wrap'>
    {previous && (
      <BlockLink
        py={2}
        is={RouterLink}
        to={previous.path}>
        <Text mb={1}>Previous:</Text>
        <Text
          fontSize={3}
          fontWeight='bold'>
          {format(previous.name)}
        </Text>
      </BlockLink>
    )}
    <Box mx='auto' />
    {next && (
      <BlockLink
        py={2}
        is={RouterLink}
        to={next.path}>
        <Text mb={1}>Next:</Text>
        <Text
          fontSize={3}
          fontWeight='bold'>
          {format(next.name)}
        </Text>
      </BlockLink>
    )}
  </Flex>

const MobileNav = ({
  title,
  logo,
  update
}) =>
  <MobileOnly>
    <Toolbar px={0} color='inherit' bg='transparent'>
      <ButtonTransparent
        px={2}
        borderRadius={0}
        m={0}
        mr='auto'
        title='Toggle Menu'
        onClick={e => update(toggle('menu'))}
      >
        {logo || <MenuIcon />}
      </ButtonTransparent>
      <Heading fontSize={1}>
        {title}
      </Heading>
      <Box width={48} ml='auto' />
    </Toolbar>
    <Divider my={0} />
  </MobileOnly>

const toggle = key => state => ({ [key]: !state[key] })
const close = state => ({ menu: false })

export default class Layout extends React.Component {
  static propTypes = {
    routes: PropTypes.array.isRequired
  }

  state = {
    menu: false,
    update: fn => this.setState(fn)
  }

  render () {
    const {
      routes = [],
      children,
      route,
      title = 'Netlify CLI',
      logo,
    } = this.props

    const { menu, update } = this.state

    const opts = route ? route.props : {}

    if (opts.layout === false) {
      return children
    }

    const Wrapper = opts.fullWidth ? React.Fragment : MaxWidth

    const index = routes.findIndex(r => r.path === route.path)
    const pagination = {
      previous: routes[index - 1],
      next: routes[index + 1]
    }

    // Set page title
    let pageTitle = '404 not found'
    if (route.module) {
      const frontMatter = route.module.frontMatter
      if (frontMatter.title) {
        pageTitle = frontMatter.title
      } else {
        pageTitle = this.props.route.name
      }
    }

    return (
      <React.Fragment>

        <Helmet>
          <meta charSet="utf-8" />
          <title>{pageTitle}</title>
        </Helmet>

        <MobileNav
          title={title}
          logo={logo}
          update={update}
        />

        <Root>
          {menu && <Overlay onClick={e => update(close)} />}
          <Sidebar
            open={menu}
            onClick={e => update(close)}>
            <Nav
              title={title}
              logo={logo}
              routes={routes}
              update={update}
            />
          </Sidebar>
          <Main tabIndex={menu ? -1 : undefined}>
            <EditLink>
              <a
                style={{
                  color: '#333',
                  textDecoration: 'none',
                  fontSize: '12px'
                }}
                href={`${repoUrl}/edit/master/docs/${this.props.route.key}`}
              >
                Edit this doc <GithubIcon/>
              </a>
            </EditLink>
            <div style={{ position: 'absolute', right: 20, top: 20 }}>

            </div>
            <Wrapper>
              <Content>
                {children}
              </Content>
              {!opts.hidePagination && <Pagination {...pagination} />}
            </Wrapper>
          </Main>
        </Root>
      </React.Fragment>
    )
  }
}
