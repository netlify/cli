export default async (request) => {
  return new Response('header-exists-matched')
}

export const config = {
  path: '/header-exists',
  header: {
    'x-test-header': true,
  },
}
