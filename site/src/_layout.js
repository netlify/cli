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
  svg {
    width: 130px;
  }
  display: flex;
  align-items: center;
  color: rgb(14, 30, 37);
`

const NetlifyLogo = () => (
  <LogoContainer>
    <svg width="182" height="40" viewBox="0 0 182 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="m53.37 12.978.123 2.198c1.403-1.7 3.245-2.55 5.525-2.55 3.951 0 5.962 2.268 6.032 6.804v12.568h-4.26V19.676c0-1.207-.26-2.101-.78-2.681-.52-.58-1.371-.87-2.552-.87-1.719 0-3 .78-3.84 2.338v13.535h-4.262v-19.02h4.016ZM77.748 32.35c-2.7 0-4.89-.852-6.567-2.557-1.678-1.705-2.517-3.976-2.517-6.812v-.527c0-1.898.365-3.595 1.096-5.089.73-1.494 1.757-2.657 3.078-3.49 1.321-.831 2.794-1.247 4.42-1.247 2.583 0 4.58.826 5.988 2.478 1.41 1.653 2.114 3.99 2.114 7.014v1.723h-12.4c.13 1.57.653 2.812 1.57 3.726.918.914 2.073 1.371 3.464 1.371 1.952 0 3.542-.79 4.77-2.373l2.297 2.198c-.76 1.136-1.774 2.018-3.042 2.645-1.269.627-2.692.94-4.27.94Zm-.508-16.294c-1.17 0-2.114.41-2.833 1.23-.719.82-1.177 1.963-1.376 3.428h8.12v-.317c-.094-1.43-.474-2.51-1.14-3.243-.667-.732-1.59-1.098-2.771-1.098Zm16.765-7.7v4.623h3.35v3.164h-3.35V26.76c0 .726.144 1.25.43 1.573.287.322.798.483 1.535.483a6.55 6.55 0 0 0 1.49-.175v3.304c-.97.27-1.906.404-2.806.404-3.273 0-4.91-1.81-4.91-5.431V16.142H86.62v-3.164h3.122V8.355h4.261Zm11.137 23.643h-4.262v-27h4.262v27Zm9.172 0h-4.262v-19.02h4.262v19.02Zm-4.525-23.96c0-.655.207-1.2.622-1.634.416-.433 1.009-.65 1.781-.65.771 0 1.367.217 1.788.65.421.434.632.979.632 1.635 0 .644-.211 1.18-.632 1.608-.421.428-1.017.642-1.788.642-.772 0-1.365-.214-1.781-.642-.415-.427-.622-.964-.622-1.608Zm10.663 23.96V16.142h-2.894v-3.164h2.894v-1.74c0-2.11.584-3.738 1.753-4.887 1.169-1.148 2.806-1.722 4.911-1.722a9.83 9.83 0 0 1 2.385.316l-.105 3.34a8.382 8.382 0 0 0-1.631-.14c-2.035 0-3.052 1.048-3.052 3.146v1.687h3.858v3.164h-3.858v15.856h-4.261Zm17.87-6.117 3.858-12.903h4.542l-7.541 21.903c-1.157 3.199-3.121 4.798-5.892 4.798-.62 0-1.304-.105-2.052-.316v-3.305l.807.053c1.075 0 1.885-.196 2.429-.589.543-.392.973-1.051 1.289-1.977l.613-1.635-6.664-18.932h4.595l4.016 12.903Z"
        fill="#0e1e25"
      />
      <path
        d="m27.887 14.135-.014-.006c-.008-.003-.016-.006-.023-.013a.11.11 0 0 1-.028-.093l.773-4.726 3.625 3.625-3.77 1.605a.083.083 0 0 1-.033.006h-.015a.104.104 0 0 1-.02-.017 1.716 1.716 0 0 0-.495-.381Zm5.258-.288 3.876 3.876c.805.806 1.208 1.208 1.355 1.674.022.069.04.138.054.209l-9.263-3.923a.728.728 0 0 0-.015-.006c-.037-.015-.08-.032-.08-.07 0-.038.044-.056.081-.071l.012-.005 3.98-1.684Zm5.127 7.003c-.2.376-.59.766-1.25 1.427l-4.37 4.369L27 25.469l-.03-.006c-.05-.008-.103-.017-.103-.063a1.706 1.706 0 0 0-.655-1.192c-.023-.023-.017-.059-.01-.092 0-.005 0-.01.002-.014l1.063-6.526.003-.022c.007-.05.016-.108.062-.108a1.73 1.73 0 0 0 1.16-.665c.008-.01.014-.021.026-.027.032-.015.07 0 .103.014l9.65 4.082Zm-6.625 6.801-7.186 7.186 1.23-7.56.002-.01a.136.136 0 0 1 .006-.029c.01-.024.036-.035.061-.044l.012-.005a1.85 1.85 0 0 0 .695-.517c.024-.028.053-.055.09-.06a.09.09 0 0 1 .029 0l5.06 1.04Zm-8.707 8.707-.81.81-8.955-12.942a.424.424 0 0 0-.01-.014c-.014-.019-.029-.038-.026-.06 0-.016.011-.03.022-.042l.01-.013c.027-.04.05-.08.075-.123l.02-.035.003-.003c.014-.024.027-.047.051-.06.021-.01.05-.006.073-.001l9.921 2.046a.164.164 0 0 1 .076.033c.013.013.016.027.019.043a1.757 1.757 0 0 0 1.028 1.175c.028.014.016.045.003.078a.238.238 0 0 0-.015.045c-.125.76-1.197 7.298-1.485 9.063Zm-1.692 1.691c-.597.591-.949.904-1.347 1.03a2 2 0 0 1-1.206 0c-.466-.148-.869-.55-1.674-1.356L8.028 28.73l2.349-3.643a.15.15 0 0 1 .04-.047c.025-.018.061-.01.091 0a2.434 2.434 0 0 0 1.638-.083c.027-.01.054-.017.075.002a.19.19 0 0 1 .028.032l8.999 13.058ZM7.16 27.863 5.098 25.8l4.074-1.737a.084.084 0 0 1 .033-.007c.034 0 .054.034.072.065a2.91 2.91 0 0 0 .13.184l.013.016c.012.017.004.034-.008.05l-2.25 3.493Zm-2.976-2.976-2.61-2.61c-.444-.444-.766-.766-.99-1.043L8.52 22.88a.84.84 0 0 0 .03.005c.049.008.103.017.103.063 0 .05-.059.073-.109.092l-.023.01-4.337 1.837ZM.13 19.892a2 2 0 0 1 .09-.495c.148-.466.55-.868 1.356-1.674l3.34-3.34a2175.525 2175.525 0 0 0 4.626 6.687c.027.036.057.076.026.106a2.776 2.776 0 0 0-.395.528.16.16 0 0 1-.05.062c-.013.008-.027.005-.042.002h-.002l-8.95-1.877Zm5.68-6.403 4.49-4.491c.423.185 1.96.834 3.333 1.414 1.04.44 1.988.84 2.286.97.03.012.057.024.07.054.008.018.004.041 0 .06a2.003 2.003 0 0 0 .523 1.828c.03.03 0 .073-.026.11l-.014.021-4.56 7.063a.138.138 0 0 1-.043.05c-.024.015-.058.008-.086.001a2.274 2.274 0 0 0-.543-.074c-.164 0-.342.03-.522.063h-.001c-.02.003-.038.007-.054-.005a.21.21 0 0 1-.045-.051L5.81 13.489Zm5.398-5.398 5.814-5.814c.805-.806 1.208-1.208 1.674-1.355a2 2 0 0 1 1.206 0c.466.147.869.55 1.674 1.355l1.26 1.26L18.7 9.94a.155.155 0 0 1-.041.048c-.025.017-.06.01-.09 0a2.098 2.098 0 0 0-1.92.37c-.027.028-.067.012-.101-.003-.54-.235-4.74-2.01-5.341-2.265Zm12.505-3.676 3.82 3.818-.92 5.698-.002.015a.135.135 0 0 1-.008.038c-.009.02-.028.024-.05.03a1.83 1.83 0 0 0-.548.273.154.154 0 0 0-.019.017c-.011.012-.022.023-.04.024a.114.114 0 0 1-.043-.006l-5.818-2.472-.011-.005c-.037-.015-.081-.033-.081-.071a2.198 2.198 0 0 0-.31-.915c-.028-.046-.059-.094-.035-.141l4.066-6.303Zm-3.93 8.606 5.453 2.31c.03.014.063.027.076.058a.106.106 0 0 1 0 .057c-.016.08-.03.171-.03.263v.153c0 .037-.039.054-.075.069l-.011.004c-.864.369-12.13 5.173-12.147 5.173-.017 0-.035 0-.052-.017-.03-.03 0-.072.027-.11a.76.76 0 0 0 .014-.02l4.482-6.94.008-.012c.026-.042.056-.089.104-.089l.045.007c.102.014.192.027.283.027.68 0 1.31-.331 1.69-.897a.16.16 0 0 1 .034-.04c.027-.02.067-.01.098.004Zm-6.247 9.184 12.28-5.236s.018 0 .035.017c.067.067.124.112.178.154l.028.017c.025.014.05.03.052.056 0 .01 0 .016-.002.025L25.054 23.7l-.004.026c-.007.05-.014.107-.062.107a1.729 1.729 0 0 0-1.372.847l-.005.008c-.014.023-.027.045-.05.057-.021.01-.048.006-.07.001l-9.793-2.02c-.01-.002-.152-.519-.163-.52Z"
        fill="url(#paint0_radial)"
      />
      <path
        d="M157.09 29.697c1.16 0 2.174-.351 3.041-1.054.867-.704 1.348-1.582 1.441-2.637h3.076c-.058 1.09-.433 2.127-1.125 3.111-.691.985-1.617 1.77-2.777 2.356a7.934 7.934 0 0 1-3.656.879c-2.59 0-4.652-.862-6.188-2.584-1.523-1.735-2.285-4.102-2.285-7.102v-.545c0-1.851.34-3.498 1.02-4.94.679-1.44 1.652-2.56 2.918-3.357 1.277-.797 2.783-1.195 4.517-1.195 2.133 0 3.903.639 5.309 1.916 1.418 1.277 2.174 2.935 2.267 4.975h-3.076c-.093-1.23-.562-2.239-1.406-3.024-.832-.797-1.863-1.195-3.094-1.195-1.652 0-2.935.597-3.849 1.793-.903 1.183-1.354 2.9-1.354 5.15v.615c0 2.192.451 3.88 1.354 5.063.902 1.183 2.191 1.775 3.867 1.775ZM171.118 32h-3.252V5h3.252v27Zm8.034 0H175.9V12.98h3.252V32Zm-3.516-24.064c0-.528.158-.973.475-1.336.328-.364.808-.545 1.441-.545s1.113.181 1.442.545c.328.363.492.808.492 1.336 0 .527-.164.966-.492 1.318-.329.351-.809.527-1.442.527-.633 0-1.113-.176-1.441-.527-.317-.352-.475-.791-.475-1.318Z"
        fill="url(#paint1_radial)"
      />
      <defs>
        <radialGradient
          id="paint0_radial"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(0 38.3009 -44.2199 0 -1.156 19.46)"
        >
          <stop stopColor="#20c6b7" />
          <stop offset="1" stopColor="#4d9abf" />
        </radialGradient>
        <radialGradient
          id="paint1_radial"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(0 41.9536 -40.4089 0 145.825 19.408)"
        >
          <stop stopColor="#20c6b7" />
          <stop offset="1" stopColor="#4d9abf" />
        </radialGradient>
      </defs>
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
  '&.active, &:focus': {
    color: '#00c2b2',
    outline: 'none',
  },
  '&:focus': {
    borderColor: 'inherit',
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
  <Toolbar color="inherit" bg="transparent">
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
      border: 1px solid black;
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

const toggle = (key) => (state) => ({ [key]: !state[key] })
const close = () => ({ menu: false })

export default class Layout extends React.Component {
  static propTypes = {
    routes: PropTypes.array.isRequired,
  }

  state = {
    menu: false,
    // eslint-disable-next-line no-invalid-this
    update: (fn) => this.setState(fn),
  }

  render() {
    const { routes = [], children, route, title = 'Netlify CLI', logo } = this.props

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
              </Wrapper>
            </Main>
          </InstantSearch>
        </Root>
      </React.Fragment>
    )
  }
}
