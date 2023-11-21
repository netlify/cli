import algoliasearch from 'algoliasearch/lite.js'
import PropTypes from 'prop-types'
import React from 'react'
import { Helmet } from 'react-helmet'
import { InstantSearch, SearchBox, connectStateResults, Configure, Highlight } from 'react-instantsearch-dom'
import { Link as RouterLink, NavLink as RouterNavLink } from 'react-router-dom'
import { Flex, Box, Container, Text, Toolbar, Divider, Heading, NavLink, BlockLink, ButtonTransparent } from 'rebass'
import styled from 'styled-components'
import { borderColor } from 'styled-system'

const breakpoint = `@media screen and (min-width: 48em)`

const searchClient = algoliasearch('4RTNPM1QF9', '0ab695b5d73241c475f6b0bfed125bcf')

export const Root = styled.div`
  min-height: 100vh;
  display: flex;
  .ais-InstantSearch__root {
    width: 100%;
  }
  pre {
    line-height: 26px;
  }

  li code {
    padding: 4px 8px;
    background: #f1f1f1;
    border-radius: 4px;
  }
  .doc-content li {
    margin-bottom: 15px;
    line-height: 26px;
  }
`

export const Sidebar = styled('div')(
  [],
  {
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
  },
  (props) => ({
    transform: props.open ? 'translateX(0)' : 'translateX(-100%)',
    [breakpoint]: {
      transform: 'none',
    },
  }),
  borderColor,
)
Sidebar.defaultProps = {
  borderColor: 'gray',
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
    display: 'none',
  },
})

const MENU_ICON_SIZE = 24
export const MenuIcon = ({ size = MENU_ICON_SIZE, ...props }) => (
  <svg {...props} viewBox="0 0 24 24" width={size} height={size} fill="currentcolor">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
  </svg>
)

const LogoContainer = styled.span`
  display: flex;
  align-items: center;

  svg {
    display: block;
    width: 140px;
    height: auto;
  }
`

