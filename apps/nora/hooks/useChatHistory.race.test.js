import { renderHook, act } from '@testing-library/react'
import { useChatHistory } from './useChatHistory'

const UNTITLED = [{ id: 'c1', title: 'New chat', pinned: false, updated_at: 1 }]
const TITLED = [{ id: 'c1', title: 'Fractions', pinned: false, updated_at: 2 }]

// A fake server that holds every GET /api/chats open until the test answers it,
// so the test decides the order in which overlapping refreshes complete.
function heldServer() {
  const requests = []
  const fetch = () =>
    new Promise((resolve) => {
      requests.push(resolve)
    })
  const answer = async (index, body, ok = true) => {
    await act(async () => {
      requests[index](
        ok
          ? { ok: true, status: 200, json: async () => body }
          : { ok: false, status: 503, json: async () => ({ error: 'down' }) },
      )
    })
  }
  return { requests, fetch, answer }
}

describe('useChatHistory overlapping refreshes', () => {
  const originalFetch = global.fetch
  let consoleError

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    consoleError.mockRestore()
  })

  async function mountWithSecondRefresh() {
    const server = heldServer()
    global.fetch = server.fetch
    const { result } = renderHook(() => useChatHistory())
    await act(async () => {
      result.current.refresh()
    })
    expect(server.requests).toHaveLength(2)
    return { server, result }
  }

  it('keeps the newer list when an older refresh completes last', async () => {
    const { server, result } = await mountWithSecondRefresh()

    await server.answer(1, TITLED)
    await server.answer(0, UNTITLED)

    expect(result.current.chats).toEqual(TITLED)
    expect(result.current.loading).toBe(false)
  })

  it('stays loading when an older refresh completes while a newer one is pending', async () => {
    const { server, result } = await mountWithSecondRefresh()

    await server.answer(0, UNTITLED)

    expect(result.current.loading).toBe(true)

    await server.answer(1, TITLED)

    expect(result.current.loading).toBe(false)
    expect(result.current.chats).toEqual(TITLED)
  })

  it('does not show an error from an older refresh that failed after a newer one succeeded', async () => {
    const { server, result } = await mountWithSecondRefresh()

    await server.answer(1, TITLED)
    await server.answer(0, null, false)

    expect(result.current.error).toBeNull()
    expect(result.current.chats).toEqual(TITLED)
  })
})
