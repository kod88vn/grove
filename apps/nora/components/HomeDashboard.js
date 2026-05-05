import Link from 'next/link'
import { WeatherWidget } from '@/components/WeatherWidget'

export function HomeDashboard({ data }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.45)] backdrop-blur md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.45fr,0.95fr]">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                  {data.user.initials}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">Family dashboard</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                    {data.greeting}, {data.user.name}
                  </h1>
                </div>
              </div>

              <p className="max-w-3xl text-base leading-7 text-slate-600 md:text-lg">{data.headline}</p>

              {data.profile.interests.length ? (
                <div className="flex flex-wrap gap-2">
                  {data.profile.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-900"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {data.quickActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Panel title="Weather watch" eyebrow={data.weather ? data.weather.locationLabel : 'Live forecast via Nora'} accent="cyan">
                {data.weather ? (
                  <>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-3xl font-semibold text-slate-950">{data.weather.temperature}</p>
                        <p className="mt-2 text-sm text-slate-600">{data.weather.summary}</p>
                      </div>
                      <div className="rounded-2xl bg-cyan-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-900">
                        Forecast
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">{data.weather.advisory}</p>
                  </>
                ) : (
                  <WeatherWidget />
                )}
              </Panel>

              <Panel title="Interest profile" eyebrow="Derived from recent chat history" accent="amber">
                <p className="text-sm leading-6 text-slate-600">{data.profile.summary}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  {data.profile.sourceCount} recent chats sampled
                </p>
              </Panel>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-6">
            <Panel title="Personal brief" eyebrow="AI-curated from recent family activity" accent="violet">
              {data.brief.length ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {data.brief.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.tag}</p>
                      <h2 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState>
                  Nora needs a little real chat history before this brief can summarize what matters to your family.
                </EmptyState>
              )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Shopping list" eyebrow="Shared household prep" accent="emerald">
                {data.shoppingList.length ? (
                  <ul className="space-y-3">
                    {data.shoppingList.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <p className="text-sm text-slate-500">{item.detail}</p>
                        </div>
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>
                    No shopping items are available yet. Keep this empty until a real list exists.
                  </EmptyState>
                )}
                <Link href="/modules/shopping-list" className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900">
                  Open shopping list
                </Link>
              </Panel>

              <Panel title="Reminders" eyebrow="Today and next up" accent="rose">
                {data.reminders.length ? (
                  <ul className="space-y-3">
                    {data.reminders.map((item) => (
                      <li key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.dueLabel}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>
                    No reminders are shown until a real reminder source is connected.
                  </EmptyState>
                )}
                <Link href="/modules/reminders" className="mt-4 inline-flex text-sm font-medium text-rose-700 hover:text-rose-900">
                  Open reminders
                </Link>
              </Panel>
            </div>
          </div>

          <Panel title="How Nora can help" eyebrow="Next useful actions" accent="slate">
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Suggested prompt</p>
                <p className="mt-3 text-base leading-7">
                  Build me a dinner plan from tonight&apos;s shopping list and remind me what has to happen before bedtime.
                </p>
              </div>
              <div className="grid gap-3">
                <ActionItem label="Generate dinner plan" description="Use the shopping list and today’s timing constraints." href="/chat" />
                <ActionItem label="Turn brief into reminders" description="Convert the personal brief into a clean action list." href="/chat" />
                <ActionItem label="Review household modules" description="Open planned utilities and decide what to build next." href="/modules" />
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  )
}

function Panel({ title, eyebrow, accent, children }) {
  const accentStyles = {
    cyan: 'from-cyan-100 to-white text-cyan-800',
    amber: 'from-amber-100 to-white text-amber-800',
    violet: 'from-violet-100 to-white text-violet-800',
    emerald: 'from-emerald-100 to-white text-emerald-800',
    rose: 'from-rose-100 to-white text-rose-800',
    slate: 'from-slate-100 to-white text-slate-800',
  }

  return (
    <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur md:p-6">
      <div className={`inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${accentStyles[accent]}`}>
        {eyebrow}
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ActionItem({ label, description, href }) {
  return (
    <Link href={href} className="block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Link>
  )
}

function EmptyState({ children }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">{children}</p>
}