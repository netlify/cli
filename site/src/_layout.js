import React from 'react'
import PropTypes from 'prop-types'
import { Link as RouterLink, NavLink as RouterNavLink } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import styled, { injectGlobal } from 'styled-components'
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
import { InstantSearch, Hits, SearchBox, createConnector, Configure, Highlight } from 'react-instantsearch-dom'
import { borderColor, themeGet } from 'styled-system'

const breakpoint = `@media screen and (min-width: 48em)`
const repoUrl = 'https://github.com/netlify/cli'

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
  props => ({
    transform: props.open ? 'translateX(0)' : 'translateX(-100%)',
    [breakpoint]: {
      transform: 'none',
    },
  }),
  borderColor
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

export const MenuIcon = ({ size = 24, ...props }) => {
  return (
    <svg {...props} viewBox="0 0 24 24" width={size} height={size} fill="currentcolor">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
  )
}

const LogoContainer = styled.span`
  svg {
    width: 130px;
  }
  display: flex;
  align-items: center;
  color: rgb(14, 30, 37);
`

const NetlifyLogo = () => {
  return (
    <LogoContainer>
      <svg width="182" height="40" viewBox="0 0 182 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M53.3706 12.9784L53.4933 15.1756C54.8963 13.4764 56.7377 12.6268 59.0176 12.6268C62.9693 12.6268 64.9802 14.8944 65.0504 19.4295V31.9979H60.7888V19.6756C60.7888 18.4686 60.5287 17.575 60.0084 16.995C59.4882 16.4149 58.6376 16.1248 57.4568 16.1248C55.7381 16.1248 54.4579 16.9041 53.6161 18.4627V31.9979H49.3546V12.9784H53.3706ZM77.7474 32.3495C75.0466 32.3495 72.8574 31.4969 71.1797 29.7918C69.5019 28.0868 68.6631 25.8163 68.6631 22.9803V22.453C68.6631 20.5545 69.0284 18.8583 69.7591 17.3641C70.4899 15.87 71.5158 14.7069 72.8369 13.8748C74.1581 13.0428 75.6312 12.6268 77.2563 12.6268C79.8401 12.6268 81.8364 13.453 83.2453 15.1053C84.6541 16.7577 85.3585 19.0955 85.3585 22.119V23.8416H72.9597C73.0883 25.412 73.6115 26.6541 74.5293 27.5682C75.4471 28.4823 76.6016 28.9393 77.9929 28.9393C79.9454 28.9393 81.5354 28.1483 82.763 26.5663L85.0604 28.7635C84.3004 29.9002 83.2862 30.7821 82.0177 31.409C80.7491 32.036 79.3257 32.3495 77.7474 32.3495ZM77.2388 16.0545C76.0696 16.0545 75.1255 16.4647 74.4065 17.285C73.6875 18.1053 73.2286 19.2479 73.0298 20.7127H81.1496V20.3963C81.056 18.9666 80.6761 17.8856 80.0097 17.1532C79.3432 16.4207 78.4196 16.0545 77.2388 16.0545ZM94.0044 8.35532V12.9784H97.354V16.1424H94.0044V26.7596C94.0044 27.4862 94.1476 28.0106 94.434 28.3329C94.7205 28.6551 95.232 28.8163 95.9686 28.8163C96.4596 28.8163 96.9565 28.7577 97.4592 28.6405V31.9452C96.4888 32.2147 95.5535 32.3495 94.6533 32.3495C91.3796 32.3495 89.7428 30.5389 89.7428 26.9178V16.1424H86.6212V12.9784H89.7428V8.35532H94.0044ZM105.141 31.9979H100.879V4.99789H105.141V31.9979ZM114.313 31.9979H110.051V12.9784H114.313V31.9979ZM109.788 8.03891C109.788 7.38266 109.995 6.83774 110.41 6.40414C110.826 5.97055 111.419 5.75375 112.191 5.75375C112.962 5.75375 113.558 5.97055 113.979 6.40414C114.4 6.83774 114.611 7.38266 114.611 8.03891C114.611 8.68344 114.4 9.21957 113.979 9.64731C113.558 10.075 112.962 10.2889 112.191 10.2889C111.419 10.2889 110.826 10.075 110.41 9.64731C109.995 9.21957 109.788 8.68344 109.788 8.03891ZM120.451 31.9979V16.1424H117.557V12.9784H120.451V11.2381C120.451 9.12874 121.035 7.49985 122.204 6.35141C123.373 5.20297 125.01 4.62875 127.115 4.62875C127.863 4.62875 128.658 4.73422 129.5 4.94516L129.395 8.285C128.927 8.19125 128.383 8.14438 127.764 8.14438C125.729 8.14438 124.712 9.1932 124.712 11.2909V12.9784H128.57V16.1424H124.712V31.9979H120.451ZM138.321 25.8807L142.179 12.9784H146.721L139.18 34.8807C138.023 38.0799 136.059 39.6795 133.288 39.6795C132.668 39.6795 131.984 39.5741 131.236 39.3631V36.0584L132.043 36.1112C133.118 36.1112 133.928 35.9149 134.472 35.5223C135.015 35.1297 135.445 34.4706 135.761 33.5448L136.374 31.91L129.71 12.9784H134.305L138.321 25.8807Z"
          fill="#0E1E25"
        />
        <path
          d="M27.8866 14.135C27.8819 14.1326 27.8774 14.1309 27.873 14.1292C27.8647 14.126 27.857 14.1231 27.8498 14.1162C27.8265 14.0942 27.8173 14.0547 27.8224 14.0231L28.5947 9.29671L32.2204 12.9225L28.4503 14.5266C28.4399 14.5311 28.4286 14.5334 28.4173 14.5334C28.4099 14.5334 28.4057 14.5334 28.402 14.5321C28.3969 14.5303 28.3927 14.5261 28.3828 14.5164C28.2496 14.3682 28.0842 14.236 27.8866 14.135ZM33.1448 13.8469L37.0211 17.7231C37.8264 18.5285 38.2291 18.9312 38.3764 19.3969C38.3982 19.4657 38.4161 19.5353 38.4302 19.6056L29.167 15.6833C29.1623 15.6813 29.1574 15.6793 29.1524 15.6773C29.1149 15.6621 29.072 15.6448 29.072 15.6065C29.072 15.5689 29.1162 15.5508 29.153 15.5356C29.157 15.534 29.1609 15.5324 29.1646 15.5309L33.1448 13.8469ZM38.2718 20.85C38.0719 21.226 37.6821 21.6158 37.0211 22.2769L32.6522 26.6457L27 25.4686C26.9906 25.4666 26.9804 25.465 26.9701 25.4633C26.9207 25.4552 26.8666 25.4463 26.8666 25.4005C26.8149 24.9235 26.5909 24.4977 26.2118 24.2082C26.1887 24.1853 26.1952 24.1491 26.2012 24.1158C26.202 24.1111 26.2028 24.1065 26.2036 24.102L27.2673 17.576C27.2684 17.5691 27.2694 17.5618 27.2705 17.5544C27.2774 17.5046 27.2856 17.4461 27.3318 17.4461C27.8072 17.379 28.2156 17.1465 28.4912 16.7812C28.4995 16.7703 28.506 16.76 28.5183 16.7541C28.5498 16.7392 28.5889 16.7548 28.621 16.7683L38.2718 20.85ZM31.6467 27.6512L24.4607 34.8372L25.6917 27.2767C25.6922 27.2732 25.6927 27.2697 25.6931 27.2662C25.6944 27.2567 25.6956 27.2473 25.6991 27.2382C25.7087 27.2139 25.7351 27.2035 25.7601 27.1936C25.7641 27.192 25.768 27.1905 25.7718 27.1889C26.0449 27.0753 26.2766 26.895 26.467 26.6721C26.4912 26.6438 26.5202 26.6174 26.557 26.6111C26.5652 26.6097 26.5777 26.6106 26.5859 26.6123L31.6467 27.6512ZM22.94 36.358L22.1297 37.1683L13.1753 24.226C13.172 24.2213 13.1685 24.2166 13.1649 24.2119C13.1508 24.1934 13.1364 24.1743 13.1385 24.1519C13.1399 24.1357 13.1502 24.1226 13.1605 24.1096C13.1638 24.1054 13.1672 24.1011 13.1702 24.0968C13.1976 24.0576 13.2209 24.0176 13.2464 23.9737C13.253 23.9624 13.2597 23.9508 13.2667 23.9389L13.2687 23.9356C13.2826 23.9119 13.2958 23.8894 13.3201 23.8764C13.3412 23.8652 13.3697 23.8699 13.3931 23.8748L23.3143 25.9208C23.339 25.9259 23.3724 25.9363 23.3904 25.954C23.4032 25.9668 23.4059 25.9807 23.4089 25.9965C23.41 26.0028 23.4113 26.0094 23.4132 26.0162C23.5588 26.5288 23.9322 26.9722 24.4371 27.1719C24.4651 27.1857 24.4527 27.2173 24.4397 27.2504C24.4337 27.2656 24.4276 27.2811 24.4252 27.2953C24.3004 28.0557 23.2278 34.5931 22.94 36.358ZM21.2479 38.0491C20.6511 38.6401 20.2991 38.9526 19.901 39.0785C19.5086 39.2026 19.0873 39.2026 18.6949 39.0785C18.2291 38.9312 17.8264 38.5285 17.0211 37.7231L8.02839 28.7304L10.3768 25.0869C10.3884 25.0689 10.3989 25.0526 10.4164 25.0402C10.4419 25.0221 10.4783 25.0308 10.5081 25.0401C10.7498 25.1147 10.9779 25.145 11.2213 25.145C11.5354 25.145 11.8336 25.0823 12.1463 24.9569C12.1727 24.9463 12.2001 24.94 12.2213 24.9588C12.2314 24.9678 12.2418 24.9802 12.2494 24.9913L21.2479 38.0491ZM7.16123 27.8632L5.09754 25.7995L9.17238 24.0616C9.18284 24.0571 9.19409 24.0548 9.20546 24.0548C9.23922 24.0548 9.25899 24.0886 9.27744 24.1201C9.28198 24.1279 9.28644 24.1355 9.29101 24.1424C9.32989 24.2015 9.36876 24.253 9.40764 24.3043C9.4107 24.3083 9.41761 24.316 9.42046 24.3201C9.43201 24.3371 9.42355 24.3536 9.41244 24.3708L7.16123 27.8632ZM4.18514 24.8871L1.57486 22.2769C1.13091 21.8329 0.809328 21.5113 0.585426 21.2341L8.52062 22.8796C8.52999 22.8815 8.5401 22.8832 8.55042 22.8849C8.59987 22.8929 8.65399 22.9018 8.65399 22.9476C8.65399 22.9973 8.59528 23.0206 8.54511 23.0404C8.5371 23.0436 8.52931 23.0467 8.52201 23.0498L4.18514 24.8871ZM0.129333 19.8919C0.138382 19.7247 0.168438 19.5584 0.219502 19.3969C0.366795 18.9312 0.769485 18.5285 1.57486 17.7231L4.91587 14.3821C5.46639 15.1901 9.10285 20.4433 9.52732 21.0513C9.53146 21.0572 9.53598 21.0633 9.54059 21.0695C9.56769 21.1061 9.59755 21.1464 9.5673 21.1763C9.42094 21.337 9.27458 21.5129 9.17168 21.7041C9.15953 21.7266 9.14397 21.7522 9.12218 21.7657C9.10892 21.7739 9.09535 21.771 9.08023 21.7678L9.07797 21.7674L0.129333 19.8919ZM5.80866 13.4893L10.2999 8.99802C10.722 9.18269 12.2584 9.83196 13.6317 10.4123C14.6726 10.8522 15.6202 11.2527 15.9175 11.3811C15.9474 11.394 15.9747 11.4058 15.9879 11.4356C15.9958 11.4535 15.9919 11.4771 15.9879 11.4963C15.9576 11.64 15.9425 11.7837 15.9425 11.9274C15.9425 12.4554 16.1493 12.9494 16.5111 13.3241C16.5409 13.3535 16.5108 13.3966 16.4845 13.4344C16.4796 13.4415 16.4748 13.4484 16.4706 13.455L11.9113 20.5182C11.8989 20.5374 11.8876 20.555 11.8684 20.5675C11.8442 20.5833 11.8103 20.5762 11.7823 20.5691C11.6046 20.5241 11.4142 20.4949 11.2386 20.4949C11.0754 20.4949 10.8968 20.5255 10.7173 20.5576L10.7157 20.5579C10.6963 20.5614 10.6783 20.5647 10.6622 20.553C10.6446 20.5403 10.6293 20.5199 10.617 20.502L5.80866 13.4893ZM11.2067 8.09122L17.0211 2.27689C17.8264 1.4715 18.2291 1.06881 18.6949 0.921518C19.0873 0.797396 19.5086 0.797396 19.901 0.921518C20.3668 1.06881 20.7695 1.4715 21.5748 2.27689L22.8348 3.53684L18.6998 9.94138C18.6879 9.9598 18.677 9.97659 18.6589 9.98905C18.6339 10.0062 18.5985 9.99814 18.5693 9.98984C18.36 9.93032 18.1506 9.90056 17.9412 9.90056C17.476 9.90056 17.0108 10.0709 16.649 10.3604C16.6222 10.3869 16.5821 10.3706 16.5476 10.3556C16.0076 10.1212 11.8076 8.34527 11.2067 8.09122ZM23.7125 4.41457L27.5314 8.23348L26.6119 13.9306C26.6112 13.9352 26.6106 13.9405 26.6101 13.946C26.6087 13.9591 26.6071 13.9735 26.6025 13.9838C26.5935 14.0038 26.5738 14.0083 26.5528 14.0131C26.5457 14.0147 26.5384 14.0164 26.5313 14.0187C26.3379 14.0819 26.1585 14.1709 26.0044 14.2859C25.9972 14.2913 25.9912 14.2976 25.9854 14.3037C25.9738 14.316 25.9629 14.3274 25.945 14.3285C25.9332 14.3292 25.9133 14.3266 25.9024 14.3219L20.0842 11.8498C20.0804 11.8482 20.0765 11.8466 20.0725 11.8449C20.0357 11.8298 19.9916 11.8116 19.9916 11.774C19.9602 11.463 19.8569 11.1521 19.695 10.88C19.6909 10.8732 19.6867 10.8663 19.6823 10.8593C19.6538 10.8134 19.6234 10.7647 19.647 10.718L23.7125 4.41457ZM19.7812 13.0209L25.2347 15.3313C25.2659 15.3445 25.2978 15.358 25.3105 15.3894C25.3172 15.4062 25.314 15.4281 25.3106 15.4457C25.2953 15.5252 25.2814 15.617 25.2814 15.7087V15.862C25.2814 15.8995 25.2422 15.9158 25.2064 15.9305C25.2024 15.9322 25.1984 15.9338 25.1946 15.9354C24.3309 16.3038 13.0644 21.1081 13.0478 21.1081C13.0306 21.1081 13.0134 21.1081 12.9961 21.0911C12.9664 21.0617 12.9964 21.0186 13.0227 20.9807C13.0276 20.9737 13.0324 20.9668 13.0367 20.9602L17.5191 14.0211C17.5217 14.0171 17.5243 14.013 17.5269 14.0089C17.5534 13.967 17.5831 13.9203 17.6311 13.9203C17.6464 13.9224 17.6615 13.9246 17.6763 13.9267C17.778 13.9414 17.8682 13.9544 17.9585 13.9544C18.6386 13.9544 19.2684 13.6226 19.6492 13.0573C19.6593 13.0423 19.6684 13.0289 19.6827 13.0177C19.7099 12.9966 19.7495 13.0074 19.7812 13.0209ZM13.5353 22.2055L25.8155 16.9691C25.8155 16.9691 25.8328 16.9692 25.85 16.9862C25.9173 17.0526 25.974 17.0984 26.0285 17.1396C26.0366 17.1457 26.0461 17.1512 26.0557 17.1568C26.0809 17.1714 26.1065 17.1863 26.1082 17.213C26.1087 17.2222 26.1077 17.2292 26.1062 17.2383L25.0536 23.6999C25.0522 23.7081 25.0511 23.7168 25.0499 23.7256C25.0432 23.7764 25.0357 23.8333 24.9885 23.8333C24.4177 23.8665 23.9124 24.1907 23.6159 24.6799C23.6143 24.6826 23.6127 24.6852 23.6111 24.6878C23.5974 24.7109 23.5842 24.733 23.5601 24.7451C23.5398 24.7552 23.5127 24.7508 23.4906 24.7462L13.6981 22.726C13.6888 22.7241 13.5456 22.2071 13.5353 22.2055Z"
          fill="url(#paint0_radial)"
        />
        <path
          d="M157.09 29.6973C158.25 29.6973 159.264 29.3457 160.131 28.6426C160.998 27.9395 161.479 27.0605 161.572 26.0059H164.648C164.59 27.0957 164.215 28.1328 163.523 29.1172C162.832 30.1016 161.906 30.8867 160.746 31.4727C159.598 32.0586 158.379 32.3516 157.09 32.3516C154.5 32.3516 152.438 31.4902 150.902 29.7676C149.379 28.0332 148.617 25.666 148.617 22.666V22.1211C148.617 20.2695 148.957 18.623 149.637 17.1816C150.316 15.7402 151.289 14.6211 152.555 13.8242C153.832 13.0273 155.338 12.6289 157.072 12.6289C159.205 12.6289 160.975 13.2676 162.381 14.5449C163.799 15.8223 164.555 17.4805 164.648 19.5195H161.572C161.479 18.2891 161.01 17.2812 160.166 16.4961C159.334 15.6992 158.303 15.3008 157.072 15.3008C155.42 15.3008 154.137 15.8984 153.223 17.0938C152.32 18.2773 151.869 19.9941 151.869 22.2441V22.8594C151.869 25.0508 152.32 26.7383 153.223 27.9219C154.125 29.1055 155.414 29.6973 157.09 29.6973ZM171.118 32H167.866V5H171.118V32ZM179.152 32H175.9V12.9805H179.152V32ZM175.636 7.93555C175.636 7.4082 175.794 6.96289 176.111 6.59961C176.439 6.23633 176.919 6.05469 177.552 6.05469C178.185 6.05469 178.665 6.23633 178.994 6.59961C179.322 6.96289 179.486 7.4082 179.486 7.93555C179.486 8.46289 179.322 8.90234 178.994 9.25391C178.665 9.60547 178.185 9.78125 177.552 9.78125C176.919 9.78125 176.439 9.60547 176.111 9.25391C175.794 8.90234 175.636 8.46289 175.636 7.93555Z"
          fill="url(#paint1_radial)"
        />
        <defs>
          <radialGradient
            id="paint0_radial"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(-1.15636 19.4598) rotate(90) scale(38.3009 44.2199)"
          >
            <stop stopColor="#20C6B7" />
            <stop offset="1" stopColor="#4D9ABF" />
          </radialGradient>
          <radialGradient
            id="paint1_radial"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(145.825 19.4083) rotate(90) scale(41.9536 40.4089)"
          >
            <stop stopColor="#20C6B7" />
            <stop offset="1" stopColor="#4D9ABF" />
          </radialGradient>
        </defs>
      </svg>
    </LogoContainer>
  )
}