const NetlifyLogo = () => (
  <LogoContainer>
    <svg viewBox="0 0 122 40" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M86.99 19.93c0-2.35 1.06-3.62 2.98-3.62 1.7 0 2.35.85 2.56 1.7l.21.21h1.7l.22-.2c-.21-1.93-1.7-3.63-4.69-3.63-3.2 0-5.12 2.13-5.12 5.54s1.92 5.54 5.12 5.54c2.99 0 4.48-1.7 4.7-3.62l-.22-.21h-1.7l-.22.2c-.21.86-.85 1.71-2.56 1.71-1.92 0-2.98-1.27-2.98-3.62Zm11.71 5.12v-14.5l-.21-.21h-1.7l-.22.2v14.5l.21.22h1.71l.21-.21Zm4.69-12.37v-1.7l-.22-.22h-1.7l-.21.22v1.7l.2.21h1.71l.22-.2Zm0 12.37V14.8l-.22-.21h-1.7l-.21.21v10.24l.2.21h1.71l.22-.21Z"
        fill="#778089"
      />
      <path
        d="M22.8 39.8V29.68l.2-.21h2.53l.2.2V39.8l-.2.21H23l-.2-.2Zm0-29.49V.21L23 0h2.53l.2.2v10.11l-.2.21H23l-.2-.2Zm-8.7 22.38h-.35l-1.73-1.74v-.35l3.25-3.26h1.84l.25.25v1.84l-3.26 3.26Zm-2.08-23.2v-.35l1.73-1.73h.35l3.26 3.25v1.84l-.25.25h-1.84l-3.25-3.26ZM.58 18.52H14.9l.2.21v2.53l-.2.21H.58l-.2-.2v-2.54l.2-.2Z"
        fill="#05BDBA"
      />
      <path
        d="M29 25.27h-2.52l-.21-.21v-5.92c0-1.05-.41-1.87-1.68-1.9-.66 0-1.4 0-2.2.04l-.12.12v7.65l-.21.21h-2.53l-.2-.2V14.94l.2-.21h5.69a4 4 0 0 1 4 4v6.31l-.22.21Zm12.24-4.43-.21.21H34.5l-.21.21c0 .42.42 1.68 2.1 1.68.64 0 1.27-.2 1.48-.63l.21-.2h2.53l.2.2c-.2 1.27-1.26 3.16-4.42 3.16-3.58 0-5.26-2.52-5.26-5.47 0-2.95 1.68-5.48 5.05-5.48s5.06 2.53 5.06 5.48v.84Zm-3.16-2.1c0-.22-.21-1.7-1.9-1.7a1.78 1.78 0 0 0-1.9 1.7l.22.2h3.37l.2-.2Zm9.06 3.36c0 .43.2.64.63.64h1.9l.2.2v2.11l-.2.21h-1.9c-1.9 0-3.58-.84-3.58-3.16v-4.63l-.21-.21H42.5l-.2-.21v-2.1l.2-.22h1.48l.2-.2v-1.9l.22-.21h2.52l.21.2v1.9l.21.21h2.32l.2.21v2.1l-.2.22h-2.32l-.2.2v4.64Zm7.79 3.17H52.4l-.2-.21V10.73l.2-.21h2.53l.21.21v14.32l-.2.21Zm5.69-12.22h-2.53l-.2-.21v-2.11l.2-.21h2.53l.2.21v2.1l-.2.22Zm0 12.22h-2.53l-.2-.21V14.94l.2-.2h2.53l.2.2v10.12l-.2.2Zm9.9-14.54v2.1l-.2.22h-1.9c-.43 0-.64.2-.64.63v.84l.21.21h2.11l.21.21v2.1l-.2.22h-2.12l-.2.2v7.59l-.22.2h-2.52l-.21-.2v-7.58l-.21-.21h-1.48l-.2-.21v-2.1l.2-.22h1.48l.2-.2v-.85c0-2.32 1.7-3.16 3.59-3.16h1.9l.2.2v.01Zm7.79 14.74c-.84 2.11-1.68 3.37-4.63 3.37h-1.06l-.2-.2v-2.11l.2-.21h1.06c1.05 0 1.26-.21 1.47-.84v-.21l-3.37-8.22v-2.1l.21-.22h1.9l.2.21 2.53 7.17h.21l2.53-7.17.2-.2h1.9l.21.2v2.11l-3.37 8.43h.01Z"
        fill="#014847"
      />
      <path d="M106.66 18.52h14.32l.2.21v2.53l-.2.21h-14.32l-.2-.2v-2.54l.2-.2Z" fill="#05BDBA" />
    </svg>
  </LogoContainer>
)

const MAIN_WIDTH = 256
export const Main = (props) => <Box {...props} is="main" flex="1 1 auto" w={1} pl={[null, null, MAIN_WIDTH]} />

export const MaxWidth = (props) => <Container {...props} maxWidth={768} px={4} pt={4} pb={6} />

export const Content = styled(Box)([], {
  minHeight: 'calc(100vh - 208px)',
})

export const UL = styled('ul')([], {
  listStyle: 'none',
  margin: 0,
  paddingLeft: 0,
  paddingBottom: '48px',
})

export const LI = styled('li')([], {})

const DEPTH_PAD_INCREMENT = 16
const DEPTH_PATH_SHIFT = 4
const depthPad = ({ to = '' }) =>
  (1 +
    to
      .split('/')
      .filter((string) => string.length)
      .slice(1).length) *
  DEPTH_PAD_INCREMENT

const Link = styled((props) => (
  <NavLink {...props} is={RouterNavLink} w={1} pl={`${depthPad(props) - DEPTH_PATH_SHIFT}px`} />
))([], () => ({
  borderLeft: '4px solid',
  borderColor: 'transparent',
  display: 'block',
  '&.active, &.active:hover': {
    color: '#04a29f',
    outline: 'none',
  },
  '&:hover, &:focus': {
    color: '#02807d',
  },
  '&:focus': {
    borderColor: 'currentColor',
  },
}))

