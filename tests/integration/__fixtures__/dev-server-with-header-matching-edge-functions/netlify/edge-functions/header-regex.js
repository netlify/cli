export default async (request) => {
  return new Response('header-regex-matched')
}

export const config = {
  path: '/header-regex',
  header: {
    'x-api-key': '^api-key-\\d+$',
  },
}
