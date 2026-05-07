// Streams the final assistant answer to the client. Handles two retract loops:
// (1) the model leaks XML tool calls into content instead of using structured
//     calls — execute them and re-stream;
// (2) the model narrates intent ("I'll search for...") instead of answering —
//     run the search and re-stream;
// (3) verification required citations but model didn't produce them — re-prompt.

import { callOllama } from './ollama'
import { parseXmlToolCalls } from './toolCalls'
import { buildFallbackWebQuery, dedupeSourceUrls, webSearch } from './web'
import { hasSufficientCitations } from './verification'
import { executeToolCall } from './toolExecution'

const MAX_XML_INTERCEPT_PASSES = 2
const MAX_NARRATION_PASSES = 2

export async function streamFinalAnswer(model, followupMessages, sourceUrls, emit, controller, enc, _pass = 0) {
  const upstream = await callOllama({
    model,
    messages: followupMessages,
    stream: true,
    options: { think: false },
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    throw new Error(text || 'Final response request failed')
  }

  const decoder = new TextDecoder()
  const seen = new Set()
  let rawBuffer = ''
  let fullContent = ''
  let contentStarted = false

  for await (const chunk of upstream.body) {
    rawBuffer += decoder.decode(chunk, { stream: true })

    const lines = rawBuffer.split('\n')
    rawBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const json = JSON.parse(line)
        const key = json.created_at
        if (key) {
          if (seen.has(key)) continue
          seen.add(key)
        }

        const thinking = json.message?.thinking ?? ''
        const content = json.message?.content ?? ''

        if (thinking && !contentStarted) {
          emit({ thinking })
        }

        if (content) {
          fullContent += content
          if (!contentStarted) {
            contentStarted = true
            emit({ status: null })
            emit({ thinkingDone: true })
          }
          emit({ word: content })
        }

        if (json.done) {
          // 1. XML tool-call interception
          const xmlCalls = parseXmlToolCalls(fullContent)
          if (xmlCalls.length > 0 && _pass < MAX_XML_INTERCEPT_PASSES) {
            emit({ retract: true })
            const preamble = fullContent.slice(0, fullContent.indexOf('<')).trim()
            if (preamble) emit({ status: preamble.slice(0, 120) })

            followupMessages.push({ role: 'assistant', content: fullContent, tool_calls: [] })
            for (const call of xmlCalls) {
              await executeToolCall(call, followupMessages, sourceUrls, emit, model)
            }

            const freshSourceUrls = dedupeSourceUrls(sourceUrls)
            if (freshSourceUrls.length > 0) emit({ sources: freshSourceUrls })
            emit({ status: null })
            await streamFinalAnswer(model, followupMessages, sourceUrls, emit, controller, enc, _pass + 1)
            return
          }

          // 2. Citation enforcement
          const hasVerificationMessage = followupMessages.some((m) => {
            if (m.role !== 'system' || !m.content) return false
            return /(cite|citation|source)/i.test(m.content) && /(must|required|critical|strict)/i.test(m.content)
          })
          const needsCitations = hasVerificationMessage && dedupeSourceUrls(sourceUrls).length >= 2
          const hasProperCitations = hasSufficientCitations(fullContent, 2)

          if (needsCitations && !hasProperCitations && _pass < 1) {
            emit({ retract: true })
            emit({ status: 'Enforcing source citations…' })

            followupMessages.push({ role: 'assistant', content: fullContent, tool_calls: [] })
            followupMessages.push({
              role: 'system',
              content: 'CRITICAL: Your previous response did not cite sources properly.\n' +
                'Rewrite your answer using ONLY these formats:\n' +
                '- [Source: Name] for formal citations\n' +
                '- (per Name) for inline citations\n' +
                'Every factual claim MUST include at least one citation.\n' +
                'List at least 2 different sources by name.',
            })

            emit({ status: null })
            await streamFinalAnswer(model, followupMessages, sourceUrls, emit, controller, enc, _pass + 1)
            return
          }

          // 3. Planning-narration interception
          const isNarration = _pass < MAX_NARRATION_PASSES &&
            /\b(i should|i will|i'll|i need to|let me)\b.{0,80}\b(search|look up|find|check|try|use the \w+_\w+ tool)\b/i.test(fullContent)
          if (isNarration) {
            emit({ retract: true })
            const userMessage = followupMessages.findLast((m) => m.role === 'user')?.content ?? ''
            // The model's narration sometimes describes a more specific query
            // than the original user message — try to extract it.
            const intentPatterns = [
              /\b(?:search|look\s+up|find|check)\s+(?:for\s+)?(?:the\s+)?(.{10,150}?)(?:\.|,|\n|$)/i,
              /\btry\s+(?:a\s+)?(?:different|another|new|more\s+specific)?\s*(?:search|query)\s+(?:for\s+|to\s+find\s+)?(.{10,150}?)(?:\.|,|\n|$)/i,
            ]
            let queryFromNarration = ''
            for (const re of intentPatterns) {
              const m = fullContent.match(re)
              if (m?.[1]) { queryFromNarration = m[1].trim().slice(0, 200); break }
            }
            const rawQuery = queryFromNarration || buildFallbackWebQuery(userMessage) || userMessage
            emit({ status: `Searching for "${rawQuery}"…` })
            emit({ searching: true, query: rawQuery })
            const results = await webSearch(rawQuery)
            emit({ searching: false, query: rawQuery, resultCount: results.length })
            for (const r of results) { if (r?.url) sourceUrls.push(r.url) }
            followupMessages.push({ role: 'assistant', content: fullContent, tool_calls: [] })
            followupMessages.push({
              role: 'tool',
              tool_name: 'web_search',
              content: JSON.stringify({ query: rawQuery, results }),
            })
            const freshSourceUrls = dedupeSourceUrls(sourceUrls)
            if (freshSourceUrls.length > 0) emit({ sources: freshSourceUrls })
            emit({ status: null })
            await streamFinalAnswer(model, followupMessages, sourceUrls, emit, controller, enc, _pass + 1)
            return
          }

          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  controller.enqueue(enc.encode('data: [DONE]\n\n'))
  controller.close()
}