Link.defaultProps = {
  to: '',
}

const format = (str, data) => {
  if (data && data.path && /commands/.test(data.path) && str !== 'commands') {
    return <span>{str}</span>
  }
  return str
}

const NavBar = ({ logo }) => (
  <Toolbar color="inherit" bg="transparent" minHeight="70px">
    {logo}
    <Heading px={2} fontSize={1}>
      <a href="/" style={{ textDecoration: 'none' }}>
        <NetlifyLogo />
      </a>
    </Heading>
    <Box mx="auto" />
  </Toolbar>
)

const SearchBoxWrapper = styled.div`
  padding-left: 10px;
  margin-top: 15px;
  margin-bottom: 15px;
  .ais-SearchBox-form {
    input {
      font-size: 14px;
      padding: 7px 8px;
      width: 80%;
      border: 1px solid #9da7b2;
      border-radius: 4px;
      -webkit-appearance: initial;
    }
    button {
      display: none;
    }
  }
  @media (max-width: 815px) {
    display: none;
  }
`

const HitBoxWrapper = styled.div`
  position: fixed;
  top: 100px;
  left: 5px;
  background: white;
  box-shadow: 0 6px 34px rgba(83, 40, 255, 0.15);
  .ais-Highlight-highlighted {
    background: yellow;
  }
  a {
    text-decoration: none;
    color: #333;
  }
  @media (max-width: 815px) {
    width: 100%;
  }
`

const HitsOverlay = styled.div`
  padding: 10px;
  background-color: #fff;
`

const SEARCH_RESULT_WIDTH = 450

const Hits = ({ searchResults }) => {
  const { hits, query } = searchResults || {}
  if (!hits || !query) {
    return null
  }
  return hits.map((hit, index) => {
    // Build the name based on the hierarchy. Skip lvl0 which is 'In the CLI docs'
    const name = Object.values(hit.hierarchy).filter(Boolean).slice(1).join(' > ')
    const highlightedHit = {
      ...hit,
      _highlightResult: {
        name: {
          value: name,
        },
      },
    }
    const slug = highlightedHit.url.replace('https://cli.netlify.com', '')
    return (
      <HitsOverlay key={index}>
        <a href={slug}>
          <span style={{ width: SEARCH_RESULT_WIDTH, display: 'inline-block', fontWeight: 'bold' }}>
            <Highlight attribute="name" hit={highlightedHit} />
          </span>
        </a>
      </HitsOverlay>
    )
  })
}

const MyHits = connectStateResults(Hits)

export const Nav = ({ routes = [], ...props }) => (
  <React.Fragment>
    <NavBar {...props} />

    <Divider my={0} />

    {props.searchRender}

    <Divider my={0} />

    <UL>
      {routes.map((route) => {
        // Hide items from nav if frontMatter hidden: true
        if (route.module && route.module.frontMatter && route.module.frontMatter.hidden) {
          return null
        }
        return (
          <LI key={route.key}>
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
        )
      })}
    </UL>
  </React.Fragment>
)

export const Pagination = ({ next, previous }) => (
  <Flex py={4} flexWrap="wrap">
    {previous && (
      <BlockLink py={2} is={RouterLink} to={previous.path}>
        <Text mb={1}>Previous:</Text>
        <Text fontSize={3} fontWeight="bold">
          {format(previous.name)}
        </Text>
      </BlockLink>
    )}
    <Box mx="auto" />
    {next && (
      <BlockLink py={2} is={RouterLink} to={next.path}>
        <Text mb={1}>Next:</Text>
        <Text fontSize={3} fontWeight="bold">
          {format(next.name)}
        </Text>
      </BlockLink>
    )}
  </Flex>
)

