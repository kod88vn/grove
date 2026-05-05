import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MODULE_DOMAINS, getModuleBySlug } from '@/lib/modules/registry'

export default async function ModuleDetailPage({ params }) {
  const { slug } = await params
  const module = getModuleBySlug(slug)

  if (!module || module.slug === 'chat') {
    notFound()
  }

  const domain = MODULE_DOMAINS[module.domain]

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 md:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-700">Under Construction</p>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-amber-700">
            {module.status}
          </span>
        </div>

        <h1 className="text-3xl font-semibold text-slate-900">{module.title}</h1>
        <p className="mt-3 text-base text-slate-600">{module.summary}</p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Module Context</p>
          <p className="mt-1 text-sm text-slate-600">Domain: {domain.title}</p>
          <p className="text-sm text-slate-600">Route: /modules/{module.slug}</p>
          <p className="text-sm text-slate-600">Module ID: {module.id}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/modules"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
          >
            Back to Modules
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-800"
          >
            Open Nora Chat
          </Link>
        </div>
      </div>
    </main>
  )
}
