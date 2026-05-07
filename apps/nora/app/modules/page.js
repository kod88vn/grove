'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MODULE_DOMAINS, getModulesByDomain } from '@/lib/modules/registry'

const DOMAIN_ORDER = ['learning', 'household']

export default function ModuleCatalogPage() {
  const searchParams = useSearchParams()
  const domainFilter = searchParams.get('domain')

  const domainsToRender = domainFilter && DOMAIN_ORDER.includes(domainFilter)
    ? [domainFilter]
    : DOMAIN_ORDER

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-700">
            {domainFilter === 'learning' ? 'Nora Games' : domainFilter === 'household' ? 'Nora Utilities' : 'Nora Modules'}
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {domainFilter === 'learning' ? 'Fun games for curious kids' : domainFilter === 'household' ? 'Helpful tools for the household' : 'Pluggable features inside the Nora app'}
          </h1>
          <p className="max-w-3xl text-base text-slate-600">
            These routes are reserved for Nora-native tools. You can ship each module incrementally without changing URL structure.
          </p>
        </header>

        <div className="space-y-6">
          {domainsToRender.map((domainKey) => {
            const domain = MODULE_DOMAINS[domainKey]
            const modules = getModulesByDomain(domainKey)

            return (
              <section key={domain.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">{domain.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{domain.description}</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {modules.map((module) => (
                    <Link
                      key={module.id}
                      href={module.href}
                      className="rounded-xl border border-slate-200 p-4 transition hover:border-cyan-300 hover:bg-cyan-50"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900">{module.title}</h3>
                        <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                          {module.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{module.summary}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}
