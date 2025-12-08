# API Provider Caching

## Overview

The Mapbox API provider includes built-in LRU (Least Recently Used) caching to reduce API costs, improve performance, and prevent rate limiting.

## Cache Implementation

### Configuration

```typescript
import { LRUCache } from 'lru-cache';

private cache = new LRUCache<string, CacheEntry>({
  max: 100,                // Maximum 100 cached entries
  ttl: 1000 * 60 * 10,    // 10 minutes time-to-live
  updateAgeOnGet: true,    // Reset age when accessed (LRU behavior)
});
```

### How It Works

```typescript
// 1. Generate cache key
const cacheKey = `iso:40.7128,-74.0060:15,30:driving`;
                     ↑       ↑         ↑    ↑
                   prefix  coords   times mode

// 2. Check cache
if (cache.has(cacheKey)) {
  return cache.get(cacheKey); // Instant return
}

// 3. Fetch from API (cache miss)
const result = await fetch(apiUrl);

// 4. Store in cache
cache.set(cacheKey, result);
```

### Cache Key Strategy

**Coordinate Rounding:**
```typescript
// Round to 4 decimal places (~11 meters precision)
lat: 40.712849 → 40.7128
lng: -74.006043 → -74.0060

// Why? Nearby queries hit the same cache entry
User at 40.712849, -74.006043 → cache entry
User at 40.712851, -74.006041 → SAME cache entry ✅
```

## Benefits

### 💰 Cost Savings

**Scenario: Store Locator with 1000 daily users**

```
Without Cache:
- User explores map: 10 isochrone calls × $0.0005 = $0.005
- 1000 users/day: $5/day = $150/month

With Cache (70% hit rate):
- User explores map: 3 API calls, 7 cached = $0.0015
- 1000 users/day: $1.50/day = $45/month

Savings: $105/month (70% reduction)
```

### ⚡ Performance

```
API Call:  800ms - 2000ms
Cache Hit: <1ms (800-2000× faster)
```

**User Experience:**
- Instant results for repeated queries
- Smooth map interactions (pan/zoom)
- No loading spinners for cached data

### 🛡️ Rate Limit Protection

**Mapbox Rate Limits:**
- 300 requests/minute for isochrone
- 600 requests/minute for directions

**Without cache:** 5 active users can hit the limit  
**With cache:** Support 50+ simultaneous users

## Cache Statistics

Monitor cache performance:

```typescript
import { MapboxAPIProvider } from '@twinfile/geokit/api';

const provider = new MapboxAPIProvider();
await provider.initialize({ accessToken: 'YOUR_TOKEN' });

// Make some requests...
await provider.fetchIsochrone({ lat: 40.7128, lng: -74.006, minutes: [15], mode: 'driving' });
await provider.fetchIsochrone({ lat: 40.7128, lng: -74.006, minutes: [15], mode: 'driving' }); // Cache hit

// Check stats
const stats = provider.getCacheStats();
console.log(stats);
// {
//   size: 1,
//   hits: 1,
//   misses: 1,
//   hitRate: '50.0%'
// }
```

## Cache Management

### Clear Cache

```typescript
// Clear all cached entries
provider.clearCache();
```

**Use cases:**
- Memory pressure
- User logout (clear their data)
- Testing
- Force refresh

### Automatic Eviction

**LRU Strategy:**
1. Cache fills to 100 entries
2. New request comes in
3. Oldest (least recently used) entry is removed
4. New entry is added

**TTL Expiration:**
- Entries expire after 10 minutes
- Expired entries are automatically removed
- Prevents stale data

## Cache Behavior Examples

### Example 1: Same Location, Different Times

```typescript
// Request 1
await provider.fetchIsochrone({
  lat: 40.7128, lng: -74.006,
  minutes: [15], mode: 'driving'
}); // API call → cache entry A

// Request 2 (different time)
await provider.fetchIsochrone({
  lat: 40.7128, lng: -74.006,
  minutes: [30], mode: 'driving'
}); // API call → cache entry B (different key)

Result: 2 API calls (different minutes)
```

### Example 2: Nearby Locations

```typescript
// User 1 clicks point
await provider.fetchIsochrone({
  lat: 40.712849, lng: -74.006043,
  minutes: [15], mode: 'driving'
}); // API call → cache

// User 2 clicks nearby point (11 meters away)
await provider.fetchIsochrone({
  lat: 40.712851, lng: -74.006041,
  minutes: [15], mode: 'driving'
}); // Cache hit! (rounds to same coords)

Result: 1 API call, 50% savings
```

