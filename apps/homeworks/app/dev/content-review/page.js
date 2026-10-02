import { notFound } from 'next/navigation'

import { ContentReviewForm } from '@/components/ContentReviewForm'
import { listPendingDrafts } from '@/lib/contentReview'

export default async function ContentReviewPage({ drafts: providedDrafts } = {}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const entries = providedDrafts || await listPendingDrafts()
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">English content review</h1>
      <p className="mb-6 text-slate-600">Development only. Drafts are not child-facing and remain unapproved until a named reviewer decides.</p>
      <ContentReviewForm drafts={entries.map((entry) => entry.draft || entry)} />
    </main>
  )
}