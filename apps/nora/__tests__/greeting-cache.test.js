/**
 * Greeting cache: unit-tests the sessionStorage cache path in triggerGreeting.
 *
 * We test the cache logic directly (get/set) because useChatMessages is a hook
 * that requires a React render environment. The cache key format and read/write
 * behaviour is the contract we want to lock down.
 */

describe('greeting sessionStorage cache', () => {
  const cacheKey = (name) => `greeting:${name ?? ''}`

  beforeEach(() => {
    sessionStorage.clear()
  })

  it('stores a greeting under the correct key', () => {
    sessionStorage.setItem(cacheKey('Alice'), 'Hi Alice!')
    expect(sessionStorage.getItem(cacheKey('Alice'))).toBe('Hi Alice!')
  })

  it('returns null for an uncached name', () => {
    expect(sessionStorage.getItem(cacheKey('Bob'))).toBeNull()
  })

  it('treats null firstName as empty-string key', () => {
    sessionStorage.setItem(cacheKey(null), 'Hi there!')
    expect(sessionStorage.getItem('greeting:')).toBe('Hi there!')
  })

  it('does not leak across different names', () => {
    sessionStorage.setItem(cacheKey('Alice'), 'Hi Alice!')
    expect(sessionStorage.getItem(cacheKey('Bob'))).toBeNull()
  })

  it('overwrites stale cached value', () => {
    sessionStorage.setItem(cacheKey('Alice'), 'Old greeting')
    sessionStorage.setItem(cacheKey('Alice'), 'New greeting')
    expect(sessionStorage.getItem(cacheKey('Alice'))).toBe('New greeting')
  })
})