### Example 3: User Returns to Location

```typescript
// 09:00 AM - User checks isochrone
await provider.fetchIsochrone({ lat: 40.7128, lng: -74.006, minutes: [15], mode: 'driving' });
// API call → cached

// 09:05 AM - User pans away and back
await provider.fetchIsochrone({ lat: 40.7128, lng: -74.006, minutes: [15], mode: 'driving' });
// Cache hit! (within 10 min TTL)

// 09:20 AM - User checks again
await provider.fetchIsochrone({ lat: 40.7128, lng: -74.006, minutes: [15], mode: 'driving' });
// API call (TTL expired, 10 min passed)

Result: 2 API calls instead of 3 (33% savings)
```

## Testing

Cache behavior is fully tested:

```typescript
// tests/api/api-providers.test.ts
it('should use LRU cache for repeated requests', async () => {
  const provider = new MapboxAPIProvider();
  await provider.initialize({ accessToken: 'token' });

  const options = { lat: 40.7128, lng: -74.006, minutes: [15], mode: 'driving' };

  await provider.fetchIsochrone(options); // Cache miss
  await provider.fetchIsochrone(options); // Cache hit
  
  const stats = provider.getCacheStats();
  expect(stats.hitRate).toBe('50.0%'); // 1 hit, 1 miss
});
```

## Configuration

### Adjust Cache Settings

Modify in `src/api/providers/mapbox-provider.ts`:

```typescript
this.cache = new LRUCache({
  max: 200,               // More entries (for high-traffic apps)
  ttl: 1000 * 60 * 30,   // 30 minutes (for stable data)
  updateAgeOnGet: true,
});
```

**Considerations:**
- **More entries** = more memory, better hit rate
- **Longer TTL** = less API calls, possibly stale data
- **Shorter TTL** = more API calls, always fresh data

### Production Recommendations

**Low Traffic (<1000 requests/day):**
```typescript
max: 50
ttl: 1000 * 60 * 5  // 5 minutes
```

**Medium Traffic (1000-10000 requests/day):**
```typescript
max: 100             // DEFAULT
ttl: 1000 * 60 * 10  // 10 minutes (DEFAULT)
```

**High Traffic (>10000 requests/day):**
```typescript
max: 500
ttl: 1000 * 60 * 30  // 30 minutes
```

## Monitoring

### Log Cache Performance

```typescript
// Periodically log cache stats
setInterval(() => {
  const stats = provider.getCacheStats();
  console.log('Mapbox API Cache:', stats);
  // { size: 45, hits: 450, misses: 150, hitRate: '75.0%' }
}, 60000); // Every minute
```

### Optimize Based on Metrics

**If hit rate < 30%:**
- Increase TTL (data expires too quickly)
- Increase max entries (cache is too small)

**If hit rate > 90%:**
- Can reduce max entries (saving memory)
- Cache is very effective!

## Memory Impact

```
100 entries × ~5KB per isochrone = ~500KB
LRU overhead: ~100KB
Total: ~600KB RAM

Negligible for modern browsers/servers
```

## Edge Cases

### Network Failure

```typescript
try {
  const result = await provider.fetchIsochrone(options);
} catch (error) {
  // Cache is NOT populated on error
  // User can retry without getting cached error
}
```

### Concurrent Requests

```typescript
// Two components request same isochrone simultaneously
Promise.all([
  provider.fetchIsochrone(options), // Fetches
  provider.fetchIsochrone(options), // Also fetches (race condition)
]);

// Both will fetch because neither has cached yet
// Second completes, stores in cache, overwrites first
// Future requests will hit cache ✅
```

## Summary

| Feature | Value | Benefit |
|---------|-------|---------|
| **Type** | LRU Cache | Auto-evicts old entries |
| **Max Entries** | 100 | ~500KB RAM |
| **TTL** | 10 minutes | Balance freshness/savings |
| **Cost Savings** | 50-70% | Huge for high-traffic apps |
| **Performance** | 800-2000× faster | Instant results |
| **Coordinate Rounding** | 4 decimals | Better hit rate for nearby queries |

**Bottom Line:** Cache adds ~10 lines of code but saves $$$ and improves UX dramatically.

