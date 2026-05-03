/**
 * Manual E2E Test - Trace through the actual chat flow
 * Run this to verify the integration works end-to-end
 */

async function testChatFlow() {
  console.log('=== Testing Chat Flow ===\n')

  // Step 1: Send a message
  console.log('Step 1: Sending message...')
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3.5:9b',
      messages: [{ role: 'user', content: 'Say hello and briefly introduce yourself.' }],
    }),
  })

  if (!response.ok) {
    console.error('❌ API returned error:', response.status)
    const error = await response.json()
    console.error(error)
    return
  }

  console.log('✓ API responded with 200')
  console.log('Content-Type:', response.headers.get('content-type'))
  console.log()

  // Step 2: Parse the SSE stream
  console.log('Step 2: Parsing SSE stream...')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  
  let buffer = ''
  let eventCount = 0
  let thinking = ''
  let content = ''
  let thinkingDone = false
  const log = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const data = line.replace(/^data: /, '').trim()
      if (!data) continue

      eventCount++

      try {
        const parsed = JSON.parse(data)

        if (data === '[DONE]') {
          log.push(`Event ${eventCount}: [DONE]`)
        } else if (parsed.thinking) {
          thinking += parsed.thinking
          log.push(`Event ${eventCount}: thinking="${parsed.thinking.slice(0, 20)}..."`)
        } else if (parsed.thinkingDone) {
          thinkingDone = true
          log.push(`Event ${eventCount}: thinkingDone=true`)
        } else if (parsed.word) {
          content += parsed.word
          log.push(`Event ${eventCount}: word="${parsed.word}"`)
        } else {
          log.push(`Event ${eventCount}: unknown=${JSON.stringify(parsed).slice(0, 50)}`)
        }
      } catch (e) {
        log.push(`Event ${eventCount}: ❌ Failed to parse: ${data.slice(0, 50)}`)
      }
    }
  }

  // Step 3: Log results
  console.log(`Received ${eventCount} SSE events\n`)

  console.log('--- Event Log ---')
  log.forEach(l => console.log(l))

  console.log('\n--- Results ---')
  console.log(`Thinking: "${thinking}"`)
  console.log(`Thinking Done: ${thinkingDone}`)
  console.log(`Content: "${content}"`)
  console.log()

  // Step 4: Validate
  console.log('--- Validation ---')
  if (thinking) {
    console.log('✓ Thinking phase occurred')
  } else {
    console.log('⚠ No thinking phase detected')
  }

  if (thinkingDone) {
    console.log('✓ thinkingDone signal sent')
  } else {
    console.log('⚠ No thinkingDone signal')
  }

  if (content) {
    console.log('✓ Content received:', content.slice(0, 50) + '...')
  } else {
    console.log('❌ No content received')
  }

  console.log('\n=== Test Complete ===')
}

// Run test
testChatFlow().catch(console.error)
