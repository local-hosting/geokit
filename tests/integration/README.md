# Integration Tests

Integration tests validate real provider implementations against actual APIs.

## Setup

### 1. API Keys

Create a `.env` file in the project root:

```bash
MAPTILER_API_KEY=your_maptiler_key
MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

### 2. Mapbox Token Requirements

**The Mapbox token MUST have:**

1. **Isochrone API** scope enabled
2. **No URL restrictions** (or include `localhost:*` and test domains)
3. **No IP restrictions**

#### Creating a Test Token

1. Go to https://account.mapbox.com/access-tokens/
2. Click **"Create a token"**
3. **Name**: `geokit-testing` (or similar)
4. **Scopes**: Enable all these:
   - ✅ `styles:tiles` (for directions)
   - ✅ `styles:read` (for API access)
   - ✅ `fonts:read`
   - ✅ `datasets:read`
   - ✅ **`navigation:read`** ⭐ (required for Isochrone API)
   - ✅ **`directions:read`** ⭐ (required for Directions API)
5. **URL Restrictions**: Leave **EMPTY** (or add `http://localhost:*`)
6. Copy the token to `.env`

### 3. Current Token Issue

The token from MAPI (`pk.eyJ1IjoiY29yaW8i...`) returns **403 Forbidden** when used from:

- Node.js tests
- CLI/curl requests

But works fine from:

- Browser (MAPI demo app on `localhost:5173`)

**This indicates URL/referrer restrictions on the token.**

## Running Tests

### Run Integration Tests Only

```bash
yarn test:integration
```

### Run All Tests (Unit + Integration)

```bash
yarn test
```

### Skip Integration Tests

Integration tests automatically skip if environment variables are not set:

```typescript
it.skipIf(!MAPBOX_TOKEN)('should fetch isochrone', async () => {
  // Only runs if MAPBOX_ACCESS_TOKEN is set
});
```

## What's Tested

### ✅ Unit Tests (Mocked)

- Provider registration
- Capability routing
- Cache behavior
- Error handling

### ⏭️ UI Provider Tests (Skipped in jsdom)

- MapTiler/Mapbox map creation (requires real browser + WebGL)
- Control creation
- Marker/popup creation

### 🔴 API Provider Tests (Require Valid Token)

- Isochrone API calls
- Directions API calls
- Cache hit/miss behavior
- Different travel modes

## Solutions

### Option 1: Create Unrestricted Token (Recommended for Local Testing)

Follow setup instructions above to create a token without URL restrictions.

### Option 2: Mock API Responses (CI/CD)

For CI/CD, mock the Mapbox API responses instead of hitting real endpoints:

```typescript
vi.mock('node:fetch', () => ({
  default: vi.fn((url) => {
    if (url.includes('api.mapbox.com/isochrone')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            /* mock GeoJSON */
          }),
      });
    }
  }),
}));
```

### Option 3: Use Proxy Server

Set up a local proxy that adds the correct Referer header:

```javascript
// proxy-server.js
const http = require('http');
const fetch = require('node-fetch');

http
  .createServer(async (req, res) => {
    const url = `https://api.mapbox.com${req.url}`;
    const response = await fetch(url, {
      headers: { Referer: 'http://localhost:5173/' },
    });
    res.end(await response.text());
  })
  .listen(3001);
```

Then point tests to `http://localhost:3001` instead of `api.mapbox.com`.

## Current Status

- ✅ **796 unit tests passing** (with mocks)
- ✅ **2 API provider tests passing** (initialization, error handling)
- ⏭️ **8 UI provider tests skipped** (require real browser)
- 🔴 **4 API provider tests failing** (403 Forbidden - token restricted)

## Next Steps

1. Create a new Mapbox token with Isochrone API scope + no URL restrictions
2. Update `.env` with new token
3. Run `yarn test:integration` to validate

OR

1. Skip real API tests in CI
2. Document that real API testing requires manual setup
3. Rely on mock tests for automated validation
