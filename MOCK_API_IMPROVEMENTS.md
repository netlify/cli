# Mock API Improvements

## Fail on Unmocked Routes (NEW)

By default, tests will now **fail** when they try to access API routes that haven't been mocked. This prevents tests from accidentally hitting real APIs and improves test isolation.

### Example: Before
```javascript
// OLD BEHAVIOR: This would silently return 404 and might cause confusing test failures
await withMockApi([
  { path: 'sites/site_id', response: siteInfo }
], async ({ apiUrl }) => {
  // If CLI tries to call GET /api/v1/user, it would get 404 and might fail cryptically
  await callCli(['status'], getCLIOptions({ builder, apiUrl }))
})
```

### Example: After  
```javascript
// NEW BEHAVIOR: This will fail with a clear error message
await withMockApi([
  { path: 'sites/site_id', response: siteInfo }
], async ({ apiUrl }) => {
  await callCli(['status'], getCLIOptions({ builder, apiUrl }))
  // ERROR: ❌ TEST FAILURE: Unmocked API route accessed: GET /api/v1/user
  // Add this route to your test's mock API routes to fix this error.
})
```

### How to Fix
Add the missing routes to your mock:
```javascript
await withMockApi([
  { path: 'sites/site_id', response: siteInfo },
  { path: 'user', response: { name: 'Test User', email: 'test@example.com' } },
  { path: 'accounts', response: [{ slug: 'test-account' }] }
], async ({ apiUrl }) => {
  await callCli(['status'], getCLIOptions({ builder, apiUrl }))
  // ✅ Now works perfectly!
})
```

### Disable if needed (not recommended)
```javascript
await withMockApi(routes, async ({ apiUrl }) => {
  // Test code here
}, { failOnMissingRoutes: false }) // Disables the strict checking
```

## Benefits

1. **🛡️ Test Isolation**: Prevents accidental API calls to real services
2. **🐛 Better Debugging**: Clear error messages show exactly which routes are missing
3. **📝 Documentation**: Forces explicit declaration of all API dependencies
4. **🚀 Reliability**: Tests fail fast with actionable error messages

## Backward Compatibility

- Existing tests continue to work
- The `silent` parameter is still supported: `withMockApi(routes, handler, true)`  
- New options can be passed as an object: `withMockApi(routes, handler, { silent: true, failOnMissingRoutes: false })`