const MobileNav = ({ logo, title, update }) => (
  <MobileOnly>
    <Toolbar px={0} color="inherit" bg="transparent">
      <ButtonTransparent
        px={2}
        borderRadius={0}
        m={0}
        mr="auto"
        title="Toggle Menu"
        onClick={() => update(toggle('menu'))}
      >
        {logo || <MenuIcon />}
      </ButtonTransparent>
      <Heading fontSize={1}>{title}</Heading>
      <Box width={48} ml="auto" />
    </Toolbar>
    <Divider my={0} />
  </MobileOnly>
)

const SosumiList = styled.ul`
  margin-top: 3rem;
  list-style: none;
  padding-left: 0;
  text-align: center;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.5rem;

  a {
    color: #787878;
    text-decoration: none;
    border-bottom: 1px solid #555;

    &:hover {
      color: #111;
      border-bottom-color: #111;
    }
  }
`

const Sosumi = () => (
  <SosumiList>
    <li>
      <a href="https://www.netlify.com/trust-center/">Trust Center</a>
    </li>
    <li>
      <a href="https://www.netlify.com/privacy/">Privacy</a>
    </li>
    <li>
      <a href="https://www.netlify.com/security/">Security</a>
    </li>
    <li>
      <a href="https://www.netlify.com/gdpr-ccpa/">GDPR/CCPA</a>
    </li>
    <li>
      <a
        href="mailto:fraud@netlify.com?subject=Abuse%20report&amp;body=Please%20include%20the%20site%20URL%20and%20reason%20for%20your%20report%2C%20and%20we%20will%20reply%20promptly."
        target="_blank"
        rel="noopener noreferrer"
      >
        Abuse
      </a>
    </li>
  </SosumiList>
)

const toggle = (key) => (state) => ({ [key]: !state[key] })
const close = () => ({ menu: false })

export default class Layout extends React.Component {
  static propTypes = {
    routes: PropTypes.array.isRequired,
  }

  state = {
    menu: false,

    update: (fn) => this.setState(fn),
  }

  render() {
    const { children, logo, route, routes = [], title = 'Netlify CLI' } = this.props

    const { menu, update } = this.state

    const opts = route ? route.props : {}

    if (opts.layout === false) {
      return children
    }

    const Wrapper = opts.fullWidth ? React.Fragment : MaxWidth

    const index = routes.findIndex((thisRoute) => thisRoute.path === route.path)
    const pagination = {
      previous: routes[index - 1],
      next: routes[index + 1],
    }

    // Set page title
    let pageTitle = title
    if (route.module) {
      const { frontMatter } = route.module
      pageTitle = frontMatter.title ? frontMatter.title : route.name
    }

    return (
      <React.Fragment>
        <Helmet>
          <meta charSet="utf-8" />
          <title>{pageTitle}</title>
          <script async src="https://www.googletagmanager.com/gtag/js?id=G-X2FMMZSSS9"></script>
          <script>
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-X2FMMZSSS9');`}
          </script>
        </Helmet>

        <MobileNav title={title} logo={logo} update={update} />

        <Root>
          {menu && <Overlay onClick={() => update(close)} />}
          <InstantSearch searchClient={searchClient} indexName="cli-docs">
            <Configure />
            <Sidebar open={menu} onClick={() => update(close)}>
              <Nav
                title={title}
                logo={logo}
                routes={routes}
                update={update}
                searchRender={
                  <SearchBoxWrapper>
                    <SearchBox translations={{ placeholder: 'Search cli docs' }} />
                  </SearchBoxWrapper>
                }
              />
            </Sidebar>
            <Main tabIndex={menu ? -1 : undefined}>
              <HitBoxWrapper>
                <MyHits />
              </HitBoxWrapper>
              <Wrapper>
                <Content>
                  <div className="doc-content">{children}</div>
                </Content>
                {!opts.hidePagination && <Pagination {...pagination} />}
                <Sosumi />
              </Wrapper>
            </Main>
          </InstantSearch>
        </Root>
      </React.Fragment>
    )
  }
}
