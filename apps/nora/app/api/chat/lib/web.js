function stripTags(value) {
  return value.replace(/<[^>]*>/g, ' ')
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normalizeDuckDuckGoLink(urlValue) {
  if (!urlValue) return ''

  if (urlValue.startsWith('//duckduckgo.com/l/?')) {
    const fullUrl = `https:${urlValue}`
    const parsed = new URL(fullUrl)
    const target = parsed.searchParams.get('uddg')
    return target ? decodeURIComponent(target) : ''
  }

  if (urlValue.startsWith('/l/?')) {
    const parsed = new URL(`https://duckduckgo.com${urlValue}`)
    const target = parsed.searchParams.get('uddg')
    return target ? decodeURIComponent(target) : ''
  }

  return urlValue
}

function flattenRelatedTopics(topics) {
  const flat = []
  for (const item of topics) {
    if (Array.isArray(item.Topics)) {
      flat.push(...item.Topics)
    } else {
      flat.push(item)
    }
  }
  return flat
}

function dedupeResults(results) {
  const seen = new Set()
  return results.filter((item) => {
    if (!item.url) return false
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

function prefersHtmlResults(query) {
  return /\bofficial source\b|\bsite:/i.test(query)
}

function extractMainText(html) {
  if (!html) return ''
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : html
  return decodeHtml(
    stripTags(
      body
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    )
  )
    .replace(/\s+/g, ' ')
    .trim()
}

async function duckDuckGoHtmlSearch(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'grove-nora/1.0' },
      referrerPolicy: 'no-referrer',
    })
    if (!res.ok) return []

    const html = await res.text()
    const rows = html.split('<div class="result results_links results_links_deep web-result">')
    const parsed = []

    for (const row of rows) {
      const anchorMatch = row.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s)
      if (!anchorMatch) continue

      const rawUrl = decodeHtml(anchorMatch[1])
      const urlValue = normalizeDuckDuckGoLink(rawUrl)
      if (!urlValue) continue

      const title = decodeHtml(stripTags(anchorMatch[2])).trim()
      const snippetMatch = row.match(/<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/s)
      const snippet = snippetMatch
        ? decodeHtml(stripTags(snippetMatch[1])).trim()
        : ''

      parsed.push({
        title: title || urlValue,
        url: urlValue,
        snippet,
      })

      if (parsed.length >= 5) break
    }

    return dedupeResults(parsed)
  } catch {
    return []
  }
}

export async function webSearch(query) {
  if (!query) return []

  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
    query
  )}&format=json&no_html=1&no_redirect=1&skip_disambig=1`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'grove-nora/1.0' },
      referrerPolicy: 'no-referrer',
    })
    if (!res.ok) return []

    const data = await res.json()
    const results = []

    if (data.AbstractURL) {
      results.push({
        title: data.Heading || 'DuckDuckGo Result',
        url: data.AbstractURL,
        snippet: data.AbstractText || '',
      })
    }

    const related = flattenRelatedTopics(data.RelatedTopics || [])
    for (const item of related) {
      if (!item.FirstURL || !item.Text) continue
      results.push({
        title: item.Text.split(' - ')[0],
        url: item.FirstURL,
        snippet: item.Text,
      })
      if (results.length >= 5) break
    }

    const deduped = dedupeResults(results).slice(0, 5)
    if (prefersHtmlResults(query)) {
      const htmlResults = await duckDuckGoHtmlSearch(query)
      const merged = dedupeResults([...htmlResults, ...deduped]).slice(0, 5)
      if (merged.length > 0) return merged
    }

    if (deduped.length > 0) return deduped

    return duckDuckGoHtmlSearch(query)
  } catch {
    return duckDuckGoHtmlSearch(query)
  }
}

export async function readWebpage(url) {
  if (!url) {
    return { url: '', title: '', content: '', error: 'Missing URL' }
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'grove-nora/1.0' },
      referrerPolicy: 'no-referrer',
    })
    if (!res.ok) {
      return {
        url,
        title: '',
        content: '',
        error: `Failed to fetch page (${res.status})`,
      }
    }

    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? decodeHtml(stripTags(titleMatch[1])).trim() : ''
    const content = extractMainText(html).slice(0, 12000)

    return {
      url,
      title,
      content,
      contentLength: content.length,
    }
  } catch {
    return {
      url,
      title: '',
      content: '',
      error: 'Failed to fetch page',
    }
  }
}

export function buildFallbackWebQuery(urlValue) {
  if (!urlValue) return ''

  try {
    const parsed = new URL(urlValue)
    const quoteMatch = parsed.pathname.match(/\/quote\/([A-Za-z0-9._-]+)/)
    if (parsed.hostname.includes('finance.yahoo.com') && quoteMatch?.[1]) {
      const symbol = quoteMatch[1].toUpperCase()
      return `${symbol} stock performance last year`
    }

    const host = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname.replace(/\//g, ' ').trim()
    return `${host} ${path}`.trim()
  } catch {
    return urlValue
  }
}

export function dedupeSourceUrls(urls) {
  const seen = new Set()
  const unique = []
  for (const url of urls) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    unique.push(url)
  }
  return unique
}
