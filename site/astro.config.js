// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'

const baseUrl = process.env.DEPLOY_PRIME_URL ?? 'https://cli.netlify.com'

// https://astro.build/config
export default defineConfig({
  site: baseUrl,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      lastmod: new Date(),
    }),
    starlight({
      credits: true,
      title: 'Netlify CLI command reference',
      description: 'Full command reference for the Netlify CLI',
      social: [
        {
          icon: 'blueSky',
          label: 'Bluesky',
          href: 'https://bsky.app/profile/netlify.com',
        },
        { icon: 'github', label: 'GitHub', href: 'https://github.com/netlify/cli' },
        { icon: 'twitter', label: 'Twitter', href: 'https://x.com/Netlify' },
        { icon: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@NetlifyApp' },
      ],
      favicon: 'favicon.svg',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        alt: 'Netlify CLI Docs',
        replacesTitle: true,
      },
      expressiveCode: {
        themes: ['poimandres'],
      },
      // These are all blatantly copied from the SDK docs:
      // https://github.com/netlify/sdk/tree/0eb674e99207bf41b2f1b35d7ef749d691bb9bd3/docs.
      customCss: [
        './src/fonts/font-face.css',
        './src/styles/colors.css',
        './src/styles/sizes.css',
        './src/styles/custom.css',
        './src/styles/transitions.css',
      ],
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css?family=Roboto:400,500,700,400italic|Roboto+Mono:400',
          },
        },
        {
          tag: 'script',
          attrs: {
            async: true,
            src: 'https://www.googletagmanager.com/gtag/js?id=G-X2FMMZSSS9',
          },
        },
        {
          tag: 'script',
          content: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM-NMKKF2M');`,
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: `${baseUrl}/og.png`,
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:image',
            content: `${baseUrl}/og.png`,
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'slack-app-id',
            content: 'A05P27DR8C8',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'sitemap',
            href: '/sitemap-index.xml',
          },
        },
      ],
      sidebar: [
        {
          label: 'Netlify user docs',
          link: 'https://docs.netlify.com/',
          attrs: { target: '_blank', class: 'external-link' },
        },
        {
          label: 'Commands',
          autogenerate: { directory: 'commands' },
        },
        {
          label: 'Release notes',
          link: `https://developers.netlify.com/feed/tag/cli`,
          attrs: { target: '_blank', class: 'external-link margin-top' },
        },
        {
          label: 'Forums',
          link: 'https://answers.netlify.com/tag/netlify-cli',
          attrs: { target: '_blank', class: 'text-sm external-link marg' },
        },
        {
          label: 'Contact support',
          link: 'https://www.netlify.com/support/',
          attrs: { target: '_blank', class: 'text-sm external-link' },
        },
      ],
    }),
  ],
})
