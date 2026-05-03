import { callOllama } from './ollama'
import { webSearch, readWebpage } from './web'
import { log } from './logger'

const MAX_ANGLES = 4
const SUMMARY_TOKENS = 200

/**
 * Ask the model to decompose a topic into distinct research angles.
 * Returns an array of query strings.
 */
async function planResearchAngles(model, topic) {
  try {
    const res = await callOllama({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a research planner. Given a topic, output ONLY a JSON array of 4 distinct search queries that together cover the topic from different angles (causes, data/statistics, expert opinion, recent developments). No explanation, just the JSON array of strings.',
        },
        { role: 'user', content: topic },
      ],
      stream: false,
      options: { num_predict: 256, think: false },
    })
    if (!res.ok) return [topic]
    const json = await res.json()
    const raw = json.message?.content?.trim() ?? ''
    // Extract JSON array from the response (model may wrap it in markdown)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return [topic]
    const angles = JSON.parse(match[0])
    if (!Array.isArray(angles) || angles.length === 0) return [topic]
    return angles.slice(0, MAX_ANGLES).map((q) => String(q).trim()).filter(Boolean)
  } catch {
    return [topic]
  }
}

/**
 * Summarize a single page's content down to key facts relevant to the topic.
 */
async function summarizeForTopic(model, topic, url, title, content) {
  try {
    const res = await callOllama({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise summarizer. Extract only the facts, data points, and insights from the provided content that are relevant to the research topic. Be concise — 3 to 5 sentences. Preserve specific names, numbers, and dates.',
        },
        {
          role: 'user',
          content: `Research topic: ${topic}\n\nURL: ${url}\nTitle: ${title}\n\nContent:\n${content.slice(0, 6000)}`,
        },
      ],
      stream: false,
      options: { num_predict: SUMMARY_TOKENS, think: false },
    })
    if (!res.ok) return content.slice(0, 500)
    const json = await res.json()
    return json.message?.content?.trim() || content.slice(0, 500)
  } catch {
    return content.slice(0, 500)
  }
}

/**
 * Run deep research on a topic:
 * 1. Plan 4 distinct search angles
 * 2. Search + read top result per angle
 * 3. Summarize each finding
 * 4. Return structured findings for the model to synthesize
 */
export async function deepResearch(model, topic, onProgress) {
  log.toolExecute('deep_research', { topic })

  onProgress({ status: 'Planning research angles…' })
  const angles = await planResearchAngles(model, topic)
  log.toolResult('deep_research_angles', { topic, angles })
  onProgress({ researchAngles: angles })

  const findings = []
  const sourceUrls = []

  for (let i = 0; i < angles.length; i++) {
    const query = angles[i]
    onProgress({ status: `Searching angle ${i + 1}/${angles.length}: ${query}` })
    onProgress({ researchSearching: true, angle: i + 1, total: angles.length, query })

    const results = await webSearch(query)
    onProgress({ researchSearching: false, angle: i + 1, total: angles.length, resultCount: results.length })

    const topResult = results[0]
    if (!topResult?.url) {
      findings.push({ angle: query, summary: 'No results found.', url: null })
      continue
    }

    sourceUrls.push(topResult.url)

    const hostname = (() => { try { return new URL(topResult.url).hostname } catch { return topResult.url } })()
    onProgress({ status: `Reading ${hostname}…` })
    const page = await readWebpage(topResult.url)
    if (page?.error || !page?.content) {
      findings.push({ angle: query, summary: topResult.snippet || 'Could not read page.', url: topResult.url })
      continue
    }

    onProgress({ status: `Summarizing findings (${i + 1}/${angles.length})…` })
    const summary = await summarizeForTopic(model, topic, page.url, page.title, page.content)
    findings.push({ angle: query, summary, url: page.url })
  }

  onProgress({ status: 'Synthesizing research…' })
  log.toolResult('deep_research', {
    topic,
    angleCount: angles.length,
    findingsCount: findings.length,
    sourceUrls,
  })

  return { topic, findings, sourceUrls }
}
