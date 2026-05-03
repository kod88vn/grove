# Testing the Chat Flow

## Unit & Integration Tests

Run the test suite:

```bash
cd apps/nora
yarn test:ci
```

This validates:
- SSE message parsing
- State transitions (thinking → thinkingDone → content)
- Word buffering logic
- Edge cases (empty strings, special chars, malformed JSON)

## Manual E2E Test

After `yarn dev` is running, in another terminal:

```bash
cd apps/nora
node test-manual.mjs
```

This will:
1. Send a message to your local Ollama
2. Parse the entire SSE stream
3. Print all events received
4. Validate the flow worked correctly

## Common Issues to Check

### ❌ No thinking phase
- Check: Is Ollama model streaming thinking tokens? (qwen3.5 does)
- Check: API is correctly extracting `message.thinking`
- Check: `contentStarted` flag is working

### ❌ thinkingDone signal missing
- Check: API sends `{"thinkingDone":true}` when `content` field appears
- Check: UI correctly parses this signal

### ❌ Content not appearing
- Check: Ollama is reachable at `http://ai:11434/api/chat`
- Check: API extracts `message.content` correctly
- Check: UI appends words with `+= word`

### ❌ Both thinking and content visible
- Check: `thinkingVisible` is set to false when thinkingDone arrives
- Check: ChatMessage component only renders thinking if `thinkingVisible && thinking`

## Debugging Steps

1. **Check API stream**: Add `console.log()` in `app/api/chat/route.js` line-by-line
2. **Check UI parsing**: Add `console.log()` in `app/page.js` when receiving SSE messages
3. **Check Ollama**: Test with `curl -X POST http://ai:11434/api/chat -H "Content-Type: application/json" -d '{"model":"qwen3.5:9b","messages":[{"role":"user","content":"Hi"}],"stream":true}'`