const GithubIcon = () => {
  return (
    <svg aria-labelledby="simpleicons-github-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export const Main = props => <Box {...props} is="main" flex="1 1 auto" w={1} pl={[null, null, 256]} />

export const MaxWidth = props => <Container {...props} maxWidth={768} px={4} pt={4} pb={6} />

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

const depthPad = ({ to = '' }) =>
  (1 +
    to
      .split('/')
      .filter(s => s.length)
      .slice(1).length) *
  16

const Link = styled(props => <NavLink {...props} is={RouterNavLink} w={1} pl={depthPad(props) - 4 + 'px'} />)(
  [],
  props => ({
    'borderLeft': '4px solid',
    'borderColor': 'transparent',
    '&.active, &:focus': {
      color: '#00c2b2', //'#00ad9f', // themeGet('colors.blue', '#07c')(props),
      outline: 'none',
    },
    '&:focus': {
      borderColor: 'inherit',
    },
  })
)

Link.defaultProps = {
  to: '',
}

const unhyphenate = str => str.replace(/(\w)(-)(\w)/g, '$1 $3')
const upperFirst = str => str.charAt(0).toUpperCase() + str.slice(1)
/*const format = (str) => {
  return upperFirst(unhyphenate(str))
}*/
const format = (str, data) => {
  if (data && data.path && data.path.match(/commands/) && str !== 'commands') {
    return <span>{str}</span>
  }
  return str
}

const NavBar = ({ title, logo, focus, update }) => (
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
`

const SearchBoxWrapper = styled.div`
  padding-left: 10px;
  margin-top: 15px;
  margin-bottom: 15px;
  .ais-SearchBox-form {
    input {
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

const SearchWrapper = styled.div`
  .ais-Highlight-highlighted {
    background: blue;
  }
`

const Result = props => {
  // console.log(props)
  return <div>{props.hit.firstname}</div>
}

const HitsOverlay = styled.div`
  padding: 20px;
  background-color: #fff;
`

const MyHits = createConnector({
  displayName: 'ConditionalQuery',
  getProvidedProps(props, searchState, searchResults) {
    const { query, hits } = searchResults.results ? searchResults.results : {}
    return { query, hits }
  },
})(({ query, hits }) => {
  if (hits && query) {
    return hits.map((hit, i) => {
      const slug = hit.name.replace(/:/g, '')
      return (
        <HitsOverlay key={i}>
          <a href={`/commands/${slug}`}>
            <span style={{ minWidth: 110, display: 'inline-block', fontWeight: 'bold' }}>
              <Highlight attribute="name" hit={hit} />
            </span>
            <Highlight attribute="description" hit={hit} />
          </a>
        </HitsOverlay>
      )
    })
  }

  return null
})

export const Nav = ({ routes = [], searchRender, ...props }) => (
  <React.Fragment>
    <NavBar {...props} />

    <Divider my={0} />

    {/* searchRender */}

    <UL>
      {routes.map(route => {
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

export const Pagination = ({ previous, next }) => (
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

const MobileNav = ({ title, logo, update }) => (
  <MobileOnly>
    <Toolbar px={0} color="inherit" bg="transparent">
      <ButtonTransparent
        px={2}
        borderRadius={0}
        m={0}
        mr="auto"
        title="Toggle Menu"
        onClick={e => update(toggle('menu'))}
      >
        {logo || <MenuIcon />}
      </ButtonTransparent>
      <Heading fontSize={1}>{title}</Heading>
      <Box width={48} ml="auto" />
    </Toolbar>
    <Divider my={0} />
  </MobileOnly>
)

const toggle = key => state => ({ [key]: !state[key] })
const close = state => ({ menu: false })

export default class Layout extends React.Component {
  static propTypes = {
    routes: PropTypes.array.isRequired,
  }

  state = {
    menu: false,
    update: fn => this.setState(fn),
  }

  render() {
    const { routes = [], children, route, title = 'Netlify CLI', logo } = this.props

    const { menu, update } = this.state

    const opts = route ? route.props : {}

    if (opts.layout === false) {
      return children
    }

    const Wrapper = opts.fullWidth ? React.Fragment : MaxWidth

    const index = routes.findIndex(r => r.path === route.path)
    const pagination = {
      previous: routes[index - 1],
      next: routes[index + 1],
    }

    // Set page title
    let pageTitle = '404 not found'
    // console.log('route.module', route.module)
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

        <MobileNav title={title} logo={logo} update={update} />

        <Root>
          {menu && <Overlay onClick={e => update(close)} />}
          <InstantSearch appId={'LBLPR1R7ZZ'} apiKey={'b9f2cb3217cdb169590b6736454cbed2'} indexName={'cli-docs'}>
            <Configure />
            <Sidebar open={menu} onClick={e => update(close)}>
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
              {/* <EditLink>
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
              </EditLink> */}
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
