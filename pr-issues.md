# PR Issues

## Test failures

It is useful to run tests with the following command as an example:

```bash
npm run build && npx vitest run tests/integration/commands/dev/serve.test.ts
```

### `commands/dev/serve.test.ts`

This test fails, even when you pass the correct routes to be mocked to the dev server. I have verified that the routes
are being passed correctly but the test fails and debugging shows that it cannot find the routes.


