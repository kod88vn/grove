import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const DEFAULT_MAX_ENTRIES = Number(process.env.CLASSIFICATION_CACHE_LRU_MAX || 500)
const PROMPT_VERSION = process.env.OLLAMA_CLASSIFIER_PROMPT_VERSION || 'v1'
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DB_PATH = path.resolve(MODULE_DIR, '../data/classification-cache.sqlite')

const TTL_BY_ROUTE_MS = {
  local_tool: Number(process.env.CLASSIFICATION_CACHE_TTL_LOCAL_MS || 1000 * 60 * 60 * 24 * 180),
  reasoning: Number(process.env.CLASSIFICATION_CACHE_TTL_REASONING_MS || 1000 * 60 * 60 * 24 * 30),
  fast_chat: Number(process.env.CLASSIFICATION_CACHE_TTL_CHAT_MS || 1000 * 60 * 60 * 24 * 30),
  factual_tool: Number(process.env.CLASSIFICATION_CACHE_TTL_FACTUAL_MS || 1000 * 60 * 60 * 24 * 7),
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeMessage(message) {
  return String(message || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function makeCacheKey({ normalizedMessage, surface, classifierModel, promptVersion }) {
  return `${promptVersion}|${classifierModel}|${surface}|${normalizedMessage}`
}

function toIsoAfter(ms) {
  return new Date(Date.now() + ms).toISOString()
}

function parseHostsFromPayload(payload) {
  const hosts = new Set()
  let sourceCount = 0

  const addUrl = (value) => {
    if (typeof value !== 'string' || !value) return
    try {
      const host = new URL(value).host
      if (host) {
        hosts.add(host)
        sourceCount += 1
      }
    } catch {
      // ignore invalid URLs
    }
  }

  if (payload && Array.isArray(payload.results)) {
    for (const item of payload.results) {
      addUrl(item?.url)
      addUrl(item?.href)
      addUrl(item?.sourceUrl)
    }
  }

  if (payload && Array.isArray(payload.sources)) {
    for (const item of payload.sources) {
      if (typeof item === 'string') {
        addUrl(item)
      } else {
        addUrl(item?.url)
        addUrl(item?.href)
      }
    }
  }

  return {
    sourceCount,
    citationHosts: [...hosts],
  }
}

function rowToIntent(row) {
  if (!row) return null
  const intent = {
    route: row.route,
    intent: row.intent,
    confidence: row.confidence,
    reason: row.reason || 'classification_cache_hit',
  }
  if (row.tool_name) {
    intent.toolName = row.tool_name
  }
  return intent
}

function createLru(maxEntries) {
  const map = new Map()

  return {
    get(key) {
      if (!map.has(key)) return null
      const value = map.get(key)
      map.delete(key)
      map.set(key, value)
      return value
    },
    set(key, value) {
      if (map.has(key)) map.delete(key)
      map.set(key, value)
      if (map.size > maxEntries) {
        const oldest = map.keys().next().value
        map.delete(oldest)
      }
    },
    delete(key) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
  }
}

export function createClassificationCache(options = {}) {
  const dbPath = options.dbPath || process.env.CLASSIFICATION_CACHE_PATH || DEFAULT_DB_PATH
  const maxEntries = Number(options.maxEntries || DEFAULT_MAX_ENTRIES)
  const classifierModel = options.classifierModel || process.env.OLLAMA_CLASSIFIER_MODEL || 'qwen2.5:1.5b'
  const promptVersion = options.promptVersion || PROMPT_VERSION
  const minConfidenceRank = { low: 1, medium: 2, high: 3 }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS classification_cache (
      cache_key TEXT PRIMARY KEY,
      normalized_message TEXT NOT NULL,
      surface TEXT NOT NULL,
      route TEXT NOT NULL,
      intent TEXT NOT NULL,
      tool_name TEXT,
      confidence TEXT NOT NULL,
      reason TEXT,
      source_count INTEGER NOT NULL DEFAULT 0,
      citation_hosts TEXT NOT NULL DEFAULT '[]',
      quality_gate TEXT NOT NULL,
      classifier_model TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_classification_cache_expires_at ON classification_cache(expires_at);
  `)

  const readStmt = db.prepare(`
    SELECT cache_key, route, intent, tool_name, confidence, reason, expires_at
    FROM classification_cache
    WHERE cache_key = ?
  `)

  const upsertStmt = db.prepare(`
    INSERT INTO classification_cache (
      cache_key, normalized_message, surface, route, intent, tool_name,
      confidence, reason, source_count, citation_hosts, quality_gate,
      classifier_model, prompt_version, hit_count, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      route = excluded.route,
      intent = excluded.intent,
      tool_name = excluded.tool_name,
      confidence = excluded.confidence,
      reason = excluded.reason,
      source_count = excluded.source_count,
      citation_hosts = excluded.citation_hosts,
      quality_gate = excluded.quality_gate,
      classifier_model = excluded.classifier_model,
      prompt_version = excluded.prompt_version,
      updated_at = excluded.updated_at,
      expires_at = excluded.expires_at
  `)

  const deleteStmt = db.prepare(`DELETE FROM classification_cache WHERE cache_key = ?`)
  const bumpHitStmt = db.prepare(`UPDATE classification_cache SET hit_count = hit_count + 1, updated_at = ? WHERE cache_key = ?`)

  const lru = createLru(maxEntries)

  function makeMeta(message, surface = 'chat') {
    const normalizedMessage = normalizeMessage(message)
    const resolvedSurface = String(surface || 'chat')
    const cacheKey = makeCacheKey({
      normalizedMessage,
      surface: resolvedSurface,
      classifierModel,
      promptVersion,
    })
    return { normalizedMessage, surface: resolvedSurface, cacheKey }
  }

  function persist(meta, intent, qualityGate, sourceCount = 0, citationHosts = []) {
    const ttlMs = TTL_BY_ROUTE_MS[intent.route] || TTL_BY_ROUTE_MS.factual_tool
    const createdAt = nowIso()
    const expiresAt = toIsoAfter(ttlMs)
    upsertStmt.run(
      meta.cacheKey,
      meta.normalizedMessage,
      meta.surface,
      intent.route,
      intent.intent || 'factual',
      intent.toolName || null,
      intent.confidence || 'medium',
      intent.reason || 'classification_cache',
      sourceCount,
      JSON.stringify(citationHosts),
      qualityGate,
      classifierModel,
      promptVersion,
      0,
      createdAt,
      createdAt,
      expiresAt
    )

    lru.set(meta.cacheKey, {
      intent: rowToIntent({
        route: intent.route,
        intent: intent.intent || 'factual',
        tool_name: intent.toolName || null,
        confidence: intent.confidence || 'medium',
        reason: intent.reason || 'classification_cache',
      }),
      expiresAt,
    })
  }

  function get(params = {}) {
    const meta = makeMeta(params.message, params.surface)
    if (!meta.normalizedMessage) return null

    const now = nowIso()
    const fromLru = lru.get(meta.cacheKey)
    if (fromLru) {
      if (fromLru.expiresAt <= now) {
        lru.delete(meta.cacheKey)
      } else {
        bumpHitStmt.run(now, meta.cacheKey)
        return fromLru.intent
      }
    }

    const row = readStmt.get(meta.cacheKey)
    if (!row) return null

    if (row.expires_at <= now) {
      deleteStmt.run(meta.cacheKey)
      return null
    }

    const intent = rowToIntent(row)
    lru.set(meta.cacheKey, { intent, expiresAt: row.expires_at })
    bumpHitStmt.run(now, meta.cacheKey)
    return intent
  }

  function rememberFromClassification(params = {}) {
    const { message, surface, intent } = params
    if (!intent || !intent.route) return false

    // factual routes need evidence-backed promotion from tool outputs.
    if (intent.route === 'factual_tool') return false
    if (intent.confidence !== 'high') return false

    const meta = makeMeta(message, surface)
    if (!meta.normalizedMessage) return false
    persist(meta, intent, 'confidence_only', 0, [])
    return true
  }

  function promoteWithEvidence(params = {}) {
    const { message, surface, intent, payload } = params
    if (!intent || !intent.route) return false

    const meta = makeMeta(message, surface)
    if (!meta.normalizedMessage) return false

    if (intent.route !== 'factual_tool') {
      return rememberFromClassification({ message, surface, intent })
    }

    const confidence = String(intent.confidence || 'low')
    if (minConfidenceRank[confidence] < minConfidenceRank.medium) {
      return false
    }

    const { sourceCount, citationHosts } = parseHostsFromPayload(payload)
    if (sourceCount < 1) return false

    persist(meta, intent, 'confidence_plus_sources', sourceCount, citationHosts)
    return true
  }

  function close() {
    lru.clear()
    db.close()
  }

  return {
    get,
    rememberFromClassification,
    promoteWithEvidence,
    close,
    dbPath,
  }
}

export function extractCitationEvidence(payload) {
  return parseHostsFromPayload(payload)
}
