import { headers } from 'next/headers'
import { listChats } from '@/lib/db/chats'

const INTEREST_RULES = [
  { keyword: /(meal|dinner|recipe|grocery|lunch)/i, label: 'meal planning' },
  { keyword: /(school|pickup|homework|teacher|camp|class)/i, label: 'school logistics' },
  { keyword: /(calendar|schedule|reminder|routine|chore)/i, label: 'family admin' },
  { keyword: /(trip|travel|weekend|outing|park)/i, label: 'weekend planning' },
  { keyword: /(document|insurance|form|medical|appointment)/i, label: 'paperwork' },
]

export async function getHomeDashboardData() {
  const requestHeaders = await headers()
  const login = requestHeaders.get('tailscale-user-login') || requestHeaders.get('x-forwarded-for') || 'anonymous'
  const name = requestHeaders.get('tailscale-user-name') || login.split('@')[0] || 'there'
  const pic = requestHeaders.get('tailscale-user-profile-pic') || null
  const recentChats = listChats(login)

  return buildHomeDashboardData({
    now: new Date(),
    user: { login, name, pic },
    recentChats,
  })
}

export function buildHomeDashboardData({ now = new Date(), user, recentChats = [] }) {
  const interests = inferInterests(recentChats)
  const brief = buildBrief(recentChats)
  const hasHistory = recentChats.length > 0

  return {
    user: {
      login: user.login,
      name: user.name,
      pic: user.pic || null,
      initials: getInitials(user.name || user.login || 'G'),
    },
    greeting: buildGreeting(now),
    headline: hasHistory
      ? `Nora has ${recentChats.length} recent ${recentChats.length === 1 ? 'conversation' : 'conversations'} to learn from.`
      : 'No household data yet. Start chatting with Nora to build a personalized dashboard.',
    weather: null,
    profile: {
      summary: buildProfileSummary(interests, recentChats.length),
      interests,
      sourceCount: recentChats.length,
    },
    brief,
    shoppingList: [],
    reminders: [],
    quickActions: [
      { id: 'chat', label: 'Ask Nora', href: '/chat' },
      { id: 'shopping', label: 'Open shopping list', href: '/modules/shopping-list' },
      { id: 'reminders', label: 'View reminders', href: '/modules/reminders' },
    ],
  }
}

function buildGreeting(now) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function inferInterests(recentChats) {
  const scores = new Map()

  for (const chat of recentChats) {
    for (const rule of INTEREST_RULES) {
      if (rule.keyword.test(chat.title || '')) {
        scores.set(rule.label, (scores.get(rule.label) || 0) + 1)
      }
    }
  }

  const ranked = [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label]) => label)

  return ranked.slice(0, 3)
}

function buildProfileSummary(interests, sourceCount) {
  if (!sourceCount) {
    return 'No recent chat history yet. Nora will personalize this view after a few real conversations.'
  }

  if (!interests.length) {
    return 'Recent conversations exist, but there are not enough repeated patterns yet to infer reliable household interests.'
  }

  return `Recent Nora conversations cluster around ${interests.join(', ')}.`
}

function buildBrief(recentChats) {
  return recentChats.slice(0, 3).map((chat, index) => ({
    id: chat.id || `brief-${index + 1}`,
    title: chat.title || 'Untitled conversation',
    summary: formatRecentChatSummary(chat),
    tag: deriveChatTag(chat.title),
  }))
}

function formatRecentChatSummary(chat) {
  const updatedLabel = chat.updated_at ? formatTimestamp(chat.updated_at) : null
  return updatedLabel
    ? `Recent Nora conversation updated ${updatedLabel}.`
    : 'Recent Nora conversation captured from chat history.'
}

function deriveChatTag(title = '') {
  for (const rule of INTEREST_RULES) {
    if (rule.keyword.test(title)) {
      return rule.label
    }
  }

  return 'recent chat'
}

function formatTimestamp(unixSeconds) {
  if (!Number.isFinite(unixSeconds)) return null

  try {
    return new Date(unixSeconds * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

function getInitials(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'G'
